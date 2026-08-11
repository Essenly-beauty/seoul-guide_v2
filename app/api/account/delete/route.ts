import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

// Permanent account deletion — the privacy policy promises it, so it must be
// real. The caller proves ownership via their session cookie; the service
// role performs the delete. DB rows cascade (favorites/profiles/ratings
// reference auth.users ON DELETE CASCADE; feedback keeps the note but drops
// the author via ON DELETE SET NULL).
export async function POST(request: Request) {
  // same-origin guard — session cookies are SameSite=Lax, but be explicit
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return NextResponse.json({ error: "Deletion is temporarily unavailable." }, { status: 503 });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: "Could not delete the account — try again." }, { status: 500 });
  }

  // clear this device's session cookies; local mirrors are purged client-side
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
