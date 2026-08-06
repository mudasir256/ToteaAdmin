begin;

-- Ice & Sugar are compulsory drink options for every menu item.
-- They must not be tracked as inventory / recipe stock lines.

delete from public.menu_item_recipes as recipe
using public.inventory_items as inventory_item
where recipe.inventory_item_id = inventory_item.id
  and lower(inventory_item.name) in ('ice', 'sugar');

delete from public.inventory_items
where lower(name) in ('ice', 'sugar');

update public.menu_items
set ingredients = trim(both ', ' from regexp_replace(
  regexp_replace(
    regexp_replace(ingredients, '(?i)(^|,)\s*ice\s*(?=,|$)', '', 'g'),
    '(?i)(^|,)\s*sugar\s*(?=,|$)',
    '',
    'g'
  ),
  ',\s*,+',
  ', ',
  'g'
))
where ingredients ~* '(^|,)\s*(ice|sugar)\s*(,|$)';

insert into public.menu_item_option_settings (
  menu_item_id,
  sugar_enabled,
  ice_enabled,
  standard_toppings_enabled,
  cream_toppings_enabled,
  default_sugar_level_id,
  default_ice_level_id
)
select
  menu_item.id,
  true,
  true,
  coalesce(settings.standard_toppings_enabled, true),
  coalesce(settings.cream_toppings_enabled, true),
  coalesce(
    settings.default_sugar_level_id,
    (
      select id
      from public.menu_option_levels
      where kind = 'sugar'
        and is_default = true
        and is_active = true
      limit 1
    )
  ),
  coalesce(
    settings.default_ice_level_id,
    (
      select id
      from public.menu_option_levels
      where kind = 'ice'
        and is_default = true
        and is_active = true
      limit 1
    )
  )
from public.menu_items as menu_item
left join public.menu_item_option_settings as settings
  on settings.menu_item_id = menu_item.id
on conflict (menu_item_id) do update
set
  sugar_enabled = true,
  ice_enabled = true,
  default_sugar_level_id = coalesce(
    menu_item_option_settings.default_sugar_level_id,
    excluded.default_sugar_level_id
  ),
  default_ice_level_id = coalesce(
    menu_item_option_settings.default_ice_level_id,
    excluded.default_ice_level_id
  );

-- Keep sugar/ice permanently enabled even if an admin form tries to turn them off.
create or replace function public.enforce_compulsory_sugar_ice_options()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.sugar_enabled := true;
  new.ice_enabled := true;
  return new;
end;
$$;

drop trigger if exists enforce_compulsory_sugar_ice_options
  on public.menu_item_option_settings;

create trigger enforce_compulsory_sugar_ice_options
  before insert or update on public.menu_item_option_settings
  for each row execute function public.enforce_compulsory_sugar_ice_options();

commit;
