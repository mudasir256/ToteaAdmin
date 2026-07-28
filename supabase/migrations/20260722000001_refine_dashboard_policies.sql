begin;

revoke execute on function public.protect_profile_identity()
  from public, anon, authenticated;

drop policy if exists "Customers can view their own profile" on public.profiles;
drop policy if exists "Admins can view every profile" on public.profiles;
drop policy if exists "Customers can update their own profile" on public.profiles;
drop policy if exists "Admins can update every profile" on public.profiles;

create policy "Authenticated users can view permitted profiles"
  on public.profiles for select to authenticated
  using (
    (select auth.uid()) = id
    or public.is_dashboard_admin()
  );

create policy "Authenticated users can update permitted profiles"
  on public.profiles for update to authenticated
  using (
    (select auth.uid()) = id
    or public.is_dashboard_admin()
  )
  with check (
    (select auth.uid()) = id
    or public.is_dashboard_admin()
  );

drop policy if exists "Customers can view their own orders" on public.orders;
drop policy if exists "Admins can view every order" on public.orders;

create policy "Authenticated users can view permitted orders"
  on public.orders for select to authenticated
  using (
    (select auth.uid()) = user_id
    or public.is_dashboard_admin()
  );

drop policy if exists "Customers can view active menu categories" on public.menu_categories;
drop policy if exists "Admins can manage menu categories" on public.menu_categories;

create policy "Authenticated users can view permitted menu categories"
  on public.menu_categories for select to authenticated
  using (is_active = true or public.is_dashboard_admin());

create policy "Admins can create menu categories"
  on public.menu_categories for insert to authenticated
  with check (public.is_dashboard_admin());

create policy "Admins can update menu categories"
  on public.menu_categories for update to authenticated
  using (public.is_dashboard_admin())
  with check (public.is_dashboard_admin());

create policy "Admins can delete menu categories"
  on public.menu_categories for delete to authenticated
  using (public.is_dashboard_admin());

drop policy if exists "Customers can view available menu items" on public.menu_items;
drop policy if exists "Admins can manage menu items" on public.menu_items;

create policy "Authenticated users can view permitted menu items"
  on public.menu_items for select to authenticated
  using (
    public.is_dashboard_admin()
    or (
      is_available = true
      and exists (
        select 1 from public.menu_categories
        where menu_categories.id = menu_items.category_id
          and menu_categories.is_active = true
      )
    )
  );

create policy "Admins can create menu items"
  on public.menu_items for insert to authenticated
  with check (public.is_dashboard_admin());

create policy "Admins can update menu items"
  on public.menu_items for update to authenticated
  using (public.is_dashboard_admin())
  with check (public.is_dashboard_admin());

create policy "Admins can delete menu items"
  on public.menu_items for delete to authenticated
  using (public.is_dashboard_admin());

drop policy if exists "Admins can manage reviews" on public.reviews;

create policy "Admins can create reviews"
  on public.reviews for insert to authenticated
  with check (public.is_dashboard_admin());

create policy "Admins can update reviews"
  on public.reviews for update to authenticated
  using (public.is_dashboard_admin())
  with check (public.is_dashboard_admin());

create policy "Admins can delete reviews"
  on public.reviews for delete to authenticated
  using (public.is_dashboard_admin());

commit;
