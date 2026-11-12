-- Phone (web push) devices. One person can have many devices; the endpoint
-- is unique per browser install. Only the service-role client touches it.
begin;

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  enroll_number text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_enroll_idx on public.push_subscriptions (enroll_number);

alter table public.push_subscriptions enable row level security;
grant select, insert, update, delete on public.push_subscriptions to service_role;

commit;
