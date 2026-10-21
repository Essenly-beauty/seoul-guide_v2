"use client";

import { useLocale } from "@/lib/i18n/locale-provider";
import { useRouter } from "next/navigation";
import { IconButton } from "@/components/ui/icon-button";

export function BackButton({ fallback = "/home" }: { fallback?: string }) {
  const router = useRouter();
  const { t } = useLocale();
  return (
    <IconButton
      name="back"
      label={t("Back")}
      iconSize="md"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
    />
  );
}

export function BackButtonBordered({ fallback = "/home" }: { fallback?: string }) {
  const router = useRouter();
  const { t } = useLocale();
  return (
    <IconButton
      name="back"
      label={t("Back")}
      variant="overlay"
      iconSize="md"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
    />
  );
}
