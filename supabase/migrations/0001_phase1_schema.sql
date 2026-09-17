-- Bizlocate Listing System — Phase 1 schema + RLS
-- Run this once in Supabase SQL Editor (Dashboard > SQL Editor > New query > paste > Run)

create extension if not exists pgcrypto;

-- ============================================================
-- TABLES
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role text not null default 'sp' check (role in ('super_admin','area_admin','sp')),
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now()
);

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now()
);

create table public.sub_areas (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas(id) on delete restrict,
  name text not null,
  population text,
  consumer_type text,
  commercial_profile text,
  remarks text,
  created_at timestamptz not null default now(),
  unique (area_id, name)
);

create table public.area_admins (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  area_id uuid not null references public.areas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, area_id)
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  unit_code text not null unique,
  sub_area_id uuid not null references public.sub_areas(id) on delete restrict,
  jalan text,
  unit_no text,
  full_address text not null,
  lat double precision,
  lng double precision,
  facing text,
  property_type text,
  land_type text,
  tenure text,
  tenure_years integer,
  cf boolean,
  iwk boolean,
  hakmilik text,
  unit_size numeric,
  unit_size_type text,
  location_url text,
  banner_status text,
  remarks text,
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.unit_spaces (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  floor_type text not null,
  floor_label text not null,
  size numeric,
  size_type text,
  separate_owner boolean not null default false,
  status text not null default 'active' check (status in ('active','archived')),
  remarks text,
  created_at timestamptz not null default now()
);

