alter table public.menu_items add column price numeric(10, 2);

update public.menu_items
set price = price_from;

alter table public.menu_items
  alter column price set not null,
  add constraint menu_items_price_nonnegative check (price >= 0);

alter table public.menu_items
  drop column price_from,
  drop column price_to;
