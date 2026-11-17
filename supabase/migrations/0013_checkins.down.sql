select cron.unschedule('checkin-10am') where exists (select 1 from cron.job where jobname = 'checkin-10am');
drop table if exists public.checkins;
