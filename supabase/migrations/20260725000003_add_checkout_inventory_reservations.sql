begin;

create table public.inventory_order_reservations (
  order_id uuid not null
    references public.orders (id) on delete cascade,
  inventory_item_id uuid not null
    references public.inventory_items (id) on delete restrict,
  quantity numeric(12, 2) not null
    check (quantity > 0),
  status text not null default 'reserved'
    check (status in ('reserved', 'consumed', 'released')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (order_id, inventory_item_id)
);

create index inventory_order_reservations_active_item_idx
  on public.inventory_order_reservations (
    inventory_item_id,
    expires_at
  )
  where status = 'reserved';

create index inventory_order_reservations_status_idx
  on public.inventory_order_reservations (status, expires_at);

create trigger set_inventory_order_reservations_updated_at
  before update on public.inventory_order_reservations
  for each row execute function public.set_inventory_updated_at();

create or replace function public.sync_inventory_reservation_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.inventory_status = 'deducted'
    and old.inventory_status is distinct from new.inventory_status
  then
    update public.inventory_order_reservations
    set status = 'consumed'
    where order_id = new.id
      and status = 'reserved';
  elsif new.payment_status in ('failed', 'cancelled', 'refunded')
    and old.payment_status is distinct from new.payment_status
  then
    update public.inventory_order_reservations
    set status = 'released'
    where order_id = new.id
      and status = 'reserved';
  end if;

  return new;
end;
$$;

create trigger sync_inventory_reservation_status
  after update of inventory_status, payment_status
  on public.orders
  for each row execute function public.sync_inventory_reservation_status();

create or replace function public.get_public_menu_stock(
  p_menu_item_id uuid default null
)
returns table (
  menu_item_id uuid,
  size text,
  available_quantity integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with active_reservations as (
    select
      reservation.inventory_item_id,
      sum(reservation.quantity) as reserved_quantity
    from public.inventory_order_reservations as reservation
    where reservation.status = 'reserved'
      and reservation.expires_at > now()
    group by reservation.inventory_item_id
  ),
  menu_sizes as (
    select
      menu_item.id as menu_item_id,
      trim(size_name) as size,
      menu_item.is_available,
      menu_category.is_active as category_is_active
    from public.menu_items as menu_item
    join public.menu_categories as menu_category
      on menu_category.id = menu_item.category_id
    cross join lateral regexp_split_to_table(
      menu_item.sizes,
      ','
    ) as size_name
    where trim(size_name) <> ''
      and (
        p_menu_item_id is null
        or menu_item.id = p_menu_item_id
      )
  ),
  size_capacity as (
    select
      menu_size.menu_item_id,
      menu_size.size,
      menu_size.is_available,
      menu_size.category_is_active,
      count(recipe.id) as recipe_line_count,
      bool_and(inventory_item.is_active) as all_items_active,
      min(
        floor(
          greatest(
            inventory_item.current_quantity
              - coalesce(reservation.reserved_quantity, 0),
            0
          ) / recipe.quantity
        )
      ) as possible_quantity
    from menu_sizes as menu_size
    left join public.menu_item_recipes as recipe
      on recipe.menu_item_id = menu_size.menu_item_id
     and lower(trim(recipe.size)) = lower(menu_size.size)
    left join public.inventory_items as inventory_item
      on inventory_item.id = recipe.inventory_item_id
    left join active_reservations as reservation
      on reservation.inventory_item_id = inventory_item.id
    group by
      menu_size.menu_item_id,
      menu_size.size,
      menu_size.is_available,
      menu_size.category_is_active
  )
  select
    capacity.menu_item_id,
    capacity.size,
    case
      when capacity.is_available
        and capacity.category_is_active
        and capacity.recipe_line_count > 0
        and coalesce(capacity.all_items_active, false)
      then least(
        25,
        greatest(0, coalesce(capacity.possible_quantity, 0))::integer
      )
      else 0
    end as available_quantity
  from size_capacity as capacity
  order by capacity.menu_item_id, capacity.size;
$$;

create or replace function public.reserve_inventory_for_order(
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_missing_recipes text;
  v_requirement record;
  v_current_quantity numeric(12, 2);
  v_reserved_quantity numeric(12, 2);
  v_item_name text;
  v_item_active boolean;
  v_expires_at timestamptz := now() + interval '10 minutes';
  v_reservation_count integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role access is required.';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order was not found.';
  end if;

  if v_order.payment_status <> 'pending' then
    return jsonb_build_object(
      'status', 'invalid_order',
      'orderId', v_order.id
    );
  end if;

  if exists (
    select 1
    from public.inventory_order_reservations
    where order_id = v_order.id
      and status = 'reserved'
      and expires_at > now()
  ) then
    return jsonb_build_object(
      'status', 'reserved',
      'orderId', v_order.id,
      'reused', true
    );
  end if;

  update public.inventory_order_reservations
  set status = 'released'
  where order_id = v_order.id
    and status = 'reserved'
    and expires_at <= now();

  with order_lines as (
    select *
    from jsonb_to_recordset(v_order.items) as line(
      menu_item_id uuid,
      size text,
      quantity integer
    )
  )
  select string_agg(
    coalesce(menu_item.name, order_line.menu_item_id::text)
      || ' (' || order_line.size || ')',
    ', '
    order by coalesce(menu_item.name, order_line.menu_item_id::text)
  )
  into v_missing_recipes
  from order_lines as order_line
  left join public.menu_items as menu_item
    on menu_item.id = order_line.menu_item_id
  where not exists (
    select 1
    from public.menu_item_recipes as recipe
    where recipe.menu_item_id = order_line.menu_item_id
      and lower(trim(recipe.size)) = lower(trim(order_line.size))
  );

  if v_missing_recipes is not null then
    update public.orders
    set inventory_status = 'needs_recipe',
        inventory_error = left(
          'Missing recipe for: ' || v_missing_recipes,
          500
        )
    where id = v_order.id;

    return jsonb_build_object(
      'status', 'unavailable',
      'orderId', v_order.id,
      'message', 'One or more menu items are unavailable.'
    );
  end if;

  for v_requirement in
    with order_lines as (
      select *
      from jsonb_to_recordset(v_order.items) as line(
        menu_item_id uuid,
        size text,
        quantity integer
      )
    )
    select
      recipe.inventory_item_id,
      sum(recipe.quantity * order_line.quantity)::numeric(12, 2)
        as required_quantity
    from order_lines as order_line
    join public.menu_item_recipes as recipe
      on recipe.menu_item_id = order_line.menu_item_id
     and lower(trim(recipe.size)) = lower(trim(order_line.size))
    group by recipe.inventory_item_id
    order by recipe.inventory_item_id
  loop
    select current_quantity, name, is_active
    into v_current_quantity, v_item_name, v_item_active
    from public.inventory_items
    where id = v_requirement.inventory_item_id
    for update;

    if not found or not v_item_active then
      update public.orders
      set inventory_status = 'failed',
          inventory_error =
            'A recipe references a missing or archived inventory item.'
      where id = v_order.id;

      return jsonb_build_object(
        'status', 'unavailable',
        'orderId', v_order.id,
        'message', 'One or more menu items are unavailable.'
      );
    end if;

    select coalesce(sum(quantity), 0)
    into v_reserved_quantity
    from public.inventory_order_reservations
    where inventory_item_id = v_requirement.inventory_item_id
      and order_id <> v_order.id
      and status = 'reserved'
      and expires_at > now();

    if v_current_quantity - v_reserved_quantity
      < v_requirement.required_quantity
    then
      update public.orders
      set inventory_status = 'insufficient_stock',
          inventory_error = left(
            v_item_name || ' is unavailable for this order.',
            500
          )
      where id = v_order.id;

      return jsonb_build_object(
        'status', 'unavailable',
        'orderId', v_order.id,
        'message', 'One or more menu items are out of stock.'
      );
    end if;
  end loop;

  insert into public.inventory_order_reservations (
    order_id,
    inventory_item_id,
    quantity,
    status,
    expires_at
  )
  with order_lines as (
    select *
    from jsonb_to_recordset(v_order.items) as line(
      menu_item_id uuid,
      size text,
      quantity integer
    )
  ),
  requirements as (
    select
      recipe.inventory_item_id,
      sum(recipe.quantity * order_line.quantity)::numeric(12, 2)
        as required_quantity
    from order_lines as order_line
    join public.menu_item_recipes as recipe
      on recipe.menu_item_id = order_line.menu_item_id
     and lower(trim(recipe.size)) = lower(trim(order_line.size))
    group by recipe.inventory_item_id
  )
  select
    v_order.id,
    requirement.inventory_item_id,
    requirement.required_quantity,
    'reserved',
    v_expires_at
  from requirements as requirement
  on conflict (order_id, inventory_item_id)
  do update set
    quantity = excluded.quantity,
    status = 'reserved',
    expires_at = excluded.expires_at;

  get diagnostics v_reservation_count = row_count;

  update public.orders
  set inventory_status = 'pending',
      inventory_error = null
  where id = v_order.id;

  return jsonb_build_object(
    'status', 'reserved',
    'orderId', v_order.id,
    'reservationCount', v_reservation_count,
    'expiresAt', v_expires_at
  );
end;
$$;

grant execute
  on function public.get_public_menu_stock(uuid)
  to anon, authenticated;

revoke execute
  on function public.reserve_inventory_for_order(uuid)
  from public, anon, authenticated;

grant execute
  on function public.reserve_inventory_for_order(uuid)
  to service_role;

revoke execute
  on function public.sync_inventory_reservation_status()
  from public, anon, authenticated;

grant select
  on public.inventory_order_reservations
  to authenticated;

alter table public.inventory_order_reservations
  enable row level security;

create policy "Admins can view inventory reservations"
  on public.inventory_order_reservations
  for select
  to authenticated
  using (public.is_dashboard_admin());

commit;
