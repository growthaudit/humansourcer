-- Structured numeric pay, populated ONLY by scrapers with genuine structured
-- rate data (vetto, mercor today). NEVER derived by re-parsing pay_text —
-- e.g. Turing's pay_text is a referral bonus, not job pay, and must stay
-- null here.
alter table public.roles
  add column if not exists pay_min numeric,
  add column if not exists pay_max numeric,
  add column if not exists pay_currency text,
  add column if not exists pay_unit text; -- raw source unit e.g. 'HOURLY' | 'PER_PACKAGE' | 'hr'

comment on column public.roles.pay_min is 'Structured numeric pay floor. Only vetto/mercor scrapers populate this. Do not backfill from pay_text.';
comment on column public.roles.pay_unit is 'Raw source pay unit/frequency string; src/lib/jsonld.ts maps this to a Google-supported baseSalary unitText (HOUR only, currently).';

-- Required for the inactive-role grace-window pages: build-time reads use
-- the publishable key, which the existing "public can read active roles"
-- policy blocks for is_active=false rows entirely. This is a narrow,
-- time-bounded relaxation (14-day window matching the app-level grace
-- period), not a blanket "expose all inactive rows" policy. Permissive RLS
-- policies OR together, so the combined effect is exactly
-- "active, or gone within the last 14 days".
create policy "public can read recently inactive roles"
  on public.roles for select to anon
  using (is_active = false and last_seen_at > now() - interval '14 days');
