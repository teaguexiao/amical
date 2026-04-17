import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { api } from "@/trpc/react";
import { ModelType } from "../../../../types/onboarding";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface ModelSetupModalProps {
  isOpen: boolean;
  onClose: (wasCompleted?: boolean) => void;
  modelType: ModelType;
  onContinue: () => void;
}

/**
 * Modal for setting up Sayd Cloud API key
 */
export function ModelSetupModal({
  isOpen,
  onClose,
  modelType,
  onContinue,
}: ModelSetupModalProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");

  const validateSaydMutation = api.models.validateSaydConnection.useMutation();
  const setSaydConfigMutation = api.settings.setSaydConfig.useMutation();

  const handleSaydSetup = async () => {
    if (!apiKeyInput.trim()) {
      setError(t("onboarding.modelSetup.cloud.error.apiKeyRequired"));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await validateSaydMutation.mutateAsync({
        apiKey: apiKeyInput.trim(),
      });

      if (!result.success) {
        setError(result.error || t("onboarding.modelSetup.cloud.error.invalidApiKey"));
        setIsLoading(false);
        return;
      }

      await setSaydConfigMutation.mutateAsync({
        apiKey: apiKeyInput.trim(),
      });

      toast.success(t("onboarding.modelSetup.cloud.success"));
      setIsLoading(false);
      onContinue();
    } catch (err) {
      console.error("Sayd setup error:", err);
      setError(t("onboarding.modelSetup.cloud.error.connectionFailed"));
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("onboarding.modelSetup.cloud.title")}</DialogTitle>
          <DialogDescription>
            {t("onboarding.modelSetup.cloud.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="sk-..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaydSetup()}
            />
            <p className="text-xs text-muted-foreground">
              {t("onboarding.modelSetup.cloud.getApiKey")}{" "}
              <a
                href="https://sayd.dev/signup"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                sayd.dev
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="space-x-2">
          <Button variant="outline" onClick={() => onClose(false)}>
            {t("onboarding.modelSetup.actions.cancel")}
          </Button>
          <Button onClick={handleSaydSetup} disabled={isLoading || !apiKeyInput.trim()}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("onboarding.navigation.continue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
