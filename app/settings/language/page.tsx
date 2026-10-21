"use client";

import { useState } from "react";
import { TopBar } from "@/components/ui/top-bar";
import { BackButton } from "@/components/ui/back-button";
import { LANGUAGE_NAMES, LOCALES, useLocale, type Locale } from "@/lib/i18n/locale-provider";
import { routes } from "@/lib/routes";
import styles from "./page.module.css";

const names: Record<Locale, string> = { en: "English", ja: "Japanese", "zh-CN": "Chinese (Simplified)", es: "Spanish", fr: "French" };

export default function LanguagePage() {
  const { locale, setLocale, t } = useLocale();
  const [changed, setChanged] = useState(false);
  return (
    <>
      <TopBar left={<BackButton fallback={routes.settings} />} title="Language" />
      <main className={`app-scroll pad ${styles.page}`}>
        <h1 className="sr-only">{t("App language")}</h1>
        <p className={styles.description}>{t("Choose the language for the app. Your choice is saved on this device.")}</p>
        <fieldset className={styles.options}>
          <legend className="sr-only">{t("App language")}</legend>
          {LOCALES.map((option) => (
            <label className={styles.option} key={option}>
              <span className={styles.copy}>
                <span lang={option} className={styles.nativeName}>{LANGUAGE_NAMES[option]}</span>
                {LANGUAGE_NAMES[option] !== t(names[option]) && <span className={styles.translatedName}>{t(names[option])}</span>}
              </span>
              <input type="radio" name="language" value={option} checked={locale === option} onChange={() => { setLocale(option); setChanged(true); }} />
            </label>
          ))}
        </fieldset>
        <p className={styles.status} role="status" aria-live="polite">{changed ? t("Language updated") : ""}</p>
      </main>
    </>
  );
}
