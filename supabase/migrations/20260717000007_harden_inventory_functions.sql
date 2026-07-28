revoke execute on function public.record_inventory_opening_balance() from public;
revoke execute on function public.record_inventory_opening_balance() from anon;
revoke execute on function public.record_inventory_opening_balance() from authenticated;

create index inventory_movements_created_by_idx
  on public.inventory_movements (created_by);
