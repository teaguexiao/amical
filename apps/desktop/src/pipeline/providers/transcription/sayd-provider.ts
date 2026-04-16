import {
  TranscriptionProvider,
  TranscribeParams,
  TranscribeContext,
  TranscriptionOutput,
} from "../../core/pipeline-types";
import { logger } from "../../../main/logger";
import { SettingsService } from "../../../services/settings-service";
import { getUserAgent } from "../../../utils/http-client";
import { AppError, ErrorCodes } from "../../../types/error";

// Server message types from the Sayd Talk API
interface SaydReadyMessage {
  type: "ready";
}

interface SaydPartialMessage {
  type: "partial";
  text: string;
}

interface SaydSentenceMessage {
  type: "sentence";
  segments: { text: string }[];
}

interface SaydCleanedMessage {
  type: "cleaned";
  text: string;
}

interface SaydCompleteMessage {
  type: "complete";
  text?: string;
}

type SaydServerMessage =
  | SaydReadyMessage
  | SaydPartialMessage
  | SaydSentenceMessage
  | SaydCleanedMessage
  | SaydCompleteMessage;

const DEFAULT_API_ENDPOINT = "https://api.sayd.dev";
const READY_TIMEOUT_MS = 5000;
const COMPLETION_TIMEOUT_MS = 30000;
const KEEPALIVE_INTERVAL_MS = 15000;

export class SaydProvider implements TranscriptionProvider {
  readonly name = "sayd";

  private settingsService: SettingsService;

  // Per-session WebSocket state
  private ws: WebSocket | null = null;
  private sessionReady = false;
  private latestPartialText = "";
  private sentenceTexts: string[] = [];
  private finalCleanedText: string | null = null;
  private keepaliveTimer: NodeJS.Timeout | null = null;

  // Promise resolvers for async coordination
  private readyResolve: (() => void) | null = null;
  private readyReject: ((err: Error) => void) | null = null;
  private completionResolve: ((text: string) => void) | null = null;
  private completionReject: ((err: Error) => void) | null = null;

  // Track whether session has been initialized for current recording
  private currentSessionId: string | undefined;

  constructor(settingsService: SettingsService) {
    this.settingsService = settingsService;
  }

  /**
   * Process an audio chunk — streams immediately via WebSocket.
   * On the first call for a session, creates the Talk session and connects.
   */
  async transcribe(params: TranscribeParams): Promise<TranscriptionOutput> {
    const { audioData, context } = params;
    const sessionId = context.sessionId;

    // Initialize WebSocket on first chunk for this session
    if (!this.ws || this.currentSessionId !== sessionId) {
      await this.initSession(context);
    }

    // Convert Float32Array to PCM16 binary and send
    if (
      audioData.length > 0 &&
      this.ws &&
      this.ws.readyState === WebSocket.OPEN
    ) {
      const pcm16 = this.float32ToPcm16(audioData);
      this.ws.send(pcm16);
    }

    // Return latest partial transcription (non-blocking)
    return {
      text: this.latestPartialText,
    };
  }

