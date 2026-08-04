import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { getDashboardContext } from "@/lib/dashboard/data";

import {
  CategoriesManager,
  type CategoryMenuItem,
  type MenuCategory,
} from "./categories-manager";

export default async function CategoriesPage() {
  const { supabase, identity } = await getDashboardContext();

  const [categoriesResult, itemsResult] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id, name, slug, description, sort_order, is_active")
      .order("sort_order", { ascending: true }),
    supabase.from("menu_items").select("id, category_id, image_url"),
  ]);

  return (
    <main className="min-h-dvh bg-(--surface) xl:grid xl:grid-cols-[230px_minmax(0,1fr)]">
      <DashboardSidebar email={identity.email} name={identity.name} activeItem="categories" />
      <section className="min-w-0 px-4 py-6 sm:px-7">
        <div className="mx-auto max-w-[1240px]">
          <CategoriesManager
            initialCategories={(categoriesResult.data ?? []) as MenuCategory[]}
            initialItems={(itemsResult.data ?? []) as CategoryMenuItem[]}
            initialError={categoriesResult.error?.message ?? itemsResult.error?.message}
          />
        </div>
      </section>
    </main>
  );
}
