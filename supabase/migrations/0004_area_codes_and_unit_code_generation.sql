-- Areas/Sub-Areas need short codes to build permanent Unit IDs like
-- SET-DK-000001 (spec section 4). Units/sub_areas tables are still empty at
-- this point, so adding NOT NULL columns needs no default/backfill.
-- Run this once in Supabase SQL Editor (Dashboard > SQL Editor > New query > paste > Run)

alter table public.areas add column code text not null unique;

alter table public.sub_areas add column code text not null;
alter table public.sub_areas add constraint sub_areas_area_code_unique unique (area_id, code);

-- Auto-generates units.unit_code as {area.code}-{sub_area.code}-{6-digit seq}
-- so the app never keys it in manually (spec section 40). The sequence is a
-- plain count-per-sub-area, not a DB sequence object — simplest thing that
-- works for Phase 1's low write concurrency (a handful of admins). The
-- unit_code UNIQUE constraint (0001) is the safety net: a race would fail
-- the insert loudly instead of silently duplicating a code. Move to a real
-- per-sub-area sequence if concurrent unit creation becomes common.
create or replace function public.generate_unit_code()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_area_code text;
  v_sub_area_code text;
  v_seq int;
begin
  if new.unit_code is not null and new.unit_code <> '' then
    return new;
  end if;

  select a.code, sa.code into v_area_code, v_sub_area_code
  from public.sub_areas sa
  join public.areas a on a.id = sa.area_id
  where sa.id = new.sub_area_id;

  select count(*) + 1 into v_seq from public.units where sub_area_id = new.sub_area_id;

  new.unit_code := v_area_code || '-' || v_sub_area_code || '-' || lpad(v_seq::text, 6, '0');
  return new;
end;
$$;

create trigger trg_generate_unit_code
before insert on public.units
for each row execute function public.generate_unit_code();
