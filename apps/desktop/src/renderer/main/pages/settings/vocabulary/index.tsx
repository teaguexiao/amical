import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function VocabularySettingsPage() {
  const { t } = useTranslation();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold">
          {t("settings.vocabulary.title")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("settings.vocabulary.description")}
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <Badge variant="secondary" className="mb-3 text-xs">
            Coming Soon
          </Badge>
          <h3 className="text-lg font-semibold mb-2">
            {t("settings.vocabulary.comingSoon.title", {
              defaultValue: "Custom Vocabulary",
            })}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {t("settings.vocabulary.comingSoon.description", {
              defaultValue:
                "Custom vocabulary and text replacements will be available in a future update. This feature will allow you to add specialized terms and correction rules to improve transcription accuracy.",
            })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
