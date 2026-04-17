import { app, autoUpdater } from "electron";
import { EventEmitter } from "events";
import { updateElectronApp, UpdateSourceType } from "update-electron-app";
import { logger } from "../logger";
import type { SettingsService } from "../../services/settings-service";
import type { TelemetryService } from "../../services/telemetry-service";

const GITHUB_REPO = "teaguexiao/sayd-desktop";
const CHECK_INTERVAL_MINUTES = 30;

export type UpdateAction = "none" | "silent" | "prompt" | "force";

type UpdaterErrorClassification = "read_only_volume" | "generic";

export interface UpdateMetadata {
  action: UpdateAction;
  version?: string;
  message?: string;
  releaseNotes?: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function classifyUpdaterError(
  error: unknown,
  platform: NodeJS.Platform = process.platform,
): UpdaterErrorClassification {
  const message = getErrorMessage(error).toLowerCase();

  if (
    platform === "darwin" &&
    (message.includes("read-only volume") ||
      message.includes("read only volume"))
  ) {
    return "read_only_volume";
  }

  return "generic";
}

// Thin wrapper around `update-electron-app`, which drives Electron's native
// autoUpdater against update.electronjs.org (a free service run by the
// Electron team that reads directly from GitHub Releases). The outward shape
// of this service preserves the metadata-driven API from the previous
// implementation so app-manager / tRPC consumers stay unchanged. Because
// update.electronjs.org has no metadata endpoint, `getLastMetadata` always
// reports a "prompt" action once an update is downloaded — remote-controlled
// "force" / "none" policies are no longer available.
export class AutoUpdaterService extends EventEmitter {
  private settingsService: SettingsService | null = null;
  private telemetryService: TelemetryService | null = null;
  private currentChannel: "stable" | "beta" = "stable";
  private isChecking = false;
  private lastMetadata: UpdateMetadata | null = null;
  private updateDownloaded = false;
  private downloadedVersion: string | undefined;

  constructor() {
    super();
  }

  async initialize(
    settingsService: SettingsService,
    telemetryService: TelemetryService,
  ): Promise<void> {
    if (!app.isPackaged) {
      logger.updater.info("Skipping auto-updater: app is not packaged");
      return;
    }

    if (process.argv.includes("--squirrel-firstrun")) {
      logger.updater.info(
        "Skipping auto-updater: first run after Squirrel install",
      );
      return;
    }

    this.settingsService = settingsService;
    this.telemetryService = telemetryService;
    this.currentChannel = await settingsService.getUpdateChannel();

    this.registerEventHandlers();

    try {
      updateElectronApp({
        updateSource: {
          type: UpdateSourceType.ElectronPublicUpdateService,
          repo: GITHUB_REPO,
        },
        updateInterval: `${CHECK_INTERVAL_MINUTES} minutes`,
        logger: {
          log: (...args: unknown[]) =>
            logger.updater.info("[update-electron-app]", { args }),
          info: (...args: unknown[]) =>
            logger.updater.info("[update-electron-app]", { args }),
          error: (...args: unknown[]) =>
            logger.updater.error("[update-electron-app]", { args }),
          warn: (...args: unknown[]) =>
            logger.updater.warn("[update-electron-app]", { args }),
        },
        notifyUser: false,
      });
      logger.updater.info("Auto-updater initialized", {
        channel: this.currentChannel,
        repo: GITHUB_REPO,
      });
    } catch (error) {
      logger.updater.error("Failed to initialize auto-updater", { error });
      this.telemetryService?.captureException(error, {
        source: "auto_updater_init",
      });
    }

    // The channel setting is preserved for UX continuity, but
    // update.electronjs.org only serves latest non-prerelease, non-draft
    // GitHub releases — there is no beta feed. We still log channel changes
    // so the setting stays observable.
    settingsService.on(
      "update-channel-changed",
      (channel: "stable" | "beta") => {
        this.currentChannel = channel;
        logger.updater.info(
          "Update channel changed (note: only 'stable' is served by update.electronjs.org)",
          { channel },
        );
      },
    );
  }

  private registerEventHandlers(): void {
    autoUpdater.on("error", (error) => {
      this.isChecking = false;
      const classification = classifyUpdaterError(error);
      const message = getErrorMessage(error);

      if (classification === "read_only_volume") {
        logger.updater.warn("Auto-updater warning", {
          error: message,
          classification,
        });
        return;
      }

      logger.updater.error("Auto-updater error", { error: message });
      this.telemetryService?.captureException(error, {
        source: "auto_updater",
        channel: this.currentChannel,
        classification,
      });
    });

    autoUpdater.on("checking-for-update", () => {
      this.isChecking = true;
      logger.updater.info("Checking for update...");
      this.emit("checking-for-update");
    });

    autoUpdater.on("update-available", () => {
      logger.updater.info("Update available, downloading...");
      this.updateDownloaded = false;
      this.emit("update-available");
    });

    autoUpdater.on("update-not-available", () => {
      this.isChecking = false;
      logger.updater.info("No update available");
      this.emit("update-not-available");
    });

    autoUpdater.on(
      "update-downloaded",
      (_event, releaseNotes, releaseName) => {
        this.isChecking = false;
        this.updateDownloaded = true;
        this.downloadedVersion = releaseName;
        this.lastMetadata = {
          action: "prompt",
          version: releaseName,
          releaseNotes,
        };
        logger.updater.info("Update downloaded", { releaseName });
        this.emit("update-downloaded", { releaseNotes, releaseName });
      },
    );
  }

  getLastMetadata(): UpdateMetadata | null {
    return this.lastMetadata;
  }

  isDownloaded(): boolean {
    return this.updateDownloaded;
  }

  async checkForUpdates(userInitiated = false): Promise<void> {
    if (!app.isPackaged) {
      logger.updater.info("Skipping update check: app is not packaged");
      return;
    }

    if (this.isChecking) {
      logger.updater.info("Update check already in progress, skipping");
      return;
    }

    try {
      logger.updater.info("Checking for updates", { userInitiated });
      autoUpdater.checkForUpdates();
    } catch (error) {
      this.isChecking = false;
      logger.updater.error("Failed to check for updates", { error });
    }
  }

  quitAndInstall(): void {
    logger.updater.info("Quitting and installing update");
    autoUpdater.quitAndInstall();
  }

  cleanup(): void {
    if (this.settingsService) {
      this.settingsService.removeAllListeners("update-channel-changed");
      this.settingsService = null;
    }
  }
}
