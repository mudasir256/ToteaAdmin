import { getDashboardContext } from "@/lib/dashboard/data";

import {
  RecipesManager,
  type RecipeInventoryItem,
  type RecipeLine,
  type RecipeMenuItem,
} from "./recipes-manager";

export default async function RecipesPage() {
  const { supabase } = await getDashboardContext();
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
    <section className="min-w-0 px-4 py-6 sm:px-7">
      <div className="mx-auto max-w-[1240px]">
        <header className="flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <h1 className="font-serif text-xl font-bold text-foreground">Recipes</h1>
            <p className="mt-0.5 text-xs text-(--muted)">
              Define exactly what each drink size consumes before it reaches the customer menu.
            </p>
          </div>
          <p className="rounded-full border border-(--line) bg-white px-3.5 py-2 text-xs font-medium text-(--muted)">
            One recipe per size
          </p>
        </header>
        <RecipesManager
          initialMenuItems={(menuResult.data ?? []) as RecipeMenuItem[]}
          initialInventoryItems={(inventoryResult.data ?? []) as RecipeInventoryItem[]}
          initialRecipes={(recipeResult.data ?? []) as RecipeLine[]}
          initialError={
            menuResult.error?.message ??
            inventoryResult.error?.message ??
            recipeResult.error?.message
          }
        />
      </div>
    </section>
  );
}
