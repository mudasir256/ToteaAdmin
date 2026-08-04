import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { getDashboardContext, getOrdersPageData } from "@/lib/dashboard/data";

import { OrdersManager } from "./orders-manager";

export default async function OrdersPage() {
  const [{ identity }, { orders, error }] = await Promise.all([
    getDashboardContext(),
    getOrdersPageData(),
  ]);

  return (
    <main className="min-h-dvh bg-(--surface) xl:grid xl:grid-cols-[230px_minmax(0,1fr)]">
      <DashboardSidebar email={identity.email} name={identity.name} activeItem="orders" />
      <section className="min-w-0 px-4 py-6 sm:px-7">
        <div className="mx-auto max-w-[1240px]">
          <header className="flex flex-wrap items-center justify-between gap-2.5">
            <div>
              <h1 className="font-serif text-xl font-bold text-foreground">
                Orders <span className="font-sans text-base font-normal text-(--muted)">· {orders.length}</span>
              </h1>
              <p className="mt-0.5 text-xs text-(--muted)">
                Track paid website orders from confirmation through completion.
              </p>
            </div>
          </header>
          <OrdersManager initialOrders={orders} initialError={error} />
        </div>
      </section>
    </main>
  );
}

