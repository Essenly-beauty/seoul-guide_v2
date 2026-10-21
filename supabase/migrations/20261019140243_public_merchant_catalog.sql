-- Platform approval publishes service information only. It never enables booking.
create table public.merchant_publications (
  merchant_id uuid primary key references public.merchants(id) on delete cascade,
  place_id text not null unique check (place_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$'),
  published boolean not null default false
);
alter table public.merchant_publications enable row level security;
revoke all on public.merchant_publications from public, anon, authenticated;
grant all on public.merchant_publications to service_role;

-- Denormalized, allowlisted projection: do not grant anonymous access to source tables.
create table public.published_merchant_catalogs (
  merchant_id uuid primary key references public.merchants(id) on delete cascade,
  place_id text not null unique,
  services jsonb not null check (jsonb_typeof(services) = 'array')
);
alter table public.published_merchant_catalogs enable row level security;
revoke all on public.published_merchant_catalogs from public, anon, authenticated;
grant select (place_id, services) on public.published_merchant_catalogs to anon, authenticated;
grant all on public.published_merchant_catalogs to service_role;
create policy public_catalog_read on public.published_merchant_catalogs for select to anon, authenticated using (true);

-- Match JavaScript trim(), including NBSP and Unicode space separators.
create function private.catalog_text(value text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select btrim(value, E' \t\n\r\f\v' || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
$$;
revoke all on function private.catalog_text(text) from public, anon, authenticated;

-- Trigger-only SECURITY DEFINER, in the private schema, with no client EXECUTE.
create function private.refresh_merchant_catalog(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Serialize refreshes for this merchant before reading the latest committed source.
  perform pg_advisory_xact_lock(hashtextextended(target::text, 617923));
  delete from public.published_merchant_catalogs where merchant_id = target;
  insert into public.published_merchant_catalogs (merchant_id, place_id, services)
  select p.merchant_id, p.place_id, coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'category', private.catalog_text(c.name_en),
      'name', private.catalog_text(s.name_en),
      'description', private.catalog_text(s.description_en),
      'priceKrw', s.price_krw,
      'durationMinutes', s.duration_minutes
    ) order by c.sort_order, c.id, s.sort_order, s.id)
    from public.merchant_services s
    join public.merchant_categories c on c.id = s.category_id and c.merchant_id = s.merchant_id
    where s.merchant_id = target and s.visibility = 'visible' and c.visibility = 'visible'
      and private.catalog_text(c.name_en) <> ''
      and private.catalog_text(s.name_en) <> ''
      and private.catalog_text(s.description_en) <> ''
      and s.price_krw is not null and s.duration_minutes is not null
  ), '[]'::jsonb)
  from public.merchant_publications p
  join public.merchants m on m.id = p.merchant_id
  where p.merchant_id = target and p.published and m.status = 'active';
end;
$$;
revoke all on function private.refresh_merchant_catalog(uuid) from public, anon, authenticated;

create function private.sync_merchant_catalog() returns trigger
language plpgsql security definer set search_path = '' as $$
declare old_id uuid; new_id uuid; target uuid;
begin
  if tg_op <> 'INSERT' then
    if tg_table_name = 'merchants' then old_id := old.id; else old_id := old.merchant_id; end if;
  end if;
  if tg_op <> 'DELETE' then
    if tg_table_name = 'merchants' then new_id := new.id; else new_id := new.merchant_id; end if;
  end if;
  for target in select distinct value from unnest(array[old_id, new_id]) value where value is not null order by value loop
    perform private.refresh_merchant_catalog(target);
  end loop;
  return null;
end;
$$;
revoke all on function private.sync_merchant_catalog() from public, anon, authenticated;
create trigger public_catalog_sync after insert or update or delete on public.merchant_publications for each row execute function private.sync_merchant_catalog();
create trigger public_catalog_sync after insert or update or delete on public.merchant_services for each row execute function private.sync_merchant_catalog();
create trigger public_catalog_sync after insert or update or delete on public.merchant_categories for each row execute function private.sync_merchant_catalog();
create trigger public_catalog_sync after update or delete on public.merchants for each row execute function private.sync_merchant_catalog();
-- No seed mappings: an operator must verify the real place ID and merchant ownership.
