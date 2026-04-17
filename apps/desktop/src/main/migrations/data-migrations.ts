import { logger } from "../logger";
import { db } from "../../db";
import { getAppSettings, updateAppSettings } from "../../db/app-settings";
import { seedDailyStats } from "../../db/daily-stats";
import { transcriptions } from "../../db/schema";
import { countWords, toLocalStatsDate } from "../../utils/dictation-stats";

const DICTATION_DAILY_STATS_MIGRATION_VERSION = 2;

async function persistDataMigrationVersion(
  currentDataMigrations: Record<string, number>,
  migrationKey: string,
  version: number,
): Promise<Record<string, number>> {
  const nextDataMigrations = {
    ...currentDataMigrations,
    [migrationKey]: version,
  };

  await updateAppSettings({
    dataMigrations: nextDataMigrations,
  });

  return nextDataMigrations;
}

async function migrateDictationDailyStats(): Promise<{
  transcriptionsChecked: number;
  statsDaysWritten: number;
}> {
  const existingTranscriptions = await db
    .select({
      text: transcriptions.text,
      timestamp: transcriptions.timestamp,
      language: transcriptions.language,
    })
    .from(transcriptions);

  const statsByDate = new Map<
    string,
    {
      wordCount: number;
      transcriptionCount: number;
      createdAt: Date;
      updatedAt: Date;
    }
  >();

  for (const transcription of existingTranscriptions) {
    const wordCount = countWords(transcription.text, transcription.language);

    const timestamp =
      transcription.timestamp instanceof Date
        ? transcription.timestamp
        : new Date(transcription.timestamp);
    const date = toLocalStatsDate(timestamp);
    const existingBucket = statsByDate.get(date);

    if (existingBucket) {
      existingBucket.wordCount += wordCount;
      existingBucket.transcriptionCount += 1;
      if (timestamp < existingBucket.createdAt) {
        existingBucket.createdAt = timestamp;
      }
      if (timestamp > existingBucket.updatedAt) {
        existingBucket.updatedAt = timestamp;
      }
      continue;
    }

    statsByDate.set(date, {
      wordCount,
      transcriptionCount: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  await seedDailyStats(
    Array.from(statsByDate.entries()).map(([date, bucket]) => ({
      date,
      wordCount: bucket.wordCount,
      transcriptionCount: bucket.transcriptionCount,
      createdAt: bucket.createdAt,
      updatedAt: bucket.updatedAt,
    })),
  );

  return {
    transcriptionsChecked: existingTranscriptions.length,
    statsDaysWritten: statsByDate.size,
  };
}

export async function runDataMigrations(): Promise<void> {
  try {
    const settings = await getAppSettings();
    let currentDataMigrations = settings.dataMigrations ?? {};

    if (
      (currentDataMigrations.dictationDailyStats ?? 0) <
      DICTATION_DAILY_STATS_MIGRATION_VERSION
    ) {
      const startTime = Date.now();
      logger.db.info("Running dictation daily stats migration", {
        dictationDailyStatsFrom: currentDataMigrations.dictationDailyStats ?? 0,
        dictationDailyStatsTo: DICTATION_DAILY_STATS_MIGRATION_VERSION,
      });

      const { transcriptionsChecked, statsDaysWritten } =
        await migrateDictationDailyStats();

      currentDataMigrations = await persistDataMigrationVersion(
        currentDataMigrations,
        "dictationDailyStats",
        DICTATION_DAILY_STATS_MIGRATION_VERSION,
      );

      logger.db.info("Dictation daily stats migration complete", {
        transcriptionsChecked,
        statsDaysWritten,
        durationMs: Date.now() - startTime,
      });
    }
  } catch (error) {
    logger.db.error("Data migrations failed", error);
  }
}
