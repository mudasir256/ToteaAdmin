begin;

alter table public.profiles
  add column profile_image_url text,
  add column contact_number text,
  add column address_line_1 text,
  add column address_line_2 text,
  add column city text,
  add column state text,
  add column postal_code text,
  add column country text not null default 'US',
  add column role text not null default 'customer',
  add column updated_at timestamptz not null default now(),
  add constraint profiles_role_check check (role in ('admin', 'customer')),
  add constraint profiles_country_check check (country ~ '^[A-Z]{2}$'),
  add constraint profiles_profile_image_url_check check (
    profile_image_url is null or profile_image_url ~ '^https?://'
  );

-- Every profile that exists before this migration belongs to a dashboard teammate.
-- Customer profiles created after this migration keep the safe `customer` default.
update public.profiles set role = 'admin';

insert into public.profiles (id, full_name, email, role)
select
  users.id,
  coalesce(
    nullif(trim(users.raw_user_meta_data ->> 'full_name'), ''),
    split_part(users.email, '@', 1)
  ),
  users.email,
  'admin'
from auth.users as users
where users.email is not null
on conflict (id) do update set role = 'admin';

create or replace function public.is_dashboard_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke execute on function public.is_dashboard_admin() from public, anon;
grant execute on function public.is_dashboard_admin() to authenticated, service_role;

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_profile_updated_at();

create or replace function public.protect_profile_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) = 'service_role' or public.is_dashboard_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.email is distinct from old.email
    or new.role is distinct from old.role
    or new.created_at is distinct from old.created_at then
    raise exception 'Protected profile fields cannot be changed.';
  end if;

  return new;
end;
$$;

create trigger protect_profile_identity
  before update on public.profiles
  for each row execute function public.protect_profile_identity();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    'customer'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;

create policy "Customers can view their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Customers can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Admins can view every profile"
  on public.profiles for select to authenticated
  using (public.is_dashboard_admin());

create policy "Admins can update every profile"
  on public.profiles for update to authenticated
  using (public.is_dashboard_admin())
  with check (public.is_dashboard_admin());

grant select, update on public.profiles to authenticated;

create sequence public.orders_number_seq;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default (
    'TT-' || to_char(now(), 'YYMMDD') || '-' ||
    lpad(nextval('public.orders_number_seq')::text, 5, '0')
  ),
  user_id uuid references public.profiles (id) on delete set null,
  customer_details jsonb not null check (jsonb_typeof(customer_details) = 'object'),
  items jsonb not null check (
    jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0
  ),
  shipping_address jsonb not null check (jsonb_typeof(shipping_address) = 'object'),
  total numeric(10, 2) not null check (total > 0),
  order_status text not null default 'pending' check (
    order_status in (
      'pending', 'confirmed', 'processing', 'ready', 'completed',
      'cancelled', 'refunded'
    )
  ),
  payment_status text not null default 'pending' check (
    payment_status in ('pending', 'paid', 'failed', 'refunded', 'cancelled')
  ),
  payment_method text not null default 'square_card' check (
    payment_method = 'square_card'
  ),
  square_order_id text,
  square_payment_id text,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index orders_square_order_id_idx
  on public.orders (square_order_id)
  where square_order_id is not null;

create unique index orders_square_payment_id_idx
  on public.orders (square_payment_id)
  where square_payment_id is not null;

create index orders_user_created_at_idx
  on public.orders (user_id, created_at desc);

create index orders_status_created_at_idx
  on public.orders (order_status, created_at desc);

create or replace function public.set_order_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_orders_updated_at
  before update on public.orders
  for each row execute function public.set_order_updated_at();

alter table public.orders enable row level security;

grant select, update on public.orders to authenticated;

create policy "Customers can view their own orders"
  on public.orders for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Admins can view every order"
  on public.orders for select to authenticated
  using (public.is_dashboard_admin());

create policy "Admins can update every order"
  on public.orders for update to authenticated
  using (public.is_dashboard_admin())
  with check (public.is_dashboard_admin());

create table public.webhook_events (
  provider text not null,
  event_id text not null,
  event_type text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  primary key (provider, event_id)
);

alter table public.webhook_events enable row level security;
revoke all on public.webhook_events from anon, authenticated;

-- Public content stays readable, but only admins can change it.
drop policy if exists "Authenticated users can create reviews" on public.reviews;
drop policy if exists "Authenticated users can update reviews" on public.reviews;
drop policy if exists "Authenticated users can delete reviews" on public.reviews;

create policy "Admins can manage reviews"
  on public.reviews for all to authenticated
  using (public.is_dashboard_admin())
  with check (public.is_dashboard_admin());

drop policy if exists "Authenticated users can view menu categories" on public.menu_categories;
drop policy if exists "Authenticated users can manage menu categories" on public.menu_categories;
drop policy if exists "Authenticated users can view menu items" on public.menu_items;
drop policy if exists "Authenticated users can manage menu items" on public.menu_items;

