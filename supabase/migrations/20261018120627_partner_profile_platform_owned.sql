revoke update on table public.merchants from public, anon, authenticated;
revoke update (display_name, contact_email, contact_phone, address, business_types) on table public.merchants from public, anon, authenticated;
drop policy if exists partner_update on public.merchants;
