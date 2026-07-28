import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { getDashboardContext } from "@/lib/dashboard/data";

import {
  InventoryManager,
  type InventoryCategory,
  type InventoryItem,
} from "./inventory-manager";

export default async function InventoryPage() {
  const { supabase, identity } = await getDashboardContext();

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
    <main className="min-h-dvh bg-(--surface) xl:grid xl:h-dvh xl:grid-cols-[236px_minmax(0,1fr)] xl:overflow-hidden">
      <DashboardSidebar
        email={identity.email}
        name={identity.name}
        activeItem="inventory"
      />
      <section className="min-w-0 px-4 py-4 sm:px-6 lg:px-8 lg:py-5 xl:overflow-hidden">
        <div className="mx-auto flex h-full min-h-0 max-w-[1240px] flex-col">
          <header className="shrink-0 border-b border-(--line) pb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--accent)">Stockroom control</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Inventory ledger
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-5 text-(--muted)">
                Receive supplies, record daily usage, and catch low stock before service begins.
              </p>
            </div>
          </header>

          <InventoryManager
            initialCategories={(categoriesResult.data ?? []) as InventoryCategory[]}
            initialItems={(itemsResult.data ?? []) as InventoryItem[]}
            initialError={
              categoriesResult.error?.message ??
              itemsResult.error?.message
            }
          />
        </div>
      </section>
    </main>
  );
}
