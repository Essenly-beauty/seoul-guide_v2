-- Public projection contains no account identifiers or auth.users metadata.
create schema review_internal;
revoke all on schema review_internal from public, anon, authenticated;

create table public.published_reviews (
  id uuid primary key references public.ratings(id) on delete cascade,
  place_id text not null,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (btrim(body) <> ''),
  updated_at timestamptz not null
);
alter table public.published_reviews enable row level security;
revoke all on public.published_reviews from public, anon, authenticated;
grant select on public.published_reviews to anon, authenticated;
grant all on public.published_reviews to service_role;
create policy published_reviews_read on public.published_reviews
  for select to anon, authenticated using (true);
create index published_reviews_place_idx on public.published_reviews(place_id, updated_at desc);

-- Trigger-only privilege boundary: source writes are authorized by ratings RLS.
-- This must also run for moderation and account deletion without a user JWT.
-- No schema usage or EXECUTE is granted to API roles; no user-supplied SQL.
create function review_internal.sync_published_review()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    delete from public.published_reviews where id = old.id;
    return old;
  end if;
  if new.is_public and not new.hidden and new.body is not null and btrim(new.body) <> '' then
    insert into public.published_reviews(id,place_id,rating,body,updated_at)
      values(new.id,new.place_id,new.rating,new.body,new.updated_at)
      on conflict(id) do update set place_id=excluded.place_id,
        rating=excluded.rating,body=excluded.body,updated_at=excluded.updated_at;
  else
    delete from public.published_reviews where id = new.id;
  end if;
  return new;
end $$;
revoke all on function review_internal.sync_published_review() from public, anon, authenticated;
create trigger ratings_sync_public_projection after insert or update or delete
  on public.ratings for each row execute function review_internal.sync_published_review();

insert into public.published_reviews(id,place_id,rating,body,updated_at)
  select id,place_id,rating,body,updated_at from public.ratings
  where is_public and not hidden and body is not null and btrim(body) <> '';

revoke all on public.ratings from public, anon, authenticated;
-- An invoker view needs only these columns for the ownership lookup.
-- Existing owner-only SELECT RLS returns no source rows for anon.
grant select(id,user_id) on public.ratings to anon;
grant select, delete on public.ratings to authenticated;
grant insert(user_id,place_id,rating,body,is_public),
  update(user_id,place_id,rating,body,is_public) on public.ratings to authenticated;

revoke all on public.review_reports from public, anon, authenticated;
grant insert(rating_id,reporter,reason) on public.review_reports to authenticated;
revoke all on function public.auto_hide_reported_review() from public, anon, authenticated;

create or replace view public.public_reviews with (security_invoker = true) as
  select p.id,p.place_id,p.rating,p.body,p.updated_at,'User'::text as display_name,
    exists(select 1 from public.ratings r where r.id=p.id and r.user_id=(select auth.uid())) as mine
  from public.published_reviews p;
revoke all on public.public_reviews from public, anon, authenticated;
grant select on public.public_reviews to anon, authenticated;
