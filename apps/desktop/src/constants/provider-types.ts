import { REMOTE_PROVIDERS, type RemoteProvider } from "./remote-providers";

export const PROVIDER_TYPES = {
  sayd: "sayd",
  localWhisper: "local-whisper",
  openRouter: "openrouter",
  ollama: "ollama",
  openAICompatible: "openai-compatible",
} as const;

export type ProviderType = (typeof PROVIDER_TYPES)[keyof typeof PROVIDER_TYPES];

export const SYSTEM_PROVIDER_INSTANCE_IDS = {
  sayd: "system-sayd",
  localWhisper: "system-local-whisper",
  openRouter: "system-openrouter",
  ollama: "system-ollama",
  openAICompatible: "system-openai-compatible",
} as const;

export function getRemoteProviderType(provider: RemoteProvider): ProviderType {
  switch (provider) {
    case REMOTE_PROVIDERS.openRouter:
      return PROVIDER_TYPES.openRouter;
    case REMOTE_PROVIDERS.ollama:
      return PROVIDER_TYPES.ollama;
    case REMOTE_PROVIDERS.openAICompatible:
      return PROVIDER_TYPES.openAICompatible;
    case REMOTE_PROVIDERS.sayd:
      return PROVIDER_TYPES.sayd;
  }
}

export function getSystemProviderInstanceId(
  providerType: ProviderType,
): string {
  switch (providerType) {
    case PROVIDER_TYPES.sayd:
      return SYSTEM_PROVIDER_INSTANCE_IDS.sayd;
    case PROVIDER_TYPES.localWhisper:
      return SYSTEM_PROVIDER_INSTANCE_IDS.localWhisper;
    case PROVIDER_TYPES.openRouter:
      return SYSTEM_PROVIDER_INSTANCE_IDS.openRouter;
    case PROVIDER_TYPES.ollama:
      return SYSTEM_PROVIDER_INSTANCE_IDS.ollama;
    case PROVIDER_TYPES.openAICompatible:
      return SYSTEM_PROVIDER_INSTANCE_IDS.openAICompatible;
  }
}

export function getProviderDisplayName(providerType: ProviderType): string {
  switch (providerType) {
    case PROVIDER_TYPES.sayd:
      return "Sayd";
    case PROVIDER_TYPES.localWhisper:
      return "Local";
    case PROVIDER_TYPES.openRouter:
      return REMOTE_PROVIDERS.openRouter;
    case PROVIDER_TYPES.ollama:
      return REMOTE_PROVIDERS.ollama;
    case PROVIDER_TYPES.openAICompatible:
      return REMOTE_PROVIDERS.openAICompatible;
  }
}
