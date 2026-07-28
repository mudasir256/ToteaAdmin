begin;

create policy "Admins can upload topping images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = 'toppings'
    and public.is_dashboard_admin()
  );

create policy "Admins can update topping images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = 'toppings'
    and public.is_dashboard_admin()
  )
  with check (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = 'toppings'
    and public.is_dashboard_admin()
  );

create policy "Admins can delete topping images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = 'toppings'
    and public.is_dashboard_admin()
  );

commit;
