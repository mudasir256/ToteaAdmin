import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { getCustomersPageData, getDashboardContext } from "@/lib/dashboard/data";

import { CustomersManager } from "./customers-manager";

export default async function CustomersPage() {
  const [{ identity }, { customers, error }] = await Promise.all([
    getDashboardContext(),
    getCustomersPageData(),
  ]);

  return (
    <main className="min-h-dvh bg-(--surface) xl:grid xl:grid-cols-[236px_minmax(0,1fr)]">
      <DashboardSidebar email={identity.email} name={identity.name} activeItem="customers" />
      <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-[1240px]">
          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-(--line) pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--accent)">
                Customer book
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">Customers</h1>
              <p className="mt-1 text-sm leading-6 text-(--muted)">
                View customer contact details and their website order history.
              </p>
            </div>
            <p className="rounded-full border border-(--line) bg-white px-3.5 py-2 text-xs font-medium text-(--muted)">
              {customers.length} {customers.length === 1 ? "customer" : "customers"}
            </p>
          </header>
          <CustomersManager initialCustomers={customers} initialError={error} />
        </div>
      </section>
    </main>
  );
}

