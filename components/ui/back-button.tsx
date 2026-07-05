"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";

export function BackButton({ fallback = "/home" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button
      className="iconbtn"
      aria-label="Back"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
    >
      <Icon name="back" />
    </button>
  );
}

export function BackButtonBordered({ fallback = "/home" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button
      className="iconbtn bordered"
      aria-label="Back"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
    >
      <Icon name="back" />
    </button>
  );
}
