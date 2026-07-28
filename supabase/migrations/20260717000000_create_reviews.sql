create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reviewer_name text not null check (char_length(trim(reviewer_name)) between 1 and 120),
  rating smallint not null check (rating between 1 and 5),
  description text not null check (char_length(trim(description)) between 1 and 1000),
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.reviews to authenticated;

alter table public.reviews enable row level security;

create policy "Users can view their own reviews"
  on public.reviews
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own reviews"
  on public.reviews
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own reviews"
  on public.reviews
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own reviews"
  on public.reviews
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
