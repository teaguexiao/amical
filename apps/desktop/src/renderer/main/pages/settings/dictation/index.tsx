import { Card, CardContent } from "@/components/ui/card";
import { MicrophoneSettings } from "./components";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";

export default function DictationSettingsPage() {
  const { t } = useTranslation();
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold">{t("settings.dictation.title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("settings.dictation.description")}
        </p>
      </div>
      <Card>
        <CardContent className="space-y-4">
          <MicrophoneSettings />
          <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
            <Info className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">
              {t("settings.dictation.autoDetectInfo", {
                defaultValue: "Language is automatically detected during transcription. No manual selection is needed.",
              })}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