create table public.unit_photos (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  space_id uuid references public.unit_spaces(id) on delete set null,
  url text not null,
  photo_type text not null default 'property' check (photo_type in ('cover','property','banner')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.unit_documents (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  doc_type text not null check (doc_type in ('ic','hakmilik','other')),
  url text not null,
  uploaded_by uuid references public.profiles(id),
  restricted boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.owners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  primary_contact text,
  other_contact text,
  ic_or_company_no text,
  owner_type text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','possible_owner','verified_owner','wrong_contact')),
  contact_status text not null default 'not_contacted' check (contact_status in ('not_contacted','no_answer','contacted','follow_up','wrong_number','do_not_contact')),
  remarks text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  last_verified_date date
);

create table public.unit_ownerships (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  space_id uuid references public.unit_spaces(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete restrict,
  is_primary boolean not null default true,
  start_date date not null default current_date,
  end_date date,
  created_at timestamptz not null default now()
);

create table public.unit_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references public.profiles(id),
  area_id uuid references public.areas(id),
  sub_area_id uuid references public.sub_areas(id),
  jalan text,
  unit_no text,
  address text not null,
  lat double precision,
  lng double precision,
  discovery_type text not null check (discovery_type in ('vacant','banner','target_unit','other')),
  banner_phone text,
  remarks text,
  photo_url text,
  status text not null default 'pending' check (status in ('pending','linked','converted')),
  matched_unit_id uuid references public.units(id),
  created_at timestamptz not null default now()
);

create table public.owner_search_tasks (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  space_id uuid references public.unit_spaces(id) on delete cascade,
  status text not null default 'need_search' check (status in ('need_search','number_found','contacting','owner_confirmed','wrong_number','unable_to_reach','follow_up_later')),
  assigned_to uuid references public.profiles(id),
  found_contact text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.price_ranges (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  min_value numeric not null,
  max_value numeric,
  sort_order integer not null default 0
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  space_id uuid references public.unit_spaces(id) on delete cascade,
  listing_type text not null check (listing_type in ('rent','sale','rent_sale')),
  asking_rental numeric,
  selling_price numeric,
  rented_price numeric,
  availability text,
  listing_status text not null default 'draft' check (listing_status in ('draft','pending_verification','available','reserved','rented','sold','owner_occupied','not_for_rent','inactive','archived')),
  exclusive boolean not null default false,
  exclusive_date date,
  exclusive_by uuid references public.profiles(id),
  banner_status text,
  available_from date,
  last_verified_date date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  remarks text
);

create table public.listing_status_history (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now(),
  remarks text
);

create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  reason text not null check (reason in ('have_tenant','arrange_viewing','rental_negotiation','listing_verification','other')),
  tenant_company text,
  business_type text,
  budget numeric,
  move_in_date date,
  remarks text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.contact_access_logs (
  id uuid primary key default gen_random_uuid(),
  contact_request_id uuid not null references public.contact_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  owner_id uuid not null references public.owners(id),
  unit_id uuid not null references public.units(id),
  listing_id uuid not null references public.listings(id),
  reason text,
  approved_by uuid references public.profiles(id),
  approval_date timestamptz not null default now(),
  access_start timestamptz not null default now(),
  access_expiry timestamptz not null,
  revoked boolean not null default false
);

create table public.listing_status_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reported_by uuid not null references public.profiles(id),
  report_type text not null check (report_type in ('still_available','rented','sold','owner_not_renting','price_changed','cannot_contact','wrong_contact','other')),
  remarks text,
  status text not null default 'pending_review' check (status in ('pending_review','confirmed','rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  user_id uuid references public.profiles(id),
  entity_type text not null,
  entity_id uuid,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index on public.sub_areas (area_id);
create index on public.area_admins (area_id);
create index on public.units (sub_area_id);
create index on public.units (status);
create index on public.unit_spaces (unit_id);
create index on public.unit_photos (unit_id);
create index on public.unit_documents (unit_id);
create index on public.unit_ownerships (unit_id);
create index on public.unit_ownerships (owner_id);
create index on public.unit_submissions (submitted_by);
create index on public.unit_submissions (status);
create index on public.owner_search_tasks (unit_id);
create index on public.owner_search_tasks (status);
create index on public.listings (unit_id);
create index on public.listings (listing_status);
create index on public.listing_status_history (listing_id);
create index on public.contact_requests (listing_id);
create index on public.contact_requests (requested_by);
create index on public.contact_requests (status);
create index on public.contact_access_logs (listing_id);
create index on public.contact_access_logs (user_id);
create index on public.listing_status_reports (listing_id);
create index on public.activities (entity_type, entity_id);
create index on public.audit_logs (entity_type, entity_id);

-- ============================================================
-- HELPER FUNCTIONS (security definer: bypass RLS for the lookup itself,
-- so policies elsewhere can check role/area without recursive RLS issues)
-- ============================================================

create or replace function public.current_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_area_admin_for_area(p_area_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.area_admins where profile_id = auth.uid() and area_id = p_area_id
  );
$$;

create or replace function public.area_id_for_sub_area(p_sub_area_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select area_id from public.sub_areas where id = p_sub_area_id;
$$;

create or replace function public.area_id_for_unit(p_unit_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select sa.area_id from public.units u
  join public.sub_areas sa on sa.id = u.sub_area_id
  where u.id = p_unit_id;
$$;

create or replace function public.area_id_for_listing(p_listing_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select public.area_id_for_unit(unit_id) from public.listings where id = p_listing_id;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.areas enable row level security;
alter table public.sub_areas enable row level security;
alter table public.area_admins enable row level security;
alter table public.units enable row level security;
alter table public.unit_spaces enable row level security;
alter table public.unit_photos enable row level security;
alter table public.unit_documents enable row level security;
alter table public.owners enable row level security;
alter table public.unit_ownerships enable row level security;
alter table public.unit_submissions enable row level security;
alter table public.owner_search_tasks enable row level security;
alter table public.price_ranges enable row level security;
alter table public.listings enable row level security;
alter table public.listing_status_history enable row level security;
alter table public.contact_requests enable row level security;
alter table public.contact_access_logs enable row level security;
alter table public.listing_status_reports enable row level security;
alter table public.activities enable row level security;
alter table public.audit_logs enable row level security;

-- profiles: everyone sees own row, super_admin sees all; self can update own row, super_admin can update any
create policy "profiles_select" on public.profiles for select
  using (id = auth.uid() or public.is_super_admin());
create policy "profiles_insert_self" on public.profiles for insert
  with check (id = auth.uid());
create policy "profiles_update_self" on public.profiles for update
  using (id = auth.uid());
create policy "profiles_update_super_admin" on public.profiles for update
  using (public.is_super_admin());

-- area_admins: super_admin manages assignments, admins can see own assignments
create policy "area_admins_select" on public.area_admins for select
  using (profile_id = auth.uid() or public.is_super_admin());
create policy "area_admins_write_super_admin" on public.area_admins for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- areas / sub_areas: readable by all logged-in users (needed for filters/browsing), write = super_admin only
create policy "areas_select_all" on public.areas for select
  using (auth.role() = 'authenticated');
create policy "areas_write_super_admin" on public.areas for all
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy "sub_areas_select_all" on public.sub_areas for select
  using (auth.role() = 'authenticated');
create policy "sub_areas_write_super_admin" on public.sub_areas for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- units / unit_spaces / unit_photos: readable by all logged-in users (no owner PII here),
-- write restricted to super_admin or the area admin of that unit's area
create policy "units_select_all" on public.units for select
  using (auth.role() = 'authenticated');
create policy "units_insert_admin" on public.units for insert
  with check (public.is_super_admin() or public.is_area_admin_for_area(public.area_id_for_sub_area(sub_area_id)));
create policy "units_update_admin" on public.units for update
  using (public.is_super_admin() or public.is_area_admin_for_area(public.area_id_for_sub_area(sub_area_id)));

create policy "unit_spaces_select_all" on public.unit_spaces for select
  using (auth.role() = 'authenticated');
create policy "unit_spaces_write_admin" on public.unit_spaces for all
  using (public.is_super_admin() or public.is_area_admin_for_area(public.area_id_for_unit(unit_id)))
  with check (public.is_super_admin() or public.is_area_admin_for_area(public.area_id_for_unit(unit_id)));

create policy "unit_photos_select_all" on public.unit_photos for select
  using (auth.role() = 'authenticated');
create policy "unit_photos_write_admin" on public.unit_photos for all
  using (public.is_super_admin() or public.is_area_admin_for_area(public.area_id_for_unit(unit_id)))
  with check (public.is_super_admin() or public.is_area_admin_for_area(public.area_id_for_unit(unit_id)));

-- unit_documents: admin-only, never SP (IC / hakmilik)
create policy "unit_documents_admin_only" on public.unit_documents for all
  using (public.is_super_admin() or public.is_area_admin_for_area(public.area_id_for_unit(unit_id)))
  with check (public.is_super_admin() or public.is_area_admin_for_area(public.area_id_for_unit(unit_id)));

-- owners: admin-only (super_admin all, area_admin scoped via any linked unit, or the admin who created it)
create policy "owners_admin_scoped" on public.owners for all
  using (
    public.is_super_admin()
    or created_by = auth.uid()
    or exists (
      select 1 from public.unit_ownerships uo
      where uo.owner_id = owners.id
        and public.is_area_admin_for_area(public.area_id_for_unit(uo.unit_id))
    )
  )
  with check (
    public.is_super_admin()
    or (public.current_role() = 'area_admin' and created_by = auth.uid())
  );

-- unit_ownerships: admin-only, scoped to unit's area
create policy "unit_ownerships_admin_scoped" on public.unit_ownerships for all
  using (public.is_super_admin() or public.is_area_admin_for_area(public.area_id_for_unit(unit_id)))
  with check (public.is_super_admin() or public.is_area_admin_for_area(public.area_id_for_unit(unit_id)));

-- unit_submissions: SP inserts/sees own, admin sees/updates scoped to area
create policy "unit_submissions_insert_self" on public.unit_submissions for insert
  with check (submitted_by = auth.uid());
create policy "unit_submissions_select" on public.unit_submissions for select
  using (
    submitted_by = auth.uid()
    or public.is_super_admin()
    or (area_id is not null and public.is_area_admin_for_area(area_id))
  );
create policy "unit_submissions_update_admin" on public.unit_submissions for update
  using (public.is_super_admin() or (area_id is not null and public.is_area_admin_for_area(area_id)));

-- owner_search_tasks: admin-only (SP has no access to the search queue)
create policy "owner_search_tasks_admin_scoped" on public.owner_search_tasks for all
  using (public.is_super_admin() or public.is_area_admin_for_area(public.area_id_for_unit(unit_id)))
  with check (public.is_super_admin() or public.is_area_admin_for_area(public.area_id_for_unit(unit_id)));

-- price_ranges: readable by all, write = super_admin only
create policy "price_ranges_select_all" on public.price_ranges for select
  using (auth.role() = 'authenticated');
create policy "price_ranges_write_super_admin" on public.price_ranges for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- listings: readable by all logged-in users (no owner data in this table), write = admin scoped to unit's area
create policy "listings_select_all" on public.listings for select
  using (auth.role() = 'authenticated');
create policy "listings_insert_admin" on public.listings for insert
  with check (public.is_super_admin() or public.is_area_admin_for_area(public.area_id_for_unit(unit_id)));
create policy "listings_update_admin" on public.listings for update
  using (public.is_super_admin() or public.is_area_admin_for_area(public.area_id_for_unit(unit_id)));

-- listing_status_history: written only by the trigger below (security definer, bypasses RLS); admin-only read
create policy "listing_status_history_select_admin" on public.listing_status_history for select
  using (public.is_super_admin() or public.is_area_admin_for_area(public.area_id_for_listing(listing_id)));

-- contact_requests: SP creates/sees own, admin sees/approves scoped to area
create policy "contact_requests_insert_self" on public.contact_requests for insert
  with check (requested_by = auth.uid());
create policy "contact_requests_select" on public.contact_requests for select
  using (
    requested_by = auth.uid()
    or public.is_super_admin()
    or public.is_area_admin_for_area(public.area_id_for_listing(listing_id))
  );
create policy "contact_requests_update_admin" on public.contact_requests for update
  using (public.is_super_admin() or public.is_area_admin_for_area(public.area_id_for_listing(listing_id)));

-- contact_access_logs: the user sees own access, admin sees/manages scoped to area
create policy "contact_access_logs_select" on public.contact_access_logs for select
  using (
    user_id = auth.uid()
    or public.is_super_admin()
    or public.is_area_admin_for_area(public.area_id_for_listing(listing_id))
  );
create policy "contact_access_logs_insert_admin" on public.contact_access_logs for insert
  with check (public.is_super_admin() or public.is_area_admin_for_area(public.area_id_for_listing(listing_id)));
create policy "contact_access_logs_update_admin" on public.contact_access_logs for update
  using (public.is_super_admin() or public.is_area_admin_for_area(public.area_id_for_listing(listing_id)));

-- listing_status_reports: SP creates/sees own, admin sees/confirms scoped to area
create policy "listing_status_reports_insert_self" on public.listing_status_reports for insert
  with check (reported_by = auth.uid());
create policy "listing_status_reports_select" on public.listing_status_reports for select
  using (
    reported_by = auth.uid()
    or public.is_super_admin()
    or public.is_area_admin_for_area(public.area_id_for_listing(listing_id))
  );
create policy "listing_status_reports_update_admin" on public.listing_status_reports for update
  using (public.is_super_admin() or public.is_area_admin_for_area(public.area_id_for_listing(listing_id)));

-- activities: any authenticated user can log their own action; only admins can browse the timeline.
-- ponytail: area-scoping for area_admin is not enforced at DB level yet (role-only gate) — tighten
-- with a per-entity area check if this ever needs to be precise before Phase 2.
create policy "activities_insert_self" on public.activities for insert
  with check (actor_id = auth.uid());
create policy "activities_select_admin" on public.activities for select
  using (public.is_super_admin() or public.current_role() = 'area_admin');

-- audit_logs: any authenticated action logs itself; only super_admin can read (per role matrix); immutable (no update/delete policy)
create policy "audit_logs_insert_self" on public.audit_logs for insert
  with check (user_id = auth.uid());
create policy "audit_logs_select_super_admin" on public.audit_logs for select
  using (public.is_super_admin());

-- ============================================================
-- AUTOMATION
-- ============================================================

-- new auth.users signup -> auto-create profile, defaults to 'sp' (promote via SQL for the first admin)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'sp');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- listing status change -> auto-append history row (bypasses RLS via security definer, so no insert policy needed)
create or replace function public.log_listing_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'UPDATE' and new.listing_status is distinct from old.listing_status) then
    insert into public.listing_status_history (listing_id, old_status, new_status, changed_by)
    values (new.id, old.listing_status, new.listing_status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_listing_status_history
after update on public.listings
for each row execute function public.log_listing_status_change();

-- Available Listing: auto-derived from listings, never a copied table (security_invoker so
-- the querying user's own RLS applies, not the view owner's)
create view public.available_listings
with (security_invoker = true) as
select
  l.id, l.unit_id, l.space_id, l.listing_type, l.asking_rental, l.selling_price,
  l.availability, l.exclusive, l.banner_status, l.available_from, l.last_verified_date, l.remarks,
  u.unit_code, u.jalan, u.unit_no, u.full_address, u.facing, u.property_type, u.lat, u.lng,
  sa.name as sub_area_name, a.name as area_name,
  us.floor_type, us.floor_label, us.size, us.size_type
from public.listings l
join public.units u on u.id = l.unit_id
join public.sub_areas sa on sa.id = u.sub_area_id
join public.areas a on a.id = sa.area_id
left join public.unit_spaces us on us.id = l.space_id
where l.listing_status = 'available';

-- ============================================================
-- SEED
-- ============================================================

insert into public.price_ranges (label, min_value, max_value, sort_order) values
  ('Below RM5,000', 0, 5000, 1),
  ('RM5,000–RM10,000', 5000, 10000, 2),
  ('RM10,001–RM20,000', 10001, 20000, 3),
  ('RM20,001–RM50,000', 20001, 50000, 4),
  ('Above RM50,000', 50001, null, 5);

-- ============================================================
-- MANUAL STEP AFTER RUNNING THIS FILE
-- ============================================================
-- 1. Sign up your first user through the app (or Supabase Auth dashboard).
-- 2. Promote that user to super_admin:
--    update public.profiles set role = 'super_admin' where id = '<their auth.users id>';
