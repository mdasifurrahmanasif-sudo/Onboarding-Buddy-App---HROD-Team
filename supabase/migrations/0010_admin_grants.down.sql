begin;

drop trigger if exists profiles_apply_admin_grant on public.profiles;
drop function if exists public.apply_admin_grant();
drop table if exists public.admin_grants;

commit;
