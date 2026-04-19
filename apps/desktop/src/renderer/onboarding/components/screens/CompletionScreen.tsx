import React from "react";
import { Card } from "@/components/ui/card";

import { Separator } from "@/components/ui/separator";
import { OnboardingLayout } from "../shared/OnboardingLayout";
import { NavigationButtons } from "../shared/NavigationButtons";
import { OnboardingMicrophoneSelect } from "../shared/OnboardingMicrophoneSelect";
import { OnboardingShortcutInput } from "../shared/OnboardingShortcutInput";
import { CheckCircle, Settings, Info } from "lucide-react";
import { useTranslation } from "react-i18next";

interface CompletionScreenProps {
  onComplete: () => void;
  onBack: () => void;
}

/**
 * Completion screen - final screen showing setup is complete
 */
export function CompletionScreen({
  onComplete,
  onBack,
}: CompletionScreenProps) {
  const { t } = useTranslation();
  return (
    <OnboardingLayout
      title={t("onboarding.completion.title")}
      titleIcon={<CheckCircle className="h-7 w-7 text-green-500" />}
      footer={
        <NavigationButtons
          onComplete={onComplete}
          onBack={onBack}
          showBack={true}
          showNext={false}
          showComplete={true}
          completeLabel={t("onboarding.completion.start")}
        />
      }
    >
      <div className="space-y-6">
        {/* Quick Configuration */}
        <Card className="p-6">
          <h3 className="mb-4 font-medium flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {t("onboarding.completion.quickConfig.title")}
          </h3>
          <div className="space-y-4">
            <OnboardingMicrophoneSelect />
            <Separator />
            <OnboardingShortcutInput />
          </div>
        </Card>

        {/* Next Steps */}
        <Card className="border-primary/20 bg-primary/5 px-6 gap-2">
          <h3 className="font-medium">
            {t("onboarding.completion.next.title")}
          </h3>
          <div>
            <div className="flex items-start gap-2">
              <span className="text-sm font-medium text-primary">•</span>
              <p className="text-sm">
                {t("onboarding.completion.next.items.pushToTalk")}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sm font-medium text-primary">•</span>
              <p className="text-sm">
                {t("onboarding.completion.next.items.widget")}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sm font-medium text-primary">•</span>
              <p className="text-sm">
                {t("onboarding.completion.next.items.settings")}
              </p>
            </div>
          </div>
        </Card>

        {/* Info Note */}
        <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
          <Info className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {t("onboarding.completion.info")}
          </p>
        </div>
      </div>
    </OnboardingLayout>
  );
}