  /**
   * Signal end of recording, wait for cleaned/complete response.
   */
  async flush(context: TranscribeContext): Promise<TranscriptionOutput> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // No active session — return whatever we have
      const text = this.finalCleanedText ?? this.latestPartialText;
      this.clearSessionState();
      return { text };
    }

    // Send end signal
    this.ws.send(JSON.stringify({ type: "end" }));

    // Wait for completion
    try {
      const completedText = await new Promise<string>((resolve, reject) => {
        this.completionResolve = resolve;
        this.completionReject = reject;

        setTimeout(() => {
          reject(
            new AppError(
              "Sayd session completion timed out",
              ErrorCodes.NETWORK_ERROR,
            ),
          );
        }, COMPLETION_TIMEOUT_MS);
      });

      const result = completedText || this.latestPartialText;
      this.closeWebSocket();
      this.clearSessionState();

      return { text: result };
    } catch (error) {
      this.closeWebSocket();
      this.clearSessionState();
      throw error;
    }
  }

  /**
   * Clear internal state without transcribing.
   */
  reset(): void {
    this.closeWebSocket();
    this.clearSessionState();
  }

  /**
   * Create a Talk session via REST, then connect WebSocket.
   */
  private async initSession(context: TranscribeContext): Promise<void> {
    // Clean up any previous session
    this.closeWebSocket();
    this.clearSessionState();
    this.currentSessionId = context.sessionId;

    const config = await this.settingsService.getSaydConfig();
    if (!config?.apiKey) {
      throw new AppError(
        "Sayd API key not configured",
        ErrorCodes.AUTH_REQUIRED,
      );
    }

    const apiEndpoint = config.apiEndpoint || DEFAULT_API_ENDPOINT;
    const apiKey = config.apiKey;

    // Map language to Sayd format
    const language = this.mapLanguage(context.language);

    logger.transcription.info("Creating Sayd Talk session", {
      endpoint: apiEndpoint,
      language,
      sessionId: context.sessionId,
    });

    // Step 1: Create session via POST /api/talk
    let wsUrl: string;
    try {
      const response = await fetch(
        `${apiEndpoint}/api/talk`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": apiKey,
            "User-Agent": getUserAgent(),
          },
          body: JSON.stringify({
            language,
            sample_rate: 16000,
            codec: "pcm16",
            cleaning_level: "standard",
            output_format: "paragraph",
          }),
        },
      );

      if (!response.ok) {
        const status = response.status;
        let errorCode = ErrorCodes.UNKNOWN;
        if (status === 401 || status === 403)
          errorCode = ErrorCodes.AUTH_REQUIRED;
        else if (status === 429) errorCode = ErrorCodes.RATE_LIMIT_EXCEEDED;
        else if (status >= 500) errorCode = ErrorCodes.INTERNAL_SERVER_ERROR;

        throw new AppError(
          `Sayd API error: ${status} ${response.statusText}`,
          errorCode,
          status,
        );
      }

      const data = await response.json();
      wsUrl = data.websocket_url;

      if (!wsUrl) {
        throw new AppError(
          "Sayd API did not return a WebSocket URL",
          ErrorCodes.UNKNOWN,
        );
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        error instanceof Error
          ? error.message
          : "Failed to create Sayd session",
        ErrorCodes.NETWORK_ERROR,
      );
    }

    // Step 2: Connect WebSocket (uses native WebSocket from Node.js 22+)
    logger.transcription.info("Connecting Sayd WebSocket", {
      wsUrl: wsUrl.replace(/api_key=[^&]+/, "api_key=***"),
    });

    await new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;

      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        logger.transcription.info("Sayd WebSocket connected");
      };

      ws.onmessage = (event: MessageEvent) => {
        const data =
          typeof event.data === "string"
            ? event.data
            : new TextDecoder().decode(event.data as ArrayBuffer);
        this.handleMessage(data);
      };

      ws.onerror = (event: Event) => {
        logger.transcription.error("Sayd WebSocket error:", event);
        const appError = new AppError(
          "Sayd WebSocket connection error",
          ErrorCodes.NETWORK_ERROR,
        );
        this.readyReject?.(appError);
        this.completionReject?.(appError);
      };

      ws.onclose = (event: CloseEvent) => {
        logger.transcription.info("Sayd WebSocket closed", {
          code: event.code,
          reason: event.reason,
        });

        // If we're waiting for ready, reject
        if (!this.sessionReady) {
          this.readyReject?.(
            new AppError(
              `Sayd WebSocket closed before ready (code: ${event.code})`,
              ErrorCodes.NETWORK_ERROR,
            ),
          );
        }

        // If we're waiting for completion, reject
        this.completionReject?.(
          new AppError(
            `Sayd WebSocket closed unexpectedly (code: ${event.code})`,
            ErrorCodes.NETWORK_ERROR,
          ),
        );

        this.clearKeepalive();
        this.ws = null;
      };

      this.ws = ws;

      // Timeout for ready
      setTimeout(() => {
        if (!this.sessionReady) {
          reject(
            new AppError(
              "Sayd session ready timed out",
              ErrorCodes.NETWORK_ERROR,
            ),
          );
          this.closeWebSocket();
        }
      }, READY_TIMEOUT_MS);
    });

    // Start keepalive
    this.startKeepalive();
  }

  /**
   * Handle incoming WebSocket messages from Sayd.
   */
  private handleMessage(data: string): void {
    try {
      const message: SaydServerMessage = JSON.parse(data);

      switch (message.type) {
        case "ready":
          logger.transcription.info("Sayd session ready");
          this.sessionReady = true;
          this.readyResolve?.();
          this.readyResolve = null;
          this.readyReject = null;
          break;

        case "partial":
          this.latestPartialText = message.text;
          logger.transcription.debug("Sayd partial transcription", {
            textLength: message.text.length,
          });
          break;

        case "sentence":
          if (message.segments) {
            const sentenceText = message.segments
              .map((s) => s.text)
              .join(" ");
            this.sentenceTexts.push(sentenceText);
            logger.transcription.debug("Sayd sentence", {
              segmentCount: message.segments.length,
            });
          }
          break;

        case "cleaned":
          this.finalCleanedText = message.text;
          logger.transcription.info("Sayd cleaned transcription received", {
            textLength: message.text.length,
          });
          // Resolve completion — cleaned is the final useful result
          this.completionResolve?.(message.text);
          this.completionResolve = null;
          this.completionReject = null;
          break;

        case "complete":
          logger.transcription.info("Sayd session complete");
          // If we haven't resolved yet (no cleaned message came), resolve with whatever we have
          if (this.completionResolve) {
            const text =
              this.finalCleanedText ??
              (this.sentenceTexts.join(" ") ||
              this.latestPartialText);
            this.completionResolve(text);
            this.completionResolve = null;
            this.completionReject = null;
          }
          break;

        default:
          logger.transcription.debug("Unknown Sayd message type", {
            message: data.slice(0, 200),
          });
      }
    } catch (error) {
      logger.transcription.warn("Failed to parse Sayd message", {
        error,
        data: data.slice(0, 200),
      });
    }
  }

  /**
   * Convert Float32Array audio ([-1, 1] range) to PCM16 Int16 binary buffer.
   */
  private float32ToPcm16(float32: Float32Array): ArrayBuffer {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16.buffer;
  }

  /**
   * Map app language setting to Sayd API language format.
   */
  private mapLanguage(language?: string): string {
    if (!language || language === "auto") return "auto";
    // Sayd accepts "en", "zh", "multi" etc
    if (language.startsWith("zh")) return "zh";
    if (language.startsWith("en")) return "en";
    return language;
  }

  private startKeepalive(): void {
    this.clearKeepalive();
    this.keepaliveTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "keepalive" }));
      }
    }, KEEPALIVE_INTERVAL_MS);
  }

  private clearKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  private closeWebSocket(): void {
    this.clearKeepalive();
    if (this.ws) {
      try {
        if (
          this.ws.readyState === WebSocket.OPEN ||
          this.ws.readyState === WebSocket.CONNECTING
        ) {
          this.ws.close();
        }
      } catch {
        // Ignore close errors
      }
      this.ws = null;
    }
  }

  private clearSessionState(): void {
    this.sessionReady = false;
    this.latestPartialText = "";
    this.sentenceTexts = [];
    this.finalCleanedText = null;
    this.currentSessionId = undefined;
    this.readyResolve = null;
    this.readyReject = null;
    this.completionResolve = null;
    this.completionReject = null;
  }
}
