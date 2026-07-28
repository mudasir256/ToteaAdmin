begin;

create table public.menu_item_variants (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null
    references public.menu_items (id) on delete cascade,
  size text not null
    check (char_length(trim(size)) between 1 and 60),
  price numeric(10, 2) not null
    check (price > 0),
  sort_order integer not null default 0
    check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index menu_item_variants_unique_size_idx
  on public.menu_item_variants (menu_item_id, lower(trim(size)));

create index menu_item_variants_menu_item_sort_idx
  on public.menu_item_variants (menu_item_id, sort_order, created_at);

create trigger set_menu_item_variants_updated_at
  before update on public.menu_item_variants
  for each row execute function public.set_menu_catalog_updated_at();

insert into public.menu_item_variants (menu_item_id, size, price, sort_order)
select
  menu_item.id,
  trim(size_entry.value),
  menu_item.price,
  size_entry.ordinality - 1
from public.menu_items as menu_item
cross join lateral regexp_split_to_table(menu_item.sizes, ',')
  with ordinality as size_entry(value, ordinality)
where trim(size_entry.value) <> ''
on conflict do nothing;

create or replace function public.sync_menu_item_variant_summary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_menu_item_id uuid;
begin
  if tg_op = 'DELETE' then
    target_menu_item_id := old.menu_item_id;
  else
    target_menu_item_id := new.menu_item_id;
  end if;

  update public.menu_items
  set
    sizes = variant_summary.sizes,
    price = variant_summary.base_price
  from (
    select
      string_agg(variant.size, ', ' order by variant.sort_order, variant.created_at) as sizes,
      (array_agg(variant.price order by variant.sort_order, variant.created_at))[1] as base_price
    from public.menu_item_variants as variant
    where variant.menu_item_id = target_menu_item_id
  ) as variant_summary
  where menu_items.id = target_menu_item_id
    and variant_summary.sizes is not null
    and variant_summary.base_price is not null;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger sync_menu_item_variant_summary
  after insert or update or delete on public.menu_item_variants
  for each row execute function public.sync_menu_item_variant_summary();

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

  if p_menu_item_id is null then
    insert into public.menu_items (
      category_id,
      name,
      slug,
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
      trim(p_item->>'name'),
      trim(p_item->>'slug'),
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
      name = trim(p_item->>'name'),
      slug = trim(p_item->>'slug'),
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

grant select on public.menu_item_variants to anon, authenticated;
grant insert, update, delete on public.menu_item_variants to authenticated;
grant execute on function public.save_menu_item_with_variants(uuid, jsonb, jsonb)
  to authenticated;

alter table public.menu_item_variants enable row level security;

create policy "Public can view available menu item variants"
  on public.menu_item_variants
  for select
  to anon
  using (
    exists (
      select 1
      from public.menu_items
      join public.menu_categories
        on menu_categories.id = menu_items.category_id
      where menu_items.id = menu_item_variants.menu_item_id
        and menu_items.is_available = true
        and menu_categories.is_active = true
    )
  );

create policy "Authenticated users can view permitted menu item variants"
  on public.menu_item_variants
  for select
  to authenticated
  using (
    public.is_dashboard_admin()
    or exists (
      select 1
      from public.menu_items
      join public.menu_categories
        on menu_categories.id = menu_items.category_id
      where menu_items.id = menu_item_variants.menu_item_id
        and menu_items.is_available = true
        and menu_categories.is_active = true
    )
  );

create policy "Admins can create menu item variants"
  on public.menu_item_variants
  for insert
  to authenticated
  with check (public.is_dashboard_admin());

create policy "Admins can update menu item variants"
  on public.menu_item_variants
  for update
  to authenticated
  using (public.is_dashboard_admin())
  with check (public.is_dashboard_admin());

create policy "Admins can delete menu item variants"
  on public.menu_item_variants
  for delete
  to authenticated
  using (public.is_dashboard_admin());

revoke execute on function public.sync_menu_item_variant_summary()
  from public, anon, authenticated;
revoke execute on function public.save_menu_item_with_variants(uuid, jsonb, jsonb)
  from public, anon;

commit;
