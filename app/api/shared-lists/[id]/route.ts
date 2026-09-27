import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { looksLikeListId } from "@/lib/shared-list-id";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

function failure(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { data: { user }, error: authError } = await supabaseServer().auth.getUser();
    if (authError || !user) return failure(401, "Sign in to open this list.");

    const { id } = await params;
    if (!looksLikeListId(id)) return failure(400, "Invalid shared list link.");

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceKey || !url) return failure(503, "Shared lists are temporarily unavailable.");

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: row, error } = await admin
      .from("shared_lists")
      .select("id, title, place_ids, created_at")
      .eq("id", id)
      .maybeSingle();

    if (error) return failure(500, "Could not load the shared list.");
    if (!row) return failure(404, "This shared list is unavailable.");

    return NextResponse.json({
      id: row.id,
      title: row.title,
      place_ids: row.place_ids,
      created_at: row.created_at,
    }, { status: 200, headers });
  } catch {
    return failure(500, "Could not load the shared list.");
  }
}
