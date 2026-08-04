begin;

create table if not exists public.menu_option_levels (
  id uuid primary key default gen_random_uuid(),
  kind text not null
    check (kind in ('sugar', 'ice')),
  name text not null
    check (
      char_length(trim(name)) >= 1
      and char_length(trim(name)) <= 80
    ),
  sort_order integer not null default 0
    check (sort_order >= 0),
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, name)
);

create index if not exists menu_option_levels_kind_sort_order_idx
  on public.menu_option_levels (kind, sort_order);

drop trigger if exists set_menu_option_levels_updated_at on public.menu_option_levels;
create trigger set_menu_option_levels_updated_at
  before update on public.menu_option_levels
  for each row execute function public.set_menu_catalog_updated_at();

create or replace function public.ensure_single_default_option_level()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_default then
    update public.menu_option_levels
    set is_default = false
    where kind = new.kind
      and id is distinct from new.id
      and is_default = true;
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_single_default_option_level on public.menu_option_levels;
create trigger ensure_single_default_option_level
  before insert or update of is_default
  on public.menu_option_levels
  for each row
  when (new.is_default = true)
  execute function public.ensure_single_default_option_level();

grant select on public.menu_option_levels to anon;
grant select, insert, update, delete on public.menu_option_levels to authenticated;

alter table public.menu_option_levels enable row level security;

drop policy if exists "Public can view active menu option levels" on public.menu_option_levels;
create policy "Public can view active menu option levels"
  on public.menu_option_levels for select to anon
  using (is_active = true);

drop policy if exists "Authenticated users can view permitted menu option levels" on public.menu_option_levels;
create policy "Authenticated users can view permitted menu option levels"
  on public.menu_option_levels for select to authenticated
  using (is_active = true or public.is_dashboard_admin());

drop policy if exists "Admins can create menu option levels" on public.menu_option_levels;
create policy "Admins can create menu option levels"
  on public.menu_option_levels for insert to authenticated
  with check (public.is_dashboard_admin());

drop policy if exists "Admins can update menu option levels" on public.menu_option_levels;
create policy "Admins can update menu option levels"
  on public.menu_option_levels for update to authenticated
  using (public.is_dashboard_admin())
  with check (public.is_dashboard_admin());

drop policy if exists "Admins can delete menu option levels" on public.menu_option_levels;
create policy "Admins can delete menu option levels"
  on public.menu_option_levels for delete to authenticated
  using (public.is_dashboard_admin());

insert into public.menu_option_levels (kind, name, sort_order, is_default) values
  ('sugar', 'Less Sugar', 0, true),
  ('sugar', 'Light Sugar', 1, false),
  ('sugar', 'Minimal Sugar', 2, false),
  ('sugar', 'No Added', 3, false),
  ('sugar', 'Super Sweet', 4, false),
  ('ice', 'No Ice', 0, false),
  ('ice', 'Less Ice', 1, false),
  ('ice', 'Normal Ice', 2, true),
  ('ice', 'More Ice', 3, false)
on conflict (kind, name) do update
set
  sort_order = excluded.sort_order,
  is_default = excluded.is_default,
  is_active = true;

commit;
