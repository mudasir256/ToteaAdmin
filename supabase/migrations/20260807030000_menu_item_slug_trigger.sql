-- Guarantee menu item slugs are always generated from the name, even if a
-- save path omits slug or an older RPC still tries to insert null.

create or replace function public.slugify_menu_text(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    trim(both '-' from lower(regexp_replace(coalesce(input, ''), '[^a-zA-Z0-9]+', '-', 'g'))),
    ''
  );
$$;

create or replace function public.unique_menu_item_slug(
  p_name text,
  p_menu_item_id uuid default null
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  base_slug text := coalesce(public.slugify_menu_text(p_name), 'menu-item');
  candidate text := base_slug;
  suffix integer := 2;
begin
  while exists (
    select 1
    from public.menu_items as item
    where item.slug = candidate
      and (p_menu_item_id is null or item.id <> p_menu_item_id)
  ) loop
    candidate := base_slug || '-' || suffix;
    suffix := suffix + 1;
  end loop;

  return candidate;
end;
$$;

create or replace function public.set_menu_item_slug_from_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.name is null or btrim(new.name) = '' then
    raise exception 'Menu item name is required.';
  end if;

  -- Always derive slug from the current name so admin never needs a slug field.
  new.slug := public.unique_menu_item_slug(new.name, new.id);
  return new;
end;
$$;

drop trigger if exists set_menu_item_slug_from_name on public.menu_items;
create trigger set_menu_item_slug_from_name
  before insert or update of name, slug
  on public.menu_items
  for each row
  execute function public.set_menu_item_slug_from_name();

-- Keep the save RPC aligned with auto-generated slugs.
create or replace function public.save_menu_item_with_variants(
  p_menu_item_id uuid,
  p_item jsonb,
  p_variants jsonb
)
returns uuid
language plpgsql
security invoker
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
      false,
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
