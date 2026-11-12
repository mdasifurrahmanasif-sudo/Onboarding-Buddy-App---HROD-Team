-- Admin roles managed from the admin site (System › Admins). One row per
-- person, keyed by enroll number so a grant can be made before they sign up.
--   super_admin   — everything, any journey
--   journey_admin — one journey's content + people (the existing HR admin)
--   hrbp          — view-only access to people in the listed SBUs
-- profiles.is_super_admin / is_hr_admin / admin_variant_id stay the flags the
-- rest of the app reads; this table is what sets them.

begin;

create table if not exists public.admin_grants (
  enroll_number text primary key,
  role text not null check (role in ('super_admin', 'journey_admin', 'hrbp')),
  variant_id uuid references public.onboarding_variants(id),
  sbus text[] not null default '{}',
  granted_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_grants_journey_admin_needs_variant check (role <> 'journey_admin' or variant_id is not null),
  constraint admin_grants_hrbp_needs_sbus check (role <> 'hrbp' or cardinality(sbus) > 0)
);

-- Only the service-role client (server actions) reads or writes grants.
alter table public.admin_grants enable row level security;
grant select, insert, update, delete on public.admin_grants to service_role;

-- Grants made before sign-up apply when the profile row is first created.
create or replace function public.apply_admin_grant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.admin_grants%rowtype;
begin
  select * into g from public.admin_grants where enroll_number = new.enroll_number;
  if found then
    new.is_super_admin := g.role = 'super_admin';
    new.is_hr_admin := g.role in ('super_admin', 'journey_admin');
    new.admin_variant_id := coalesce(g.variant_id, new.admin_variant_id);
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_apply_admin_grant on public.profiles;
create trigger profiles_apply_admin_grant
  before insert on public.profiles
  for each row execute function public.apply_admin_grant();

-- Backfill: everyone who is an admin today keeps exactly what they have.
insert into public.admin_grants (enroll_number, role, variant_id, granted_by)
select
  enroll_number,
  case when is_super_admin then 'super_admin' else 'journey_admin' end,
  admin_variant_id,
  'migration-0010'
from public.profiles
where is_super_admin or (is_hr_admin and admin_variant_id is not null)
on conflict (enroll_number) do nothing;

commit;
