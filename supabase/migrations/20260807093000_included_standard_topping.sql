-- Allow a standard topping to be marked as included (free) per menu item.
alter table public.menu_item_option_settings
  add column if not exists included_standard_topping_id uuid
    references public.menu_toppings (id) on delete set null;

-- Ensure common standard toppings have inventory stock for deductions.
with standard_names as (
  select distinct trim(name) as name
  from public.menu_toppings
  where category = 'standard'
    and trim(name) <> ''
),
creams_category as (
  select id
  from public.inventory_categories
  where name = 'Creams & Toppings'
  limit 1
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
  creams_category.id,
  standard_names.name,
  200,
  'oz',
  20,
  0,
  'Auto-created for included/standard topping inventory deductions.',
  true
from standard_names
cross join creams_category
where not exists (
  select 1
  from public.inventory_items as item
  where lower(trim(item.name)) = lower(standard_names.name)
);
