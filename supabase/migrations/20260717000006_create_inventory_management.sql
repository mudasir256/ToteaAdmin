create table public.inventory_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 1 and 80),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.inventory_categories (id) on delete restrict,
  name text not null unique check (char_length(trim(name)) between 1 and 140),
  current_quantity numeric(12, 2) not null default 0 check (current_quantity >= 0),
  unit text not null default 'unit' check (char_length(trim(unit)) between 1 and 40),
  minimum_quantity numeric(12, 2) not null default 0 check (minimum_quantity >= 0),
  cost_per_unit numeric(12, 2) not null default 0 check (cost_per_unit >= 0),
  supplier text check (supplier is null or char_length(trim(supplier)) between 1 and 140),
  expiration_date date,
  notes text check (notes is null or char_length(trim(notes)) <= 600),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  movement_type text not null check (movement_type in ('opening', 'stock_in', 'stock_out', 'adjustment')),
  quantity_change numeric(12, 2) not null,
  previous_quantity numeric(12, 2) not null check (previous_quantity >= 0),
  new_quantity numeric(12, 2) not null check (new_quantity >= 0),
  reason text not null check (char_length(trim(reason)) between 1 and 240),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index inventory_items_category_name_idx
  on public.inventory_items (category_id, name);

create index inventory_items_active_stock_idx
  on public.inventory_items (is_active, current_quantity, minimum_quantity);

create index inventory_movements_item_created_at_idx
  on public.inventory_movements (item_id, created_at desc);

create index inventory_movements_created_at_idx
  on public.inventory_movements (created_at desc);

create or replace function public.set_inventory_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_inventory_categories_updated_at
  before update on public.inventory_categories
  for each row execute function public.set_inventory_updated_at();

create trigger set_inventory_items_updated_at
  before update on public.inventory_items
  for each row execute function public.set_inventory_updated_at();

create or replace function public.record_inventory_opening_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.current_quantity > 0 then
    insert into public.inventory_movements (
      item_id,
      movement_type,
      quantity_change,
      previous_quantity,
      new_quantity,
      reason,
      created_by
    ) values (
      new.id,
      'opening',
      new.current_quantity,
      0,
      new.current_quantity,
      'Opening balance',
      auth.uid()
    );
  end if;

  return new;
end;
$$;

create trigger record_inventory_opening_balance
  after insert on public.inventory_items
  for each row execute function public.record_inventory_opening_balance();

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
  if auth.uid() is null then
    raise exception 'Authentication is required.';
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

  select *
  into v_item
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
    item_id,
    movement_type,
    quantity_change,
    previous_quantity,
    new_quantity,
    reason,
    created_by
  ) values (
    p_item_id,
    p_movement_type,
    v_quantity_change,
    v_item.current_quantity - v_quantity_change,
    v_item.current_quantity,
    trim(p_reason),
    auth.uid()
  );

  return v_item;
end;
$$;

grant select, insert on public.inventory_categories to authenticated;
grant update (name, sort_order) on public.inventory_categories to authenticated;
grant delete on public.inventory_categories to authenticated;

grant select, insert, delete on public.inventory_items to authenticated;
grant update (
  category_id,
  name,
  unit,
  minimum_quantity,
  cost_per_unit,
  supplier,
  expiration_date,
  notes,
  is_active
) on public.inventory_items to authenticated;

grant select on public.inventory_movements to authenticated;

revoke execute on function public.adjust_inventory_stock(uuid, text, numeric, text) from public;
revoke execute on function public.adjust_inventory_stock(uuid, text, numeric, text) from anon;
grant execute on function public.adjust_inventory_stock(uuid, text, numeric, text) to authenticated;

alter table public.inventory_categories enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

create policy "Authenticated users can view inventory categories"
  on public.inventory_categories
  for select
  to authenticated
  using (true);

create policy "Authenticated users can create inventory categories"
  on public.inventory_categories
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update inventory categories"
  on public.inventory_categories
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete unused inventory categories"
  on public.inventory_categories
  for delete
  to authenticated
  using (true);

create policy "Authenticated users can view inventory items"
  on public.inventory_items
  for select
  to authenticated
  using (true);

create policy "Authenticated users can create inventory items"
  on public.inventory_items
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update inventory items"
  on public.inventory_items
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete inventory items"
  on public.inventory_items
  for delete
  to authenticated
  using (true);

create policy "Authenticated users can view inventory movements"
  on public.inventory_movements
  for select
  to authenticated
  using (true);

insert into public.inventory_categories (name, sort_order)
values
  ('Tea', 10),
  ('Powders', 20),
  ('Syrups', 30),
  ('Dairy & Creamers', 40),
  ('Toppings', 50),
  ('Chicken', 60),
  ('Snacks', 70),
  ('Sauces', 80),
  ('Gelato Ice Cream', 90),
  ('Packaging', 100);

