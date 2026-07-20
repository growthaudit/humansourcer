create policy "public can read active roles" on public.roles for select to anon using (is_active = true);
