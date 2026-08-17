"use client";

// Self-hosted client error tracking: window errors, unhandled rejections,
// and React error boundaries insert into the write-only `client_errors`
// table. Guardrails keep it from becoming its own incident:
//  - session cap (an error loop can't flood the table)
//  - per-message dedupe within the session
//  - browser-extension frames ignored
//  - reporting failures are swallowed (never recurse)

import { supabaseBrowser } from "./supabase/client";

const SESSION_CAP = 10;
const reported = new Set<string>();
let count = 0;
let wired = false;

function release(): string | null {
  return process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null;
}

export function reportClientError(
  kind: "error" | "unhandledrejection" | "boundary" | "csp",
  message: string,
  stack?: string | null,
): void {
  try {
    if (typeof window === "undefined") return;
    const msg = (message || "unknown").slice(0, 500);
    // Next.js control-flow "errors" leak into window.onerror during client
    // navigation — they are not failures (first real catch of this tracker).
    if (msg.includes("NEXT_REDIRECT") || msg.includes("NEXT_NOT_FOUND")) return;
    if (count >= SESSION_CAP || reported.has(msg)) return;
    if (stack?.includes("chrome-extension://") || stack?.includes("safari-extension://")) return;
    reported.add(msg);
    count++;
    const supabase = supabaseBrowser();
    const userId = null; // attribution is not worth an auth call in a crash path
    void supabase.from("client_errors").insert({
      kind,
      message: msg,
      stack: stack ? stack.slice(0, 4000) : null,
      page: window.location.pathname.slice(0, 300),
      user_agent: navigator.userAgent.slice(0, 300),
      release: release(),
      user_id: userId,
    }).then(() => { /* best effort — never surface reporting failures */ });
  } catch {
    // never let the reporter throw
  }
}

/** Wire the global listeners once (mounted from the root layout). */
export function initErrorReporter(): void {
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener("error", (event) => {
    reportClientError("error", event.message ?? String(event.error ?? "unknown"), event.error?.stack ?? null);
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason ?? "unhandled rejection");
    reportClientError("unhandledrejection", message, reason instanceof Error ? reason.stack ?? null : null);
  });
  // CSP is enforced (next.config B10) — a violated directive doesn't throw,
  // it silently blocks. Surface regressions in client_errors instead.
  window.addEventListener("securitypolicyviolation", (event) => {
    reportClientError(
      "csp",
      `CSP blocked ${event.violatedDirective}: ${event.blockedURI || "inline"}`,
      `${event.sourceFile ?? ""}:${event.lineNumber ?? 0}`,
    );
  });
}
