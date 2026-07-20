create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  provider_slug text not null,
  source_role_id text not null,
  title text not null,
  description text,
  pay_text text,
  location text,
  category text,
  apply_url text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_active boolean not null default true,
  constraint roles_provider_slug_source_role_id_key unique (provider_slug, source_role_id)
);

comment on table public.roles is 'Scraped individual role listings per provider. is_active=false marks a role no longer seen in the latest scrape, kept for history rather than deleted.';

create index if not exists roles_provider_slug_idx on public.roles (provider_slug);
create index if not exists roles_is_active_idx on public.roles (is_active);
