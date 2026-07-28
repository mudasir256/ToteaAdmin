begin;

alter table public.menu_items
  add column recipe_required boolean;

update public.menu_items
set recipe_required = false;

alter table public.menu_items
  alter column recipe_required set default true,
  alter column recipe_required set not null;

alter table public.orders
  add column inventory_status text not null default 'pending'
    check (
      inventory_status in (
        'pending',
        'deducted',
        'needs_recipe',
        'insufficient_stock',
        'failed'
      )
    ),
  add column inventory_error text
    check (
      inventory_error is null
      or char_length(trim(inventory_error)) between 1 and 500
    );

create table public.menu_item_recipes (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null
    references public.menu_items (id) on delete cascade,
  size text not null
    check (
      char_length(trim(size)) >= 1
      and char_length(trim(size)) <= 60
    ),
  inventory_item_id uuid not null
    references public.inventory_items (id) on delete restrict,
  quantity numeric(12, 2) not null
    check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index menu_item_recipes_unique_ingredient_idx
  on public.menu_item_recipes (
    menu_item_id,
    lower(trim(size)),
    inventory_item_id
  );

create index menu_item_recipes_inventory_item_idx
  on public.menu_item_recipes (inventory_item_id);

create trigger set_menu_item_recipes_updated_at
  before update on public.menu_item_recipes
  for each row execute function public.set_menu_catalog_updated_at();

create table public.inventory_order_deductions (
  order_id uuid primary key
    references public.orders (id) on delete cascade,
  movement_count integer not null
    check (movement_count > 0),
  deducted_by uuid
    references auth.users (id) on delete set null,
  deducted_at timestamptz not null default now()
);

create or replace function public.validate_menu_item_recipe_before_publish()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_missing_size text;
begin
  if tg_op = 'INSERT' then
    new.recipe_required := true;
  elsif old.recipe_required = true and new.recipe_required = false then
    new.recipe_required := true;
  end if;

  if new.recipe_required and new.is_available then
    select size_name
    into v_missing_size
    from (
      select trim(value) as size_name
      from regexp_split_to_table(new.sizes, ',') as value
      where trim(value) <> ''
    ) as required_sizes
    where not exists (
      select 1
      from public.menu_item_recipes as recipe
      where recipe.menu_item_id = new.id
        and lower(trim(recipe.size)) = lower(required_sizes.size_name)
    )
    limit 1;

    if v_missing_size is not null then
      raise exception
        'Add the % recipe before publishing this menu item.',
        v_missing_size;
    end if;
  end if;

  return new;
end;
$$;

create trigger validate_menu_item_recipe_before_publish
  before insert or update of is_available, sizes, recipe_required
  on public.menu_items
  for each row execute function public.validate_menu_item_recipe_before_publish();

create or replace function public.deduct_inventory_for_paid_order(
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
  v_item_name text;
  v_item_active boolean;
  v_movement_count integer := 0;
begin
  if auth.role() <> 'service_role' and not public.is_dashboard_admin() then
    raise exception 'Dashboard administrator access is required.';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order was not found.';
  end if;

  if v_order.payment_status <> 'paid' then
    return jsonb_build_object(
      'status', 'not_paid',
      'orderId', v_order.id
    );
  end if;

  if exists (
    select 1
    from public.inventory_order_deductions
    where order_id = v_order.id
  ) then
    update public.orders
    set inventory_status = 'deducted',
        inventory_error = null
    where id = v_order.id;

    return jsonb_build_object(
      'status', 'already_deducted',
      'orderId', v_order.id
    );
  end if;

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
      'status', 'needs_recipe',
      'orderId', v_order.id,
      'message', 'One or more ordered items need recipes.'
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
          inventory_error = left(
            'A recipe references a missing or archived inventory item.',
            500
          )
      where id = v_order.id;

      return jsonb_build_object(
        'status', 'failed',
        'orderId', v_order.id,
        'message', 'A recipe references a missing or archived inventory item.'
      );
    end if;

    if v_current_quantity < v_requirement.required_quantity then
      update public.orders
      set inventory_status = 'insufficient_stock',
          inventory_error = left(
            v_item_name || ' requires '
              || v_requirement.required_quantity || ' '
              || 'but only ' || v_current_quantity || ' is available.',
            500
          )
      where id = v_order.id;

      return jsonb_build_object(
        'status', 'insufficient_stock',
        'orderId', v_order.id,
        'inventoryItem', v_item_name
      );
    end if;
  end loop;

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
    select current_quantity
    into v_current_quantity
    from public.inventory_items
    where id = v_requirement.inventory_item_id;

    update public.inventory_items
    set current_quantity =
      current_quantity - v_requirement.required_quantity
    where id = v_requirement.inventory_item_id;

    insert into public.inventory_movements (
      item_id,
      movement_type,
      quantity_change,
      previous_quantity,
      new_quantity,
      reason,
      created_by
    ) values (
      v_requirement.inventory_item_id,
      'stock_out',
      -v_requirement.required_quantity,
      v_current_quantity,
      v_current_quantity - v_requirement.required_quantity,
      left('Website order ' || v_order.order_number, 240),
      auth.uid()
    );

    v_movement_count := v_movement_count + 1;
  end loop;

  insert into public.inventory_order_deductions (
    order_id,
    movement_count,
    deducted_by
  ) values (
    v_order.id,
    v_movement_count,
    auth.uid()
  );

  update public.orders
  set inventory_status = 'deducted',
      inventory_error = null
  where id = v_order.id;

  return jsonb_build_object(
    'status', 'deducted',
    'orderId', v_order.id,
    'movementCount', v_movement_count
  );
end;
$$;

grant select, insert, update, delete
  on public.menu_item_recipes
  to authenticated;

grant select
  on public.inventory_order_deductions
  to authenticated;

revoke execute
  on function public.validate_menu_item_recipe_before_publish()
  from public, anon, authenticated;

revoke execute
  on function public.deduct_inventory_for_paid_order(uuid)
  from public, anon;

grant execute
  on function public.deduct_inventory_for_paid_order(uuid)
  to authenticated, service_role;

alter table public.menu_item_recipes enable row level security;
alter table public.inventory_order_deductions enable row level security;

create policy "Admins can view menu item recipes"
  on public.menu_item_recipes for select to authenticated
  using (public.is_dashboard_admin());

create policy "Admins can create menu item recipes"
  on public.menu_item_recipes for insert to authenticated
  with check (public.is_dashboard_admin());

create policy "Admins can update menu item recipes"
  on public.menu_item_recipes for update to authenticated
  using (public.is_dashboard_admin())
  with check (public.is_dashboard_admin());

create policy "Admins can delete menu item recipes"
  on public.menu_item_recipes for delete to authenticated
  using (public.is_dashboard_admin());

create policy "Admins can view inventory order deductions"
  on public.inventory_order_deductions for select to authenticated
  using (public.is_dashboard_admin());

commit;
