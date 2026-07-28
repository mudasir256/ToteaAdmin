drop policy if exists "Users can view their own reviews" on public.reviews;
drop policy if exists "Users can create their own reviews" on public.reviews;
drop policy if exists "Users can update their own reviews" on public.reviews;
drop policy if exists "Users can delete their own reviews" on public.reviews;

alter table public.reviews drop column user_id;

create policy "Authenticated users can create reviews"
  on public.reviews
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update reviews"
  on public.reviews
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete reviews"
  on public.reviews
  for delete
  to authenticated
  using (true);
