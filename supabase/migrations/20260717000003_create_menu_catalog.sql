create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null check (char_length(trim(description)) between 1 and 300),
  sort_order integer not null check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.menu_categories (id) on delete cascade,
  name text not null unique check (char_length(trim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null check (char_length(trim(description)) between 1 and 1000),
  image_url text not null check (image_url ~ '^https?://'),
  price_from numeric(10, 2) not null check (price_from >= 0),
  price_to numeric(10, 2) not null check (price_to >= price_from),
  sizes text not null check (char_length(trim(sizes)) between 1 and 200),
  ingredients text not null check (char_length(trim(ingredients)) between 1 and 1000),
  calories text not null check (char_length(trim(calories)) between 1 and 60),
  allergens text not null check (char_length(trim(allergens)) between 1 and 200),
  is_available boolean not null default true,
  sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index menu_items_category_id_sort_order_idx on public.menu_items (category_id, sort_order);

create or replace function public.set_menu_catalog_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_menu_categories_updated_at
  before update on public.menu_categories
  for each row execute function public.set_menu_catalog_updated_at();

create trigger set_menu_items_updated_at
  before update on public.menu_items
  for each row execute function public.set_menu_catalog_updated_at();

grant select on public.menu_categories, public.menu_items to anon;
grant select, insert, update, delete on public.menu_categories, public.menu_items to authenticated;

alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;

create policy "Public can view active menu categories"
  on public.menu_categories
  for select
  to anon
  using (is_active = true);

create policy "Authenticated users can view menu categories"
  on public.menu_categories
  for select
  to authenticated
  using (true);

create policy "Authenticated users can manage menu categories"
  on public.menu_categories
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Public can view available menu items"
  on public.menu_items
  for select
  to anon
  using (
    is_available = true
    and exists (
      select 1 from public.menu_categories
      where menu_categories.id = menu_items.category_id
        and menu_categories.is_active = true
    )
  );

create policy "Authenticated users can view menu items"
  on public.menu_items
  for select
  to authenticated
  using (true);

create policy "Authenticated users can manage menu items"
  on public.menu_items
  for all
  to authenticated
  using (true)
  with check (true);
