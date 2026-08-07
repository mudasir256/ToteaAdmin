-- Keep only the dashboard account as admin; website shoppers are customers.
alter table public.profiles disable trigger protect_profile_identity;

update public.profiles
set role = 'customer',
    updated_at = now()
where lower(coalesce(email, '')) <> 'admin@totea.local'
  and role = 'admin';

alter table public.profiles enable trigger protect_profile_identity;
