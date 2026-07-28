begin;

drop policy if exists "Customers can view their profile image objects"
on storage.objects;

create policy "Customers can view their profile image objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'profile-images'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_dashboard_admin()
  )
);

commit;
