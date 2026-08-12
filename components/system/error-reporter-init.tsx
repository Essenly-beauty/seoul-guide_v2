"use client";

import { useEffect } from "react";
import { initErrorReporter } from "@/lib/error-reporter";

/** Mounts the global error listeners once, app-wide (root layout). */
export function ErrorReporterInit() {
  useEffect(() => {
    initErrorReporter();
  }, []);
  return null;
}
