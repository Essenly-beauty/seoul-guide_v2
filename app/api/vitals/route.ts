import { NextResponse } from "next/server";
import { normalizeVitalsPayload } from "@/lib/web-vitals-payload";

// Public beacon sink for real-user Core Web Vitals (see
// components/system/web-vitals-reporter.tsx). Same-origin only, body capped,
// every field validated, inserted under the anon key into the write-only
// web_vitals table. Failures are 204 too — a metrics hiccup must never
// surface in the visitor's console.

const MAX_BODY = 2048;
const NO_STORE = { "cache-control": "no-store" };

function sameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true; // sendBeacon may omit Origin on same-origin posts
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new NextResponse(null, { status: 403, headers: NO_STORE });
  const raw = await req.text();
  if (raw.length > MAX_BODY) return new NextResponse(null, { status: 413, headers: NO_STORE });
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400, headers: NO_STORE });
  }
  const row = normalizeVitalsPayload(parsed);
  if (!row) return new NextResponse(null, { status: 400, headers: NO_STORE });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      await fetch(`${url}/rest/v1/web_vitals`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          ...row,
          user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
          release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
        }),
      });
    } catch {
      // best effort
    }
  }
  return new NextResponse(null, { status: 204, headers: NO_STORE });
}
