begin;

create table if not exists public.menu_item_option_settings (
  menu_item_id uuid primary key references public.menu_items (id) on delete cascade,
  sugar_enabled boolean not null default true,
  ice_enabled boolean not null default true,
  standard_toppings_enabled boolean not null default true,
  cream_toppings_enabled boolean not null default true,
  default_sugar_level_id uuid references public.menu_option_levels (id) on delete set null,
  default_ice_level_id uuid references public.menu_option_levels (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_item_toppings (
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  topping_id uuid not null references public.menu_toppings (id) on delete cascade,
  primary key (menu_item_id, topping_id)
);

create index if not exists menu_item_toppings_topping_id_idx
  on public.menu_item_toppings (topping_id);

drop trigger if exists set_menu_item_option_settings_updated_at on public.menu_item_option_settings;
create trigger set_menu_item_option_settings_updated_at
  before update on public.menu_item_option_settings
  for each row execute function public.set_menu_catalog_updated_at();

grant select on public.menu_item_option_settings, public.menu_item_toppings to anon;
grant select, insert, update, delete on public.menu_item_option_settings, public.menu_item_toppings to authenticated;

alter table public.menu_item_option_settings enable row level security;
alter table public.menu_item_toppings enable row level security;

drop policy if exists "Public can view menu item option settings" on public.menu_item_option_settings;
create policy "Public can view menu item option settings"
  on public.menu_item_option_settings for select to anon
  using (true);

drop policy if exists "Authenticated users can view menu item option settings" on public.menu_item_option_settings;
create policy "Authenticated users can view menu item option settings"
  on public.menu_item_option_settings for select to authenticated
  using (true);

drop policy if exists "Admins can manage menu item option settings" on public.menu_item_option_settings;
create policy "Admins can manage menu item option settings"
  on public.menu_item_option_settings for all to authenticated
  using (public.is_dashboard_admin())
  with check (public.is_dashboard_admin());

drop policy if exists "Public can view menu item toppings" on public.menu_item_toppings;
create policy "Public can view menu item toppings"
  on public.menu_item_toppings for select to anon
  using (true);

drop policy if exists "Authenticated users can view menu item toppings" on public.menu_item_toppings;
create policy "Authenticated users can view menu item toppings"
  on public.menu_item_toppings for select to authenticated
  using (true);

drop policy if exists "Admins can manage menu item toppings" on public.menu_item_toppings;
create policy "Admins can manage menu item toppings"
  on public.menu_item_toppings for all to authenticated
  using (public.is_dashboard_admin())
  with check (public.is_dashboard_admin());

commit;
