"use client";

import SpeechTab from "./tabs/SpeechTab";
import { useTranslation } from "react-i18next";

export default function AIModelsSettingsPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">{t("settings.aiModels.title")}</h1>
      <SpeechTab />
    </div>
  );
}
