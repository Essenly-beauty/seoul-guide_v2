-- Structured operational context for feedback such as place corrections.
-- Existing notes remain valid; public clients still have no read policy.
alter table public.feedback
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Data API grants and RLS are separate layers. Keep the existing insert-only
-- RLS policy while explicitly exposing only INSERT to browser roles.
grant insert on table public.feedback to anon, authenticated;