insert into public.inventory_items (category_id, name, unit)
select category.id, source.item_name, 'unit'
from (
  values
    ('Tea', 'Coffee beans (Vietnamese, phin-style)'),
    ('Tea', 'Jasmine tea leaves'),
    ('Tea', 'Roasted oolong tea leaves'),
    ('Tea', 'Osmanthus oolong tea leaves'),
    ('Tea', 'Osmanthus honey dong ding oolong tea leaves'),
    ('Tea', 'Black tea leaves'),
    ('Tea', 'Dong ding oolong tea leaves (plain)'),
    ('Tea', 'Green tea leaves'),
    ('Powders', 'Matcha powder'),
    ('Powders', 'Ube powder'),
    ('Powders', 'Black sesame powder'),
    ('Powders', 'Banana powder'),
    ('Powders', 'Coconut powder'),
    ('Powders', 'Hojicha powder'),
    ('Powders', 'Thai milk tea powder'),
    ('Powders', 'Horchata powder'),
    ('Powders', 'Taro powder'),
    ('Powders', 'Brown sugar powder'),
    ('Powders', 'Sea salt cream powder'),
    ('Powders', 'Sea salt'),
    ('Powders', 'Marination powder'),
    ('Powders', 'Bubble waffle powder'),
    ('Syrups', 'Vanilla syrup'),
    ('Syrups', 'Mango syrup'),
    ('Syrups', 'Strawberry syrup'),
    ('Syrups', 'Blueberry syrup'),
    ('Syrups', 'Peach syrup'),
    ('Syrups', 'Guava syrup'),
    ('Syrups', 'Grapefruit syrup'),
    ('Syrups', 'Plum syrup'),
    ('Syrups', 'Passion fruit pulp'),
    ('Syrups', 'Dragon fruit pulp'),
    ('Syrups', 'Lychee syrup'),
    ('Syrups', 'Kumquat syrup'),
    ('Syrups', 'Pineapple chunks / pineapple syrup'),
    ('Syrups', 'Brown sugar syrup'),
    ('Syrups', 'Honey'),
    ('Syrups', 'Strawberry Yakult'),
    ('Dairy & Creamers', 'Condensed milk'),
    ('Dairy & Creamers', 'Fresh whole milk'),
    ('Dairy & Creamers', 'Coconut water'),
    ('Dairy & Creamers', 'Coconut cream / coconut milk'),
    ('Dairy & Creamers', 'Non-dairy creamer'),
    ('Dairy & Creamers', 'Whip cream'),
    ('Toppings', 'Sago pearls'),
    ('Toppings', 'Brown sugar boba pearls'),
    ('Toppings', 'Crystal boba pearls'),
    ('Toppings', 'Lychee jelly'),
    ('Toppings', 'Coconut jelly'),
    ('Toppings', 'Mango popping boba'),
    ('Toppings', 'Strawberry popping boba'),
    ('Toppings', 'Coconut chunks'),
    ('Toppings', 'Frozen mango'),
    ('Toppings', 'Mango chunks'),
    ('Toppings', 'Dried strawberry'),
    ('Toppings', 'Black sesame (whole, garnish)'),
    ('Toppings', 'Dried blueberry'),
    ('Toppings', 'Canned peach'),
    ('Toppings', 'Fresh lemon slices'),
    ('Toppings', 'Biscoff biscuits'),
    ('Toppings', 'Chocolate chips'),
    ('Toppings', 'Wafers'),
    ('Chicken', 'Chicken'),
    ('Snacks', 'Fries'),
    ('Snacks', 'Ramen noodles'),
    ('Snacks', 'Ramen broth / seasoning'),
    ('Sauces', 'Honey mustard'),
    ('Sauces', 'Roasted sesame sauce'),
    ('Sauces', 'Sriracha aioli'),
    ('Sauces', 'Sweet chili sauce'),
    ('Sauces', 'Ketchup packets'),
    ('Sauces', 'Thai basil sauce'),
    ('Gelato Ice Cream', 'Madagascar Vanilla Bean'),
    ('Gelato Ice Cream', 'Italian Espresso'),
    ('Gelato Ice Cream', 'Belgian Dark Chocolate'),
    ('Gelato Ice Cream', 'Alphonso Mango (Sorbetto)'),
    ('Gelato Ice Cream', 'Matcha'),
    ('Gelato Ice Cream', 'Ube'),
    ('Gelato Ice Cream', 'Argentine Sea Salt Caramel'),
    ('Gelato Ice Cream', 'Passion Fruit (Sorbetto)'),
    ('Gelato Ice Cream', 'Dubai Chocolate Pistachio Noir'),
    ('Packaging', 'Paper cups (22oz signature cup)'),
    ('Packaging', 'Lids'),
    ('Packaging', 'Straws'),
    ('Packaging', 'Takeaway bags'),
    ('Packaging', 'Napkins'),
    ('Packaging', 'Cup carriers / sleeves')
) as source(category_name, item_name)
join public.inventory_categories as category
  on category.name = source.category_name;
