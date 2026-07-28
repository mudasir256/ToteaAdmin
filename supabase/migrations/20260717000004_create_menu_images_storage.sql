insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Authenticated users can upload menu images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = 'menu'
  );

create policy "Authenticated users can update menu images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = 'menu'
  )
  with check (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = 'menu'
  );

create policy "Authenticated users can delete menu images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = 'menu'
  );
