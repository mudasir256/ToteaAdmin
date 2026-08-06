import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { getDashboardContext } from "@/lib/dashboard/data";

import {
  MenuManager,
  type MenuCategory,
  type MenuItem,
  type MenuOptionLevel,
  type MenuToppingOption,
} from "./menu-manager";

export default async function MenuPage() {
  const { supabase, identity } = await getDashboardContext();

  const [categoriesResult, itemsResult, toppingsResult, levelsResult] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id, name, slug, description, sort_order, is_active")
      .order("sort_order", { ascending: true }),
    supabase
      .from("menu_items")
      .select("id, category_id, name, description, image_url, price, sizes, ingredients, calories, allergens, is_available, sort_order, recipe_required, menu_categories(name), menu_item_variants(id, size, price, sort_order)")
      .order("sort_order", { ascending: true }),
    supabase
      .from("menu_toppings")
      .select("id, name, category, price, is_available, sort_order")
      .order("sort_order", { ascending: true }),
    supabase
      .from("menu_option_levels")
      .select("id, kind, name, sort_order, is_default, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  return (
    <main className="min-h-dvh bg-(--surface) xl:grid xl:grid-cols-[230px_minmax(0,1fr)]">
      <DashboardSidebar email={identity.email} name={identity.name} activeItem="menu" />
      <section className="min-w-0 px-4 py-6 sm:px-7">
        <div className="mx-auto max-w-[1240px]">
          <MenuManager
            initialCategories={(categoriesResult.data ?? []) as MenuCategory[]}
            initialItems={(itemsResult.data ?? []) as MenuItem[]}
            initialToppings={(toppingsResult.data ?? []) as MenuToppingOption[]}
            initialOptionLevels={(levelsResult.data ?? []) as MenuOptionLevel[]}
            initialError={
              categoriesResult.error?.message ??
              itemsResult.error?.message ??
              toppingsResult.error?.message ??
              (levelsResult.error && !levelsResult.error.message.includes("schema cache")
                ? levelsResult.error.message
                : undefined)
            }
          />
        </div>
      </section>
    </main>
  );
}
