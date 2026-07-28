begin;

insert into public.inventory_categories (name, sort_order)
values
  ('Beverage Bases', 0),
  ('Flavors & Sweeteners', 1),
  ('Creams & Toppings', 2),
  ('Fresh & Frozen', 3),
  ('Packaging', 4)
on conflict (name) do update
set sort_order = excluded.sort_order;

with ingredient_source as (
  select distinct trim(ingredient_name) as name
  from public.menu_items as menu_item
  cross join lateral regexp_split_to_table(
    menu_item.ingredients,
    ','
  ) as ingredient_name
  where trim(ingredient_name) <> ''
),
classified_ingredients as (
  select
    name,
    case
      when lower(name) like '%cream%'
        or lower(name) like '%sago%'
        then 'Creams & Toppings'
      when lower(name) like '%fresh %'
        or lower(name) = 'ice'
        then 'Fresh & Frozen'
      when lower(name) like '%tea%'
        or lower(name) like '%coffee%'
        or lower(name) like '%milk%'
        or lower(name) like '%juice%'
        then 'Beverage Bases'
      else 'Flavors & Sweeteners'
    end as category_name
  from ingredient_source
)
insert into public.inventory_items (
  category_id,
  name,
  current_quantity,
  unit,
  minimum_quantity,
  cost_per_unit,
  notes,
  is_active
)
select
  inventory_category.id,
  ingredient.name,
  0,
  'oz',
  0,
  0,
  'Auto-created from the live menu. Confirm stock, minimum, cost, and recipe quantity before service.',
  true
from classified_ingredients as ingredient
join public.inventory_categories as inventory_category
  on inventory_category.name = ingredient.category_name
on conflict (name) do update
set
  category_id = excluded.category_id,
  unit = excluded.unit,
  is_active = true;

insert into public.inventory_items (
  category_id,
  name,
  current_quantity,
  unit,
  minimum_quantity,
  cost_per_unit,
  notes,
  is_active
)
select
  inventory_category.id,
  packaging.name,
  0,
  'piece',
  0,
  0,
  'Auto-created packaging used by website menu recipes.',
  true
from public.inventory_categories as inventory_category
cross join (
  values
    ('Regular Cup'),
    ('Regular Lid'),
    ('Large Cup'),
    ('Large Lid'),
    ('Straw')
) as packaging(name)
where inventory_category.name = 'Packaging'
on conflict (name) do update
set
  category_id = excluded.category_id,
  unit = excluded.unit,
  is_active = true;

with menu_sizes as (
  select
    menu_item.id as menu_item_id,
    trim(size_name) as size
  from public.menu_items as menu_item
  cross join lateral regexp_split_to_table(
    menu_item.sizes,
    ','
  ) as size_name
  where trim(size_name) <> ''
),
menu_ingredients as (
  select
    menu_item.id as menu_item_id,
    trim(ingredient_name) as ingredient_name
  from public.menu_items as menu_item
  cross join lateral regexp_split_to_table(
    menu_item.ingredients,
    ','
  ) as ingredient_name
  where trim(ingredient_name) <> ''
),
recipe_quantities as (
  select
    menu_size.menu_item_id,
    menu_size.size,
    inventory_item.id as inventory_item_id,
    round(
      (
        case
          when lower(menu_ingredient.ingredient_name) = 'ice' then 8
          when lower(menu_ingredient.ingredient_name) like '%tea leaves%' then 0.5
          when lower(menu_ingredient.ingredient_name) like '%matcha powder%' then 0.2
          when lower(menu_ingredient.ingredient_name) like '%tea%' then 6
          when lower(menu_ingredient.ingredient_name) like '%coffee%' then 4
          when lower(menu_ingredient.ingredient_name) = 'fresh milk' then 4
          when lower(menu_ingredient.ingredient_name) = 'coconut milk' then 4
          when lower(menu_ingredient.ingredient_name) = 'condensed milk' then 1.5
          when lower(menu_ingredient.ingredient_name) like '%juice%' then 3
          when lower(menu_ingredient.ingredient_name) like '%fresh avocado%' then 3
          when lower(menu_ingredient.ingredient_name) like '%fresh mango%' then 3
          when lower(menu_ingredient.ingredient_name) like '%puree%' then 2
          when lower(menu_ingredient.ingredient_name) like '%cream%' then 1.5
          when lower(menu_ingredient.ingredient_name) = 'horchata base' then 2
          when lower(menu_ingredient.ingredient_name) like '%syrup%' then 1
          when lower(menu_ingredient.ingredient_name) like '%extract%' then 0.5
          when lower(menu_ingredient.ingredient_name) = 'sago pearls' then 2
          when lower(menu_ingredient.ingredient_name) = 'sugar' then 0.5
          when lower(menu_ingredient.ingredient_name) like '%cinnamon%'
            or lower(menu_ingredient.ingredient_name) = 'spices'
            then 0.1
          when lower(menu_ingredient.ingredient_name) like '%drizzle%' then 0.5
          else 1
        end
      )::numeric
      * case
          when lower(menu_size.size) = 'large' then 1.25
          else 1
        end,
      2
    ) as quantity
  from menu_sizes as menu_size
  join menu_ingredients as menu_ingredient
    on menu_ingredient.menu_item_id = menu_size.menu_item_id
  join public.inventory_items as inventory_item
    on inventory_item.name = menu_ingredient.ingredient_name
)
insert into public.menu_item_recipes (
  menu_item_id,
  size,
  inventory_item_id,
  quantity
)
select
  menu_item_id,
  size,
  inventory_item_id,
  quantity
from recipe_quantities
on conflict (
  menu_item_id,
  lower(trim(size)),
  inventory_item_id
) do nothing;

with menu_sizes as (
  select
    menu_item.id as menu_item_id,
    trim(size_name) as size
  from public.menu_items as menu_item
  cross join lateral regexp_split_to_table(
    menu_item.sizes,
    ','
  ) as size_name
  where trim(size_name) <> ''
),
packaging_requirements as (
  select
    menu_size.menu_item_id,
    menu_size.size,
    packaging_name
  from menu_sizes as menu_size
  cross join lateral (
    values
      (
        case
          when lower(menu_size.size) = 'large' then 'Large Cup'
          else 'Regular Cup'
        end
      ),
      (
        case
          when lower(menu_size.size) = 'large' then 'Large Lid'
          else 'Regular Lid'
        end
      ),
      ('Straw')
  ) as packaging(packaging_name)
)
insert into public.menu_item_recipes (
  menu_item_id,
  size,
  inventory_item_id,
  quantity
)
select
  packaging.menu_item_id,
  packaging.size,
  inventory_item.id,
  1
from packaging_requirements as packaging
join public.inventory_items as inventory_item
  on inventory_item.name = packaging.packaging_name
on conflict (
  menu_item_id,
  lower(trim(size)),
  inventory_item_id
) do nothing;

update public.menu_items
set recipe_required = true
where recipe_required = false;

update public.orders
set
  inventory_status = 'pending',
  inventory_error = null
where payment_status = 'paid'
  and inventory_status = 'needs_recipe';

commit;
