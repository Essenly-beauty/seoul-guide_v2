import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** .env.local loader — CI provides real env vars instead. */
export function loadEnv(): Record<string, string> {
  const fromFile: Record<string, string> = {};
  try {
    for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) {
      const i = line.indexOf("=");
      if (i > 0) fromFile[line.slice(0, i)] = line.slice(i + 1).replace(/^"|"$/g, "");
    }
  } catch { /* no .env.local (CI) */ }
  return { ...fromFile, ...process.env } as Record<string, string>;
}

export function adminClient(): SupabaseClient | null {
  const env = loadEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

/** Create (or replace) a confirmed test user; returns its id. */
export async function ensureUser(admin: SupabaseClient, email: string, password: string): Promise<string> {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const old = data?.users?.find((u) => u.email === email);
  if (old) await admin.auth.admin.deleteUser(old.id);
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !created.user) throw new Error(`createUser ${email}: ${error?.message}`);
  return created.user.id;
}
