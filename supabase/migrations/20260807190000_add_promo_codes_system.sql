-- Promo code definitions
create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  discount_type text not null check (discount_type in ('fixed', 'percent')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  max_uses_per_user integer not null default 1 check (max_uses_per_user >= 1),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promo_codes_code_unique unique (code),
  constraint promo_codes_percent_max check (
    discount_type <> 'percent' or discount_value <= 100
  )
);

create index if not exists promo_codes_active_idx on public.promo_codes (is_active);

create table if not exists public.customer_promo_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  promo_code_id uuid not null references public.promo_codes (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  note text,
  status text not null default 'available' check (status in ('available', 'used', 'revoked')),
  used_at timestamptz,
  used_order_id uuid references public.orders (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_promo_codes_user_status_idx
  on public.customer_promo_codes (user_id, status);
create index if not exists customer_promo_codes_promo_idx
  on public.customer_promo_codes (promo_code_id);

create unique index if not exists customer_promo_codes_user_promo_available_uidx
  on public.customer_promo_codes (user_id, promo_code_id)
  where status = 'available';

alter table public.orders
  add column if not exists discount numeric(12,2) not null default 0,
  add column if not exists discount_code text,
  add column if not exists discount_reason text;

create or replace function public.normalize_promo_code()
returns trigger
language plpgsql
as $$
begin
  new.code := upper(trim(new.code));
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_normalize_promo_code on public.promo_codes;
create trigger trg_normalize_promo_code
  before insert or update of code on public.promo_codes
  for each row execute function public.normalize_promo_code();

create or replace function public.touch_customer_promo_codes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_customer_promo_codes on public.customer_promo_codes;
create trigger trg_touch_customer_promo_codes
  before update on public.customer_promo_codes
  for each row execute function public.touch_customer_promo_codes_updated_at();

alter table public.promo_codes enable row level security;
alter table public.customer_promo_codes enable row level security;

drop policy if exists "Customers can view own promo assignments" on public.customer_promo_codes;
create policy "Customers can view own promo assignments"
  on public.customer_promo_codes for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Customers can view active promo codes" on public.promo_codes;
create policy "Customers can view active promo codes"
  on public.promo_codes for select to authenticated
  using (
    is_active = true
    and exists (
      select 1 from public.customer_promo_codes cpc
      where cpc.promo_code_id = promo_codes.id
        and cpc.user_id = auth.uid()
    )
  );

drop policy if exists "Admins manage promo codes" on public.promo_codes;
create policy "Admins manage promo codes"
  on public.promo_codes for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins manage customer promo codes" on public.customer_promo_codes;
create policy "Admins manage customer promo codes"
  on public.customer_promo_codes for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

grant select, insert, update, delete on public.promo_codes to authenticated;
grant select, insert, update, delete on public.customer_promo_codes to authenticated;
