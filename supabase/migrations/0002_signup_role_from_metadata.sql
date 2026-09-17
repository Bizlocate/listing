-- Public self-signup removed — users are now created by a Super Admin via
-- the Supabase Admin API (service_role key, server-only), which sets
-- user_metadata.role at creation time. Update the signup trigger to read
-- that role instead of always defaulting to 'sp'.
-- Run this once in Supabase SQL Editor (Dashboard > SQL Editor > New query > paste > Run)

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'sp')
  );
  return new;
end;
$$;
