-- Daily "rate your day" (1-5) with an optional comment. One row per person
-- per onboarding day. Only the service-role client reads/writes it; admin
-- screens show aggregates and comments without names.
begin;

create table if not exists public.day_ratings (
  enroll_number text not null,
  day_number int not null check (day_number between 1 and 90),
  rating int not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  rated_at timestamptz not null default now(),
  primary key (enroll_number, day_number)
);

alter table public.day_ratings enable row level security;
grant select, insert, update, delete on public.day_ratings to service_role;

commit;
