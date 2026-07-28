import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { getDashboardContext } from "@/lib/dashboard/data";

import { ToppingsManager, type MenuTopping } from "./toppings-manager";

export default async function ToppingsPage() {
  const { supabase, identity } = await getDashboardContext();
  const { data, error } = await supabase
    .from("menu_toppings")
    .select("id, name, category, image_url, price, is_available, sort_order")
    .order("sort_order", { ascending: true });

  return (
    <main className="min-h-dvh bg-(--surface) xl:grid xl:grid-cols-[236px_minmax(0,1fr)]">
      <DashboardSidebar
        email={identity.email}
        name={identity.name}
        activeItem="toppings"
      />
      <section className="min-w-0 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-7xl">
          <header className="border-b border-(--line) pb-6">
            <p className="text-sm font-medium text-(--accent)">Main website content</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Toppings
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-(--muted)">
                  Manage the add-ons customers discover alongside the ToTea menu.
                </p>
              </div>
              <p className="rounded-full border border-(--line) bg-(--surface-raised) px-3.5 py-2 text-xs font-medium text-(--muted)">
                Changes publish live
              </p>
            </div>
          </header>
          <ToppingsManager
            initialToppings={(data ?? []) as MenuTopping[]}
            initialError={error?.message}
          />
        </div>
      </section>
    </main>
  );
}
