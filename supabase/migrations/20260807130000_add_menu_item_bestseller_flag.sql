alter table public.menu_items
  add column if not exists is_bestseller boolean not null default false;

comment on column public.menu_items.is_bestseller is
  'When true, the public menu shows a Bestseller badge on this item.';

-- Preserve the previous hard-coded storefront picks.
update public.menu_items
set is_bestseller = true
where lower(trim(name)) in (
  'brown sugar milk tea',
  'vietnamese sea salt coffee',
  'classic milk tea'
);

create or replace function public.save_menu_item_with_variants(
  p_menu_item_id uuid,
  p_item jsonb,
  p_variants jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  saved_menu_item_id uuid;
  first_variant jsonb;
  item_name text;
begin
  if not public.is_dashboard_admin() then
    raise exception 'Only dashboard administrators can manage menu items.';
  end if;

  if jsonb_typeof(p_variants) <> 'array'
    or jsonb_array_length(p_variants) = 0 then
    raise exception 'Add at least one size and price.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_variants) as variant
    group by lower(trim(variant->>'size'))
    having count(*) > 1
  ) then
    raise exception 'Each size name must be unique.';
  end if;

  first_variant := p_variants->0;
  item_name := trim(p_item->>'name');
  if item_name is null or item_name = '' then
    raise exception 'Menu item name is required.';
  end if;

  if p_menu_item_id is null then
    insert into public.menu_items (
      category_id,
      name,
      description,
      image_url,
      price,
      sizes,
      ingredients,
      calories,
      allergens,
      is_available,
      is_bestseller,
      sort_order
    )
    values (
      (p_item->>'category_id')::uuid,
      item_name,
      trim(p_item->>'description'),
      trim(p_item->>'image_url'),
      (first_variant->>'price')::numeric,
      (
        select string_agg(trim(variant.value->>'size'), ', ' order by variant.ordinality)
        from jsonb_array_elements(p_variants)
          with ordinality as variant(value, ordinality)
      ),
      trim(p_item->>'ingredients'),
      trim(p_item->>'calories'),
      trim(p_item->>'allergens'),
      coalesce((p_item->>'is_available')::boolean, false),
      coalesce((p_item->>'is_bestseller')::boolean, false),
      (p_item->>'sort_order')::integer
    )
    returning id into saved_menu_item_id;
  else
    update public.menu_items
    set
      category_id = (p_item->>'category_id')::uuid,
      name = item_name,
      description = trim(p_item->>'description'),
      image_url = trim(p_item->>'image_url'),
      price = (first_variant->>'price')::numeric,
      sizes = (
        select string_agg(trim(variant.value->>'size'), ', ' order by variant.ordinality)
        from jsonb_array_elements(p_variants)
          with ordinality as variant(value, ordinality)
      ),
      ingredients = trim(p_item->>'ingredients'),
      calories = trim(p_item->>'calories'),
      allergens = trim(p_item->>'allergens'),
      is_available = (p_item->>'is_available')::boolean,
      is_bestseller = coalesce((p_item->>'is_bestseller')::boolean, false),
      sort_order = (p_item->>'sort_order')::integer
    where id = p_menu_item_id
    returning id into saved_menu_item_id;

    if saved_menu_item_id is null then
      raise exception 'Menu item not found.';
    end if;
  end if;

  delete from public.menu_item_variants
  where menu_item_id = saved_menu_item_id;

  insert into public.menu_item_variants (menu_item_id, size, price, sort_order)
  select
    saved_menu_item_id,
    trim(variant.value->>'size'),
    (variant.value->>'price')::numeric,
    variant.ordinality - 1
  from jsonb_array_elements(p_variants)
    with ordinality as variant(value, ordinality);

  return saved_menu_item_id;
end;
$$;
