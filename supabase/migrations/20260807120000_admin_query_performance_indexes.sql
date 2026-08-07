-- Speed up admin dashboard list/order/overview queries.
create index if not exists orders_created_at_idx
  on public.orders (created_at desc);

create index if not exists orders_paid_created_at_idx
  on public.orders (created_at desc)
  where payment_status = 'paid';

create index if not exists profiles_role_created_at_idx
  on public.profiles (role, created_at desc);

create index if not exists menu_items_unavailable_sort_idx
  on public.menu_items (sort_order)
  where is_available = false;

create index if not exists inventory_items_active_qty_idx
  on public.inventory_items (is_active, current_quantity, minimum_quantity)
  where is_active = true;
