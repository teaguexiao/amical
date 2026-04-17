"use client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Cloud, Key, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TooltipContent,
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function SpeechTab() {
  const { t } = useTranslation();
  const [showSaydApiKeyDialog, setShowSaydApiKeyDialog] = useState(false);
  const [saydApiKeyInput, setSaydApiKeyInput] = useState("");
  const [isSaydValidating, setIsSaydValidating] = useState(false);

  const utils = api.useUtils();

  // Sayd config
  const modelProvidersConfigQuery =
    api.settings.getModelProvidersConfig.useQuery();
  const isSaydConfigured = !!modelProvidersConfigQuery.data?.sayd?.apiKey;

  const validateSaydMutation = api.models.validateSaydConnection.useMutation({
    onSuccess: (result) => {
      setIsSaydValidating(false);
      if (result.success) {
        setSaydConfigMutation.mutate({ apiKey: saydApiKeyInput.trim() });
      } else {
        toast.error(
          t("settings.aiModels.provider.toast.validationFailed", {
            provider: "Sayd",
            message: result.error || "",
          }),
        );
      }
    },
    onError: (error) => {
      setIsSaydValidating(false);
      toast.error(
        t("settings.aiModels.provider.toast.validationError", {
          provider: "Sayd",
          message: error.message,
        }),
      );
    },
  });

  const setSaydConfigMutation = api.settings.setSaydConfig.useMutation({
    onSuccess: () => {
      toast.success(
        t("settings.aiModels.provider.toast.configSaved", {
          provider: "Sayd",
        }),
      );
      modelProvidersConfigQuery.refetch();
      setShowSaydApiKeyDialog(false);
      setSaydApiKeyInput("");
    },
    onError: () => {
      toast.error(
        t("settings.aiModels.provider.toast.configSaveFailed", {
          provider: "Sayd",
        }),
      );
    },
  });

  return (
    <>
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            <Avatar className="w-10 h-10">
              <AvatarImage src="/assets/icon_logo.svg" alt="Sayd" />
              <AvatarFallback>S</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Sayd Cloud</h3>
                <Badge variant="secondary" className="text-xs">
                  All-in-One
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("settings.aiModels.speech.saydDescription", {
                  defaultValue:
                    "Real-time cloud transcription with built-in LLM text cleaning, language auto-detection, and formatting — all in one API.",
                })}
              </p>
              <TooltipProvider>
                <div className="flex flex-wrap gap-2 pt-2">
                  {[
                    { icon: "☁️", label: t("settings.aiModels.speech.saydFeatures.cloud", { defaultValue: "Cloud Processing" }) },
                    { icon: "⚡", label: t("settings.aiModels.speech.saydFeatures.realtime", { defaultValue: "Real-time Streaming" }) },
                    { icon: "✨", label: t("settings.aiModels.speech.saydFeatures.cleaning", { defaultValue: "LLM Text Cleaning" }) },
                    { icon: "🌐", label: t("settings.aiModels.speech.saydFeatures.multilingual", { defaultValue: "Multilingual" }) },
                  ].map((feature) => (
                    <Tooltip key={feature.label}>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-xs gap-1 cursor-help">
                          <span>{feature.icon}</span>
                          {feature.label}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>{feature.label}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            </div>
          </div>

          <div className="border rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isSaydConfigured ? (
                <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Check className="w-4 h-4 text-green-500" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Key className="w-4 h-4 text-blue-500" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium">
                  {isSaydConfigured
                    ? t("settings.aiModels.speech.apiKeyConfigured", { defaultValue: "API Key Configured" })
                    : t("settings.aiModels.speech.apiKeyRequired", { defaultValue: "API Key Required" })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isSaydConfigured
                    ? t("settings.aiModels.speech.apiKeyConfiguredDesc", { defaultValue: "Sayd Cloud is ready to use." })
                    : t("settings.aiModels.speech.apiKeyRequiredDesc", { defaultValue: "Enter your API key to start using Sayd Cloud." })}
                </p>
              </div>
            </div>
            <Button
              variant={isSaydConfigured ? "outline" : "default"}
              size="sm"
              onClick={() => setShowSaydApiKeyDialog(true)}
            >
              {isSaydConfigured
                ? t("settings.aiModels.speech.changeApiKey", { defaultValue: "Change Key" })
                : t("settings.aiModels.speech.configureApiKey", { defaultValue: "Configure" })}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={showSaydApiKeyDialog}
        onOpenChange={(open) => {
          setShowSaydApiKeyDialog(open);
          if (!open) {
            setSaydApiKeyInput("");
            setIsSaydValidating(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("settings.aiModels.speech.saydDialog.title", {
                defaultValue: "Configure Sayd",
              })}
            </DialogTitle>
            <DialogDescription>
              {t("settings.aiModels.speech.saydDialog.description", {
                defaultValue:
                  "Enter your Sayd API key to use cloud transcription with built-in text cleaning.",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              type="password"
              placeholder={t("settings.aiModels.provider.placeholders.sayd")}
              value={saydApiKeyInput}
              onChange={(e) => setSaydApiKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && saydApiKeyInput.trim()) {
                  setIsSaydValidating(true);
                  validateSaydMutation.mutate({
                    apiKey: saydApiKeyInput.trim(),
                  });
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSaydApiKeyDialog(false)}
            >
              {t("settings.aiModels.provider.removeDialog.cancel")}
            </Button>
            <Button
              onClick={() => {
                if (saydApiKeyInput.trim()) {
                  setIsSaydValidating(true);
                  validateSaydMutation.mutate({
                    apiKey: saydApiKeyInput.trim(),
                  });
                }
              }}
              disabled={!saydApiKeyInput.trim() || isSaydValidating}
            >
              {isSaydValidating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("settings.aiModels.provider.buttons.validating")}
                </>
              ) : (
                t("settings.aiModels.provider.buttons.connect")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
