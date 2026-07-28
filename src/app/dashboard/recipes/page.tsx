import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { getDashboardContext } from "@/lib/dashboard/data";

import {
  RecipesManager,
  type RecipeInventoryItem,
  type RecipeLine,
  type RecipeMenuItem,
} from "./recipes-manager";

export default async function RecipesPage() {
  const { supabase, identity } = await getDashboardContext();
  const [menuResult, inventoryResult, recipeResult] = await Promise.all([
    supabase
      .from("menu_items")
      .select("id, name, sizes, is_available, recipe_required")
      .order("sort_order", { ascending: true }),
    supabase
      .from("inventory_items")
      .select("id, name, unit, current_quantity")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("menu_item_recipes")
      .select("id, menu_item_id, size, inventory_item_id, quantity")
      .order("created_at", { ascending: true }),
  ]);

  return (
    <main className="min-h-dvh bg-(--surface) xl:grid xl:grid-cols-[236px_minmax(0,1fr)]">
      <DashboardSidebar
        email={identity.email}
        name={identity.name}
        activeItem="recipes"
      />
      <section className="min-w-0 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-7xl">
          <header className="border-b border-(--line) pb-6">
            <p className="text-sm font-medium text-(--accent)">
              Inventory automation
            </p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Recipe workshop
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-(--muted)">
                  Define exactly what each drink size consumes before it reaches
                  the customer menu.
                </p>
              </div>
              <p className="rounded-full border border-(--line) bg-white px-3.5 py-2 text-xs font-medium text-(--muted)">
                One recipe per size
              </p>
            </div>
          </header>
          <RecipesManager
            initialMenuItems={(menuResult.data ?? []) as RecipeMenuItem[]}
            initialInventoryItems={
              (inventoryResult.data ?? []) as RecipeInventoryItem[]
            }
            initialRecipes={(recipeResult.data ?? []) as RecipeLine[]}
            initialError={
              menuResult.error?.message ??
              inventoryResult.error?.message ??
              recipeResult.error?.message
            }
          />
        </div>
      </section>
    </main>
  );
}
