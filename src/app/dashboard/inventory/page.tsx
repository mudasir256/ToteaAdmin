import { getDashboardContext } from "@/lib/dashboard/data";

import {
  InventoryManager,
  type InventoryCategory,
  type InventoryItem,
} from "./inventory-manager";

export default async function InventoryPage() {
  const { supabase } = await getDashboardContext();

  const [categoriesResult, itemsResult] = await Promise.all([
    supabase
      .from("inventory_categories")
      .select("id, name, sort_order")
      .order("sort_order", { ascending: true }),
    supabase
      .from("inventory_items")
      .select(
        "id, category_id, name, current_quantity, unit, minimum_quantity, cost_per_unit, supplier, expiration_date, notes, is_active, inventory_categories(name)",
      )
      .order("name", { ascending: true }),
  ]);

  return (
    <section className="min-w-0 px-4 py-5 sm:px-7 xl:h-dvh xl:overflow-hidden">
      <div className="mx-auto flex h-full min-h-0 max-w-[1240px] flex-col">
        <header className="shrink-0">
          <div>
            <h1 className="font-serif text-xl font-bold text-foreground">Inventory</h1>
            <p className="mt-0.5 text-xs text-(--muted)">
              Receive supplies, record daily usage, and catch low stock before service begins.
            </p>
          </div>
        </header>

        <InventoryManager
          initialCategories={(categoriesResult.data ?? []) as InventoryCategory[]}
          initialItems={(itemsResult.data ?? []) as InventoryItem[]}
          initialError={categoriesResult.error?.message ?? itemsResult.error?.message}
        />
      </div>
    </section>
  );
}
