"use client";

import { SettingsRow } from "./settings-row";
import { LANGUAGE_NAMES, useLocale } from "@/lib/i18n/locale-provider";
import { routes } from "@/lib/routes";

export function LanguageSettingsRow() {
  const { locale } = useLocale();
  return <SettingsRow icon="languages" title="Language" value={LANGUAGE_NAMES[locale]} href={routes.settingsLanguage} />;
}
