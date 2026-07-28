create policy "Public can view reviews"
  on public.reviews
  for select
  to anon, authenticated
  using (true);
