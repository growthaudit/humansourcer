-- Supabase's performance advisor flags multiple permissive SELECT policies
-- for the same role as suboptimal (each is evaluated separately per query).
-- Consolidate "active" + "recently inactive (grace window)" into one policy
-- with the equivalent OR condition — same effective access, one evaluation.
drop policy if exists "public can read active roles" on public.roles;
drop policy if exists "public can read recently inactive roles" on public.roles;

create policy "public can read active or recently inactive roles"
  on public.roles for select to anon
  using (is_active = true or (is_active = false and last_seen_at > now() - interval '14 days'));
