import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { getDashboardContext } from "@/lib/dashboard/data";

import { MenuManager, type MenuCategory, type MenuItem } from "./menu-manager";

export default async function MenuPage() {
  const { supabase, identity } = await getDashboardContext();

  const [categoriesResult, itemsResult] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id, name, slug, description, sort_order, is_active")
      .order("sort_order", { ascending: true }),
    supabase
      .from("menu_items")
      .select("id, category_id, name, slug, description, image_url, price, sizes, ingredients, calories, allergens, is_available, sort_order, recipe_required, menu_categories(name), menu_item_variants(id, size, price, sort_order)")
      .order("sort_order", { ascending: true }),
  ]);

  return (
    <main className="min-h-dvh bg-(--surface) xl:grid xl:grid-cols-[236px_minmax(0,1fr)]">
      <DashboardSidebar email={identity.email} name={identity.name} activeItem="menu" />
      <section className="min-w-0 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-7xl">
          <header className="border-b border-(--line) pb-6">
            <p className="text-sm font-medium text-(--accent)">Main website content</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Menu catalog</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-(--muted)">
                  Build the categories and drinks that customers discover on the ToTea menu.
                </p>
              </div>
              <p className="rounded-full border border-(--line) bg-(--surface-raised) px-3.5 py-2 text-xs font-medium text-(--muted)">
                Every field is required
              </p>
            </div>
          </header>
          <MenuManager
            initialCategories={(categoriesResult.data ?? []) as MenuCategory[]}
            initialItems={(itemsResult.data ?? []) as MenuItem[]}
            initialError={categoriesResult.error?.message ?? itemsResult.error?.message}
          />
        </div>
      </section>
    </main>
  );
}
