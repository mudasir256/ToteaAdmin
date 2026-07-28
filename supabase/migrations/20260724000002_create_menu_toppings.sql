begin;

create table public.menu_toppings (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
    check (
      char_length(trim(name)) >= 1
      and char_length(trim(name)) <= 80
    ),
  category text not null
    check (category in ('standard', 'cream')),
  image_url text not null
    check (image_url ~ '^https?://'),
  price numeric(10, 2) not null default 0
    check (price >= 0),
  is_available boolean not null default true,
  sort_order integer not null default 0
    check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index menu_toppings_category_sort_order_idx
  on public.menu_toppings (category, sort_order);

create trigger set_menu_toppings_updated_at
  before update on public.menu_toppings
  for each row execute function public.set_menu_catalog_updated_at();

grant select on public.menu_toppings to anon;
grant select, insert, update, delete on public.menu_toppings to authenticated;

alter table public.menu_toppings enable row level security;

create policy "Public can view available menu toppings"
  on public.menu_toppings for select to anon
  using (is_available = true);

create policy "Authenticated users can view permitted menu toppings"
  on public.menu_toppings for select to authenticated
  using (is_available = true or public.is_dashboard_admin());

create policy "Admins can create menu toppings"
  on public.menu_toppings for insert to authenticated
  with check (public.is_dashboard_admin());

create policy "Admins can update menu toppings"
  on public.menu_toppings for update to authenticated
  using (public.is_dashboard_admin())
  with check (public.is_dashboard_admin());

create policy "Admins can delete menu toppings"
  on public.menu_toppings for delete to authenticated
  using (public.is_dashboard_admin());

commit;
