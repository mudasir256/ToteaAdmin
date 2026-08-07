create or replace function public.admin_dashboard_stats()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'orders_today_count',
    (select count(*)::int from public.orders where created_at >= date_trunc('day', now())),
    'revenue_today',
    (select coalesce(sum(total), 0) from public.orders
      where payment_status = 'paid' and created_at >= date_trunc('day', now())),
    'open_order_count',
    (select count(*)::int from public.orders
      where order_status in ('pending', 'confirmed', 'processing', 'ready')),
    'paid_total',
    (select coalesce(sum(total), 0) from public.orders where payment_status = 'paid'),
    'customer_count',
    (select count(*)::int from public.profiles where role = 'customer')
  );
$$;

grant execute on function public.admin_dashboard_stats() to authenticated;
