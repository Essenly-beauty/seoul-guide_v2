create schema if not exists internal;
revoke all on schema internal from public, anon, authenticated;

create table public.places (
  id text primary key,
  type text not null,
  zone text not null,
  name text not null,
  name_kr text not null,
  address text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  publication_state text not null default 'draft'
    check (publication_state in ('draft', 'published', 'hidden')),
  business_state text not null default 'unknown'
    check (business_state in ('open', 'temporarily_closed', 'closed', 'unknown')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = id),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  source_checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.places enable row level security;
revoke all on public.places from public, anon, authenticated;
grant select on public.places to anon, authenticated;
create policy places_read_published on public.places
  for select to anon, authenticated using (publication_state = 'published');
create index places_public_type_zone_idx on public.places (type, zone, id)
  where publication_state = 'published';

create table internal.place_source_records (
  id bigint generated always as identity primary key,
  place_id text not null,
  source_name text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = place_id),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  observed_at timestamptz,
  imported_at timestamptz not null default now(),
  unique (place_id, source_name, payload_sha256)
);
create index place_source_records_place_id_idx on internal.place_source_records (place_id);
alter table internal.place_source_records enable row level security;
revoke all on internal.place_source_records from public, anon, authenticated;
