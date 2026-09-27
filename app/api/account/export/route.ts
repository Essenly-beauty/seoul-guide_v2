import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Current account export: profile, saved places, ratings and reviews.
// Queries run under the caller's own session (RLS) — no service role here.
function unavailable() {
  return NextResponse.json({ error: "Your data could not be exported right now. Please try again." }, {
    status: 503,
    headers: { "cache-control": "private, no-store" },
  });
}

export async function GET() {
  try {
    const supabase = supabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) return unavailable();
    if (!user) return NextResponse.json({ error: "Sign in to export your data." }, {
      status: 401,
      headers: { "cache-control": "private, no-store" },
    });

    const [favorites, ratings, profile] = await Promise.all([
      supabase.from("favorites").select("kind, item_id, created_at").order("created_at"),
      supabase.from("ratings").select("place_id, rating, body, created_at, updated_at").order("created_at"),
      supabase.from("profiles").select("data, updated_at").maybeSingle(),
    ]);
    if (favorites.error || ratings.error || profile.error ||
        !Array.isArray(favorites.data) || !Array.isArray(ratings.data)) {
      return unavailable();
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name ?? null,
        createdAt: user.created_at,
      },
      beautyProfile: profile.data?.data ?? null,
      favorites: favorites.data,
      ratings: ratings.data,
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": 'attachment; filename="myseouldrop-data.json"',
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return unavailable();
  }
}
