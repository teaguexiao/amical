"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import SpeechTab from "./tabs/SpeechTab";
import EmbeddingTab from "./tabs/EmbeddingTab";
import { useNavigate, getRouteApi } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

const routeApi = getRouteApi("/settings/ai-models");

export default function AIModelsSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tab } = routeApi.useSearch();

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">{t("settings.aiModels.title")}</h1>
      <Tabs
        value={tab === "language" ? "speech" : tab}
        onValueChange={(newTab) => {
          navigate({
            to: "/settings/ai-models",
            search: { tab: newTab as "speech" | "embedding" },
          });
        }}
        className="w-full"
      >
        <TabsList className="mb-6">
          <TabsTrigger value="speech" className="text-base">
            All-in-One
          </TabsTrigger>
          <TabsTrigger value="embedding" className="text-base">
            {t("settings.aiModels.tabs.embedding")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="speech">
          <SpeechTab />
        </TabsContent>
        <TabsContent value="embedding">
          <EmbeddingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
