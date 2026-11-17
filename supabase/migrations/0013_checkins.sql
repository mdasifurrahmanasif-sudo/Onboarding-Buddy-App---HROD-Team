-- 15-day check-in ("Hey, just checking on you") for new joiners: one answer
-- per person per check-in day (15, 30, 45, 60). Service role only; admin
-- screens show totals and comments without names.
begin;

create table if not exists public.checkins (
  enroll_number text not null,
  day_number int not null check (day_number in (15, 30, 45, 60)),
  mood text not null check (mood in ('good', 'mixed', 'bad')),
  comment text check (comment is null or char_length(comment) <= 1000),
  answered_at timestamptz not null default now(),
  primary key (enroll_number, day_number)
);

alter table public.checkins enable row level security;
grant select, insert, update, delete on public.checkins to service_role;

commit;
