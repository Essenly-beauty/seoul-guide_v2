-- User feedback inbox. Guests and members can submit; nobody can read
-- through the public API (no select policy) — the team reads with the
-- service role. This replaces the prototype's localStorage-only sink
-- (launch audit P0-3).

create table if not exists public.feedback (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users (id) on delete set null,
  category   text        not null check (category in ('bug', 'idea', 'place', 'other')),
  message    text        not null check (char_length(message) between 1 and 2000),
  contact_ok boolean     not null default false,
  page       text        not null check (char_length(page) <= 300),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "feedback_insert_any" on public.feedback;
create policy "feedback_insert_any"
  on public.feedback for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- no select/update/delete policies: submissions are write-only via the API
