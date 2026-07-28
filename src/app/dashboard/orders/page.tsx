import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { getDashboardContext, getOrdersPageData } from "@/lib/dashboard/data";

import { OrdersManager } from "./orders-manager";

export default async function OrdersPage() {
  const [{ identity }, { orders, error }] = await Promise.all([
    getDashboardContext(),
    getOrdersPageData(),
  ]);

  return (
    <main className="min-h-dvh bg-(--surface) xl:grid xl:grid-cols-[236px_minmax(0,1fr)]">
      <DashboardSidebar email={identity.email} name={identity.name} activeItem="orders" />
      <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-[1240px]">
          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-(--line) pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--accent)">
                Service desk
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">Orders</h1>
              <p className="mt-1 text-sm leading-6 text-(--muted)">
                Track paid website orders from confirmation through completion.
              </p>
            </div>
            <p className="rounded-full border border-(--line) bg-white px-3.5 py-2 text-xs font-medium text-(--muted)">
              {orders.length} {orders.length === 1 ? "order" : "orders"}
            </p>
          </header>
          <OrdersManager initialOrders={orders} initialError={error} />
        </div>
      </section>
    </main>
  );
}

