import type { AppSettingsData } from "../schema";

// v6 -> v7: previously added default global shortcut for creating a new note (removed)
export function migrateToV7(data: unknown): AppSettingsData {
  const oldData = data as AppSettingsData;
  return { ...oldData };
}
