import * as React from "react";
import {
  IconWorldWww,
  IconInfoCircle,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import { NavMain } from "@/components/nav-main";
import {
  NavSecondary,
  type NavSecondaryItem,
} from "@/components/nav-secondary";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import {
  parseSidebarCtaPayload,
  SIDEBAR_CTA_FEATURE_FLAG,
} from "@/utils/feature-flags";
import { SettingsNavigationControls } from "./settings-navigation-controls";
import { SETTINGS_NAV_ITEMS } from "../lib/settings-navigation";

const dragRegion = { WebkitAppRegion: "drag" } as React.CSSProperties;
const noDragRegion = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

export function SettingsSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation();
  const { isMobile } = useSidebar();
  const sidebarCtaFlag = useFeatureFlag(SIDEBAR_CTA_FEATURE_FLAG);

  const sidebarCtaPayload = sidebarCtaFlag.enabled
    ? parseSidebarCtaPayload(sidebarCtaFlag.payload)
    : null;

  const navMain = SETTINGS_NAV_ITEMS.map(({ titleKey, url, icon }) => ({
    title: t(titleKey),
    url,
    icon: typeof icon === "string" ? undefined : icon,
  }));

  const baseNavSecondary: NavSecondaryItem[] = [
    {
      id: "website",
      title: t("settings.sidebar.website", { defaultValue: "Website" }),
      url: "https://sayd.dev/",
      icon: IconWorldWww,
    },
  ];

  const navSecondaryCta: NavSecondaryItem | null = sidebarCtaPayload
    ? {
        id: "sidebar-cta",
        title: sidebarCtaPayload.text,
        url: sidebarCtaPayload.url,
        icon: IconInfoCircle,
        ctaStyle: {
          palette: sidebarCtaPayload.palette,
          style: sidebarCtaPayload.style,
          emoji: sidebarCtaPayload.emoji,
        },
      }
    : null;

  const navSecondary: NavSecondaryItem[] = navSecondaryCta
    ? [navSecondaryCta, ...baseNavSecondary]
    : baseNavSecondary;

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <div
        className="relative h-[var(--titlebar-height)] shrink-0"
        style={dragRegion}
      >
        {isMobile ? (
          <SettingsNavigationControls
            className="absolute top-2.5"
            interactiveStyle={noDragRegion}
            style={{ ...noDragRegion, left: "var(--toolbar-left)" }}
          />
        ) : null}
      </div>
      <SidebarHeader className="py-0 -mb-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <div className="inline-flex items-center w-full">
                <img
                  src="assets/logo-wordmark.png"
                  alt={t("settings.sidebar.logoAlt")}
                  className="h-9 w-auto object-contain"
                />
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
    </Sidebar>
  );
}
