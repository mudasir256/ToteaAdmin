-- Deduct menu recipe ingredients plus selected toppings that map to inventory.
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
      select
        line.menu_item_id,
        line.size,
        line.quantity,
        coalesce(line.toppings, '[]'::jsonb) as toppings
      from jsonb_to_recordset(v_order.items) as line(
        menu_item_id uuid,
        size text,
        quantity integer,
        toppings jsonb
      )
    ),
    recipe_requirements as (
      select
        recipe.inventory_item_id,
        sum(recipe.quantity * order_line.quantity)::numeric(12, 2)
          as required_quantity
      from order_lines as order_line
      join public.menu_item_recipes as recipe
        on recipe.menu_item_id = order_line.menu_item_id
       and lower(trim(recipe.size)) = lower(trim(order_line.size))
      group by recipe.inventory_item_id
    ),
    topping_requirements as (
      select
        inventory_item.id as inventory_item_id,
        sum(
          order_line.quantity * case
            when lower(coalesce(inventory_item.unit, '')) = 'oz'
              and lower(trim(order_line.size)) like '%large%'
              then 1.88
            when lower(coalesce(inventory_item.unit, '')) = 'oz'
              then 1.50
            else 1.00
          end
        )::numeric(12, 2) as required_quantity
      from order_lines as order_line
      cross join lateral jsonb_array_elements(order_line.toppings) as topping(value)
      join public.inventory_items as inventory_item
        on lower(trim(inventory_item.name))
         = lower(trim(coalesce(topping.value ->> 'name', '')))
       and inventory_item.is_active = true
      where coalesce(topping.value ->> 'name', '') <> ''
      group by inventory_item.id
    ),
    combined as (
      select inventory_item_id, required_quantity from recipe_requirements
      union all
      select inventory_item_id, required_quantity from topping_requirements
    )
    select
      inventory_item_id,
      sum(required_quantity)::numeric(12, 2) as required_quantity
    from combined
    group by inventory_item_id
    order by inventory_item_id
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
      select
        line.menu_item_id,
        line.size,
        line.quantity,
        coalesce(line.toppings, '[]'::jsonb) as toppings
      from jsonb_to_recordset(v_order.items) as line(
        menu_item_id uuid,
        size text,
        quantity integer,
        toppings jsonb
      )
    ),
    recipe_requirements as (
      select
        recipe.inventory_item_id,
        sum(recipe.quantity * order_line.quantity)::numeric(12, 2)
          as required_quantity
      from order_lines as order_line
      join public.menu_item_recipes as recipe
        on recipe.menu_item_id = order_line.menu_item_id
       and lower(trim(recipe.size)) = lower(trim(order_line.size))
      group by recipe.inventory_item_id
    ),
    topping_requirements as (
      select
        inventory_item.id as inventory_item_id,
        sum(
          order_line.quantity * case
            when lower(coalesce(inventory_item.unit, '')) = 'oz'
              and lower(trim(order_line.size)) like '%large%'
              then 1.88
            when lower(coalesce(inventory_item.unit, '')) = 'oz'
              then 1.50
            else 1.00
          end
        )::numeric(12, 2) as required_quantity
      from order_lines as order_line
      cross join lateral jsonb_array_elements(order_line.toppings) as topping(value)
      join public.inventory_items as inventory_item
        on lower(trim(inventory_item.name))
         = lower(trim(coalesce(topping.value ->> 'name', '')))
       and inventory_item.is_active = true
      where coalesce(topping.value ->> 'name', '') <> ''
      group by inventory_item.id
    ),
    combined as (
      select inventory_item_id, required_quantity from recipe_requirements
      union all
      select inventory_item_id, required_quantity from topping_requirements
    )
    select
      inventory_item_id,
      sum(required_quantity)::numeric(12, 2) as required_quantity
    from combined
    group by inventory_item_id
    order by inventory_item_id
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

revoke execute
  on function public.deduct_inventory_for_paid_order(uuid)
  from public, anon;

grant execute
  on function public.deduct_inventory_for_paid_order(uuid)
  to authenticated, service_role;
