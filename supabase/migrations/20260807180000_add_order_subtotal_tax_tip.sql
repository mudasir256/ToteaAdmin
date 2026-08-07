alter table public.orders
  add column if not exists subtotal numeric(12,2) not null default 0,
  add column if not exists tax numeric(12,2) not null default 0,
  add column if not exists tip numeric(12,2) not null default 0;

comment on column public.orders.subtotal is 'Items subtotal before tax and tip';
comment on column public.orders.tax is 'Sales tax amount';
comment on column public.orders.tip is 'Customer tip amount';

update public.orders
set subtotal = total
where subtotal = 0 and total > 0;
