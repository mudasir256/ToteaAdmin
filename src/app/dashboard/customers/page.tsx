import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { getCustomersPageData, getDashboardContext } from "@/lib/dashboard/data";

import { CustomersManager } from "./customers-manager";

export default async function CustomersPage() {
  const [{ identity }, { customers, error }] = await Promise.all([
    getDashboardContext(),
    getCustomersPageData(),
  ]);

  return (
    <main className="min-h-dvh bg-(--surface) xl:grid xl:grid-cols-[230px_minmax(0,1fr)]">
      <DashboardSidebar email={identity.email} name={identity.name} activeItem="customers" />
      <section className="min-w-0 px-4 py-6 sm:px-7">
        <div className="mx-auto max-w-[1240px]">
          <header className="flex flex-wrap items-center justify-between gap-2.5">
            <div>
              <h1 className="font-serif text-xl font-bold text-foreground">
                Customers <span className="font-sans text-base font-normal text-(--muted)">· {customers.length}</span>
              </h1>
              <p className="mt-0.5 text-xs text-(--muted)">
                View customer contact details and their website order history.
              </p>
            </div>
          </header>
          <CustomersManager initialCustomers={customers} initialError={error} />
        </div>
      </section>
    </main>
  );
}

