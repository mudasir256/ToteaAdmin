create index if not exists menu_item_option_settings_default_ice_level_id_idx
  on public.menu_item_option_settings (default_ice_level_id);

create index if not exists menu_item_option_settings_default_sugar_level_id_idx
  on public.menu_item_option_settings (default_sugar_level_id);

create index if not exists menu_item_option_settings_included_cream_topping_id_idx
  on public.menu_item_option_settings (included_cream_topping_id);

create index if not exists menu_item_option_settings_included_standard_topping_id_idx
  on public.menu_item_option_settings (included_standard_topping_id);