create policy "Customers can view active menu categories"
  on public.menu_categories for select to authenticated
  using (is_active = true);

create policy "Admins can manage menu categories"
  on public.menu_categories for all to authenticated
  using (public.is_dashboard_admin())
  with check (public.is_dashboard_admin());

create policy "Customers can view available menu items"
  on public.menu_items for select to authenticated
  using (
    is_available = true
    and exists (
      select 1 from public.menu_categories
      where menu_categories.id = menu_items.category_id
        and menu_categories.is_active = true
    )
  );

create policy "Admins can manage menu items"
  on public.menu_items for all to authenticated
  using (public.is_dashboard_admin())
  with check (public.is_dashboard_admin());

drop policy if exists "Authenticated users can view inventory categories" on public.inventory_categories;
drop policy if exists "Authenticated users can create inventory categories" on public.inventory_categories;
drop policy if exists "Authenticated users can update inventory categories" on public.inventory_categories;
drop policy if exists "Authenticated users can delete unused inventory categories" on public.inventory_categories;
drop policy if exists "Authenticated users can view inventory items" on public.inventory_items;
drop policy if exists "Authenticated users can create inventory items" on public.inventory_items;
drop policy if exists "Authenticated users can update inventory items" on public.inventory_items;
drop policy if exists "Authenticated users can delete inventory items" on public.inventory_items;
drop policy if exists "Authenticated users can view inventory movements" on public.inventory_movements;

create policy "Admins can manage inventory categories"
  on public.inventory_categories for all to authenticated
  using (public.is_dashboard_admin())
  with check (public.is_dashboard_admin());

create policy "Admins can manage inventory items"
  on public.inventory_items for all to authenticated
  using (public.is_dashboard_admin())
  with check (public.is_dashboard_admin());

create policy "Admins can view inventory movements"
  on public.inventory_movements for select to authenticated
  using (public.is_dashboard_admin());

create or replace function public.adjust_inventory_stock(
  p_item_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_reason text
)
returns public.inventory_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.inventory_items;
  v_new_quantity numeric(12, 2);
  v_quantity_change numeric(12, 2);
begin
  if not public.is_dashboard_admin() then
    raise exception 'Dashboard administrator access is required.';
  end if;

  if p_movement_type not in ('stock_in', 'stock_out', 'adjustment') then
    raise exception 'Choose stock in, stock out, or adjustment.';
  end if;

  if p_quantity is null or p_quantity < 0 then
    raise exception 'Quantity must be zero or greater.';
  end if;

  if p_movement_type in ('stock_in', 'stock_out') and p_quantity = 0 then
    raise exception 'Quantity must be greater than zero.';
  end if;

  if p_reason is null or char_length(trim(p_reason)) not between 1 and 240 then
    raise exception 'A reason is required.';
  end if;

  select * into v_item
  from public.inventory_items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Inventory item was not found.';
  end if;

  if not v_item.is_active then
    raise exception 'Archived items cannot receive stock changes.';
  end if;

  if p_movement_type = 'stock_in' then
    v_new_quantity := v_item.current_quantity + p_quantity;
  elsif p_movement_type = 'stock_out' then
    v_new_quantity := v_item.current_quantity - p_quantity;
    if v_new_quantity < 0 then
      raise exception 'Stock out cannot be greater than the available quantity.';
    end if;
  else
    v_new_quantity := p_quantity;
  end if;

  v_quantity_change := v_new_quantity - v_item.current_quantity;
  if v_quantity_change = 0 then
    raise exception 'The stock quantity did not change.';
  end if;

  update public.inventory_items
  set current_quantity = v_new_quantity
  where id = p_item_id
  returning * into v_item;

  insert into public.inventory_movements (
    item_id, movement_type, quantity_change, previous_quantity,
    new_quantity, reason, created_by
  ) values (
    p_item_id, p_movement_type, v_quantity_change,
    v_item.current_quantity - v_quantity_change,
    v_item.current_quantity, trim(p_reason), auth.uid()
  );

  return v_item;
end;
$$;

-- Restrict both product and profile image storage writes.
drop policy if exists "Authenticated users can upload menu images" on storage.objects;
drop policy if exists "Authenticated users can update menu images" on storage.objects;
drop policy if exists "Authenticated users can delete menu images" on storage.objects;

create policy "Admins can upload menu images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = 'menu'
    and public.is_dashboard_admin()
  );

create policy "Admins can update menu images"
  on storage.objects for update to authenticated
  using (bucket_id = 'menu-images' and public.is_dashboard_admin())
  with check (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = 'menu'
    and public.is_dashboard_admin()
  );

create policy "Admins can delete menu images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'menu-images' and public.is_dashboard_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images', 'profile-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Customers can upload their profile image"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Customers can update their profile image"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-images'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_dashboard_admin()
    )
  )
  with check (
    bucket_id = 'profile-images'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_dashboard_admin()
    )
  );

create policy "Customers can delete their profile image"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-images'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_dashboard_admin()
    )
  );

commit;
