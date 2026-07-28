begin;

drop policy if exists "Public can view active menu categories"
on public.menu_categories;

create policy "Public can view active menu categories"
on public.menu_categories
for select
to anon
using (is_active = true);

drop policy if exists "Public can view available menu items"
on public.menu_items;

create policy "Public can view available menu items"
on public.menu_items
for select
to anon
using (
  is_available = true
  and exists (
    select 1
    from public.menu_categories
    where menu_categories.id = menu_items.category_id
      and menu_categories.is_active = true
  )
);

commit;
