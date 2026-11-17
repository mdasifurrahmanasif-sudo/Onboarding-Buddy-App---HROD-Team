select cron.unschedule('daily-rating-5pm') where exists (select 1 from cron.job where jobname = 'daily-rating-5pm');
drop table if exists public.day_ratings;
