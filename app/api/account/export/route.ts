import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Everything MYSEOULDROP stores about the signed-in user, as a JSON download.
// Queries run under the caller's own session (RLS) — no service role here.
export async function GET() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to export your data." }, { status: 401 });

  const [favorites, ratings, profile] = await Promise.all([
    supabase.from("favorites").select("kind, item_id, created_at").order("created_at"),
    supabase.from("ratings").select("place_id, rating, body, created_at, updated_at").order("created_at"),
    supabase.from("profiles").select("data, updated_at").maybeSingle(),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name ?? null,
      createdAt: user.created_at,
    },
    beautyProfile: profile.data?.data ?? null,
    favorites: favorites.data ?? [],
    ratings: ratings.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="myseouldrop-data.json"',
      "cache-control": "no-store",
    },
  });
}
