import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { bookingList } from "@/lib/booking/contracts";
import { bookingCommunicationExport } from "@/lib/booking/communication-contracts";

// Current account export: profile, saved places, ratings, reviews and own bookings.
// Queries run under the caller's own session (RLS) — no service role here.
function unavailable() {
  return NextResponse.json({ error: "Your data could not be exported right now. Please try again." }, {
    status: 503,
    headers: { "cache-control": "private, no-store" },
  });
}

function signInRequired() {
  return NextResponse.json({ error: "Sign in to export your data." }, {
    status: 401,
    headers: { "cache-control": "private, no-store" },
  });
}

export async function GET() {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError?.name === "AuthSessionMissingError") return signInRequired();
    if (authError) return unavailable();
    if (!user) return signInRequired();

    const [favorites, ratings, profile, bookings, communications] = await Promise.all([
      supabase.from("favorites").select("kind, item_id, created_at").order("created_at"),
      supabase.from("ratings").select("place_id, rating, body, created_at, updated_at").order("created_at"),
      supabase.from("profiles").select("data, updated_at").maybeSingle(),
      supabase.rpc("booking_list", { p_partner: false }),
      supabase.rpc("booking_communications_export"),
    ]);
    if (favorites.error || ratings.error || profile.error || bookings.error !== null ||
        communications.error !== null || !Array.isArray(favorites.data) || !Array.isArray(ratings.data) ||
        !bookingList(bookings.data) || !bookingCommunicationExport(communications.data)) {
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
      bookings: bookings.data,
      bookingMessages: communications.data.messages,
      customerNotes: communications.data.customerNotes,
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
