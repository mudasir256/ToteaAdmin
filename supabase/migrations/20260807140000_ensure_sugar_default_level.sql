-- Ensure sugar has exactly one global default when none is set.
update public.menu_option_levels
set is_default = true
where kind = 'sugar'
  and name = 'Light Sugar'
  and not exists (
    select 1 from public.menu_option_levels
    where kind = 'sugar' and is_default = true
  );

update public.menu_option_levels as target
set is_default = true
where target.id = (
  select id
  from public.menu_option_levels
  where kind = 'sugar'
  order by sort_order asc, name asc
  limit 1
)
and not exists (
  select 1 from public.menu_option_levels
  where kind = 'sugar' and is_default = true
);
