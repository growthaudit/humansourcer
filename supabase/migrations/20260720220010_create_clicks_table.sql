create table if not exists public.clicks (
  id bigint generated always as identity primary key,
  provider_slug text not null,
  target_url text not null,
  referrer text,
  clicked_at timestamptz not null default now()
);

create index if not exists clicks_provider_slug_clicked_at_idx
  on public.clicks (provider_slug, clicked_at desc);

alter table public.clicks enable row level security;

-- The /go/[slug] redirect route runs server-side on Vercel with only the
-- publishable (anon) key available (service_role is deliberately kept out
-- of Vercel, .env.local only). No select/update/delete policy exists for
-- anon, so inserted rows aren't publicly readable back out.
create policy "public can insert clicks"
  on public.clicks
  for insert
  to anon
  with check (true);
