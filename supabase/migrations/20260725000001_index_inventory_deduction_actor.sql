create index inventory_order_deductions_deducted_by_idx
  on public.inventory_order_deductions (deducted_by)
  where deducted_by is not null;
