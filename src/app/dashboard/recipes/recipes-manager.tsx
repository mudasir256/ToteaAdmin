"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  IconAlertTriangle,
  IconCheck,
  IconChefHat,
  IconChevronDown,
  IconPencil,
  IconPlus,
  IconScale,
  IconTrash,
} from "@tabler/icons-react";

import { createClient } from "@/lib/supabase/client";

export type RecipeMenuItem = {
  id: string;
  name: string;
  sizes: string;
  is_available: boolean;
  recipe_required: boolean;
};

export type RecipeInventoryItem = {
  id: string;
  name: string;
  unit: string;
  current_quantity: number;
};

export type RecipeLine = {
  id: string;
  menu_item_id: string;
  size: string;
  inventory_item_id: string;
  quantity: number;
};

type RecipesManagerProps = {
  initialMenuItems: RecipeMenuItem[];
  initialInventoryItems: RecipeInventoryItem[];
  initialRecipes: RecipeLine[];
  initialError?: string;
};

const fieldClass =
  "h-11 w-full rounded-xl border border-(--line) bg-white px-3.5 text-sm text-foreground outline-none transition placeholder:text-[#829399] focus:border-(--accent) focus:ring-2 focus:ring-[#a86100]/20";

function sizesFor(item: RecipeMenuItem | undefined) {
  return (item?.sizes ?? "")
    .split(",")
    .map((size) => size.trim())
    .filter(Boolean);
}

export function RecipesManager({
  initialMenuItems,
  initialInventoryItems,
  initialRecipes,
  initialError,
}: RecipesManagerProps) {
  const [menuItems, setMenuItems] = useState(initialMenuItems);
  const [recipes, setRecipes] = useState(initialRecipes);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState(
    initialMenuItems[0]?.id ?? "",
  );
  const [selectedSize, setSelectedSize] = useState(
    sizesFor(initialMenuItems[0])[0] ?? "",
  );
  const [inventoryItemId, setInventoryItemId] = useState(
    initialInventoryItems[0]?.id ?? "",
  );
  const [quantity, setQuantity] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const selectedMenuItem = menuItems.find(
    (item) => item.id === selectedMenuItemId,
  );
  const sizes = sizesFor(selectedMenuItem);
  const selectedInventoryItem = initialInventoryItems.find(
    (item) => item.id === inventoryItemId,
  );
  const visibleLines = recipes.filter(
    (recipe) =>
      recipe.menu_item_id === selectedMenuItemId &&
      recipe.size.toLowerCase() === selectedSize.toLowerCase(),
  );
  const completedSizes = useMemo(
    () =>
      new Set(
        recipes
          .filter((recipe) => recipe.menu_item_id === selectedMenuItemId)
          .map((recipe) => recipe.size.toLowerCase()),
      ),
    [recipes, selectedMenuItemId],
  );
  const recipeComplete =
    sizes.length > 0 &&
    sizes.every((size) => completedSizes.has(size.toLowerCase()));

  async function refreshWorkspace() {
    setIsRefreshing(true);
    const supabase = createClient();
    const [menuResult, recipeResult] = await Promise.all([
      supabase
        .from("menu_items")
        .select("id, name, sizes, is_available, recipe_required")
        .order("sort_order", { ascending: true }),
      supabase
        .from("menu_item_recipes")
        .select("id, menu_item_id, size, inventory_item_id, quantity")
        .order("created_at", { ascending: true }),
    ]);

    if (menuResult.error || recipeResult.error) {
      setError(
        menuResult.error?.message ??
          recipeResult.error?.message ??
          "Could not refresh the recipe workspace.",
      );
    } else {
      setMenuItems((menuResult.data ?? []) as RecipeMenuItem[]);
      setRecipes((recipeResult.data ?? []) as RecipeLine[]);
      setError(null);
    }
    setIsRefreshing(false);
  }

  function chooseMenuItem(value: string) {
    const item = menuItems.find((entry) => entry.id === value);
    setSelectedMenuItemId(value);
    setSelectedSize(sizesFor(item)[0] ?? "");
    resetForm();
  }

  function resetForm() {
    setEditingId(null);
    setQuantity("");
    setInventoryItemId(initialInventoryItems[0]?.id ?? "");
    setError(null);
  }

  async function saveRecipeLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    const payload = {
      menu_item_id: selectedMenuItemId,
      size: selectedSize,
      inventory_item_id: inventoryItemId,
      quantity: Number(quantity),
    };
    const supabase = createClient();
    const { error: saveError } = editingId
      ? await supabase
          .from("menu_item_recipes")
          .update(payload)
          .eq("id", editingId)
      : await supabase.from("menu_item_recipes").insert(payload);

    if (saveError) {
      setError(
        saveError.code === "23505"
          ? "That inventory item is already part of this size recipe."
          : saveError.message,
      );
      setIsSaving(false);
      return;
    }

    resetForm();
    await refreshWorkspace();
    setIsSaving(false);
  }

  function editRecipeLine(line: RecipeLine) {
    setEditingId(line.id);
    setInventoryItemId(line.inventory_item_id);
    setQuantity(String(line.quantity));
    setError(null);
  }

  async function deleteRecipeLine(line: RecipeLine) {
    const item = initialInventoryItems.find(
      (entry) => entry.id === line.inventory_item_id,
    );
    if (!window.confirm(`Remove ${item?.name ?? "this ingredient"}?`)) return;

    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("menu_item_recipes")
      .delete()
      .eq("id", line.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (editingId === line.id) resetForm();
    await refreshWorkspace();
  }

  async function publishMenuItem() {
    if (!selectedMenuItem || !recipeComplete) return;

    setError(null);
    setIsSaving(true);
    const supabase = createClient();
    const { error: publishError } = await supabase
      .from("menu_items")
      .update({ is_available: true })
      .eq("id", selectedMenuItem.id);

    if (publishError) {
      setError(publishError.message);
    } else {
      await refreshWorkspace();
    }
    setIsSaving(false);
  }

  if (menuItems.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-(--line) bg-white px-6 py-16 text-center">
        <IconChefHat
          size={24}
          stroke={1.7}
          className="mx-auto text-(--accent)"
          aria-hidden
        />
        <p className="mt-4 font-semibold text-foreground">Create a menu item first</p>
        <p className="mt-2 text-sm text-(--muted)">
          Recipes connect menu sizes to the ingredients stored in inventory.
        </p>
      </div>
    );
  }

  return (
    <div className="py-6 sm:py-8">
      {error ? (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-[#c98b26]/35 bg-(--accent-soft) px-4 py-3 text-sm leading-6 text-[#7a4d00]"
        >
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-(--line) bg-white p-4 shadow-[0_18px_45px_rgba(21,58,67,0.04)] sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <label className="text-sm font-medium text-foreground">
              Menu item
            </label>
            <div className="mt-2">
              <DropdownSelect
                value={selectedMenuItemId}
                onValueChange={chooseMenuItem}
                ariaLabel="Choose a menu item"
                options={menuItems.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refreshWorkspace()}
            disabled={isRefreshing}
            className="h-11 rounded-xl border border-(--line) px-4 text-sm font-semibold text-(--muted) transition hover:border-(--accent) hover:text-foreground disabled:opacity-60"
          >
            {isRefreshing ? "Refreshing..." : "Refresh recipes"}
          </button>
        </div>

        <div className="mt-5 border-t border-(--line) pt-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-(--muted)">
                Recipe readiness
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {sizes.map((size) => {
                  const complete = completedSizes.has(size.toLowerCase());
                  return (
                    <span
                      key={size}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${
                        complete
                          ? "bg-[#e8f5ef] text-[#247158]"
                          : "bg-(--accent-soft) text-(--accent-strong)"
                      }`}
                    >
                      {complete ? (
                        <IconCheck size={14} stroke={2.3} aria-hidden />
                      ) : (
                        <IconAlertTriangle size={14} stroke={2} aria-hidden />
                      )}
                      {size}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  selectedMenuItem?.is_available
                    ? "bg-[#e8f5ef] text-[#247158]"
                    : "bg-[#f2f4f4] text-[#66777c]"
                }`}
              >
                {selectedMenuItem?.is_available ? "Live on menu" : "Draft"}
              </span>
              {!selectedMenuItem?.is_available ? (
                <button
                  type="button"
                  onClick={() => void publishMenuItem()}
                  disabled={!recipeComplete || isSaving}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-(--accent) px-4 text-sm font-semibold text-white transition hover:bg-(--accent-strong) disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <IconCheck size={16} stroke={2.2} aria-hidden />
                  Publish item
                </button>
              ) : null}
            </div>
          </div>
          {!recipeComplete ? (
            <p className="mt-3 text-xs leading-5 text-(--muted)">
              Add at least one inventory ingredient to every size before publishing.
            </p>
          ) : null}
          {selectedMenuItem?.is_available &&
          !selectedMenuItem.recipe_required &&
          !recipeComplete ? (
            <p className="mt-3 rounded-xl border border-[#c98b26]/25 bg-[#fff8ea] px-3.5 py-3 text-xs leading-5 text-[#7a4d00]">
              This imported item remains live during setup. Complete its recipes so
              paid orders can update inventory.
            </p>
          ) : null}
        </div>
      </section>

      <div className="mt-5">
        <div
          className="inline-flex flex-wrap rounded-xl border border-(--line) bg-white p-1"
          role="tablist"
          aria-label="Recipe sizes"
        >
          {sizes.map((size) => (
            <button
              key={size}
              type="button"
              role="tab"
              aria-selected={selectedSize === size}
              onClick={() => {
                setSelectedSize(size);
                resetForm();
              }}
              className={`h-9 rounded-lg px-4 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-(--accent) ${
                selectedSize === size
                  ? "bg-foreground text-white shadow-sm"
                  : "text-(--muted) hover:text-foreground"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(340px,0.78fr)_minmax(0,1.22fr)]">
        <form
          onSubmit={saveRecipeLine}
          className="rounded-2xl border border-(--line) bg-white p-5 shadow-[0_18px_45px_rgba(21,58,67,0.04)] sm:p-6"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-(--accent-soft) text-(--accent)">
              <IconScale size={18} stroke={1.8} aria-hidden />
            </span>
            <div>
              <p className="font-semibold text-foreground">
                {editingId ? "Edit ingredient" : `Add to ${selectedSize}`}
              </p>
              <p className="mt-1 text-sm leading-6 text-(--muted)">
                Enter the amount consumed by one drink.
              </p>
            </div>
          </div>

          {initialInventoryItems.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-(--line) bg-(--surface-tint) p-5">
              <p className="font-semibold text-foreground">
                Add inventory items first
              </p>
              <p className="mt-1 text-sm leading-6 text-(--muted)">
                A recipe needs active ingredients or packaging from Inventory.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">
                    Inventory item
                  </label>
                  <div className="mt-2">
                    <DropdownSelect
                      value={inventoryItemId}
                      onValueChange={setInventoryItemId}
                      ariaLabel="Choose an inventory item"
                      options={initialInventoryItems.map((item) => ({
                        value: item.id,
                        label: `${item.name} · ${item.unit}`,
                      }))}
                    />
                  </div>
                </div>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Quantity used
                  </span>
                  <div className="relative">
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      className={`${fieldClass} pr-20`}
                      placeholder="18"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-(--muted)">
                      {selectedInventoryItem?.unit ?? "unit"}
                    </span>
                  </div>
                </label>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-(--accent) px-5 text-sm font-semibold text-white transition hover:bg-(--accent-strong) disabled:opacity-60"
                >
                  <IconPlus size={17} stroke={2} aria-hidden />
                  {isSaving
                    ? "Saving..."
                    : editingId
                      ? "Save ingredient"
                      : "Add ingredient"}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="h-11 rounded-xl border border-(--line) px-4 text-sm font-semibold text-(--muted) transition hover:border-(--accent) hover:text-foreground"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </>
          )}
        </form>

        <section className="overflow-hidden rounded-2xl border border-(--line) bg-white shadow-[0_18px_45px_rgba(21,58,67,0.04)]">
          <div className="flex items-start justify-between gap-4 border-b border-(--line) px-5 py-5 sm:px-6">
            <div>
              <p className="font-semibold text-foreground">{selectedSize} recipe</p>
              <p className="mt-1 text-sm text-(--muted)">
                Ingredients are multiplied by the customer’s ordered quantity.
              </p>
            </div>
            <span className="rounded-full bg-(--surface-tint) px-3 py-1.5 text-xs font-semibold text-(--muted)">
              {visibleLines.length}{" "}
              {visibleLines.length === 1 ? "ingredient" : "ingredients"}
            </span>
          </div>

          {visibleLines.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <IconChefHat
                size={24}
                stroke={1.7}
                className="mx-auto text-(--accent)"
                aria-hidden
              />
              <p className="mt-4 font-semibold text-foreground">
                This size has no recipe yet
              </p>
              <p className="mt-2 text-sm text-(--muted)">
                Add every ingredient and packaging item consumed by one drink.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-(--line)">
              {visibleLines.map((line) => {
                const inventoryItem = initialInventoryItems.find(
                  (item) => item.id === line.inventory_item_id,
                );
                return (
                  <article
                    key={line.id}
                    className="flex items-center gap-4 px-5 py-4 sm:px-6"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-(--surface-tint) text-(--accent)">
                      <IconScale size={17} stroke={1.8} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">
                        {inventoryItem?.name ?? "Archived inventory item"}
                      </p>
                      <p className="mt-1 text-xs text-(--muted)">
                        Available:{" "}
                        {Number(inventoryItem?.current_quantity ?? 0).toFixed(2)}{" "}
                        {inventoryItem?.unit ?? ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-xl bg-(--accent-soft) px-3 py-2 font-mono text-sm font-semibold text-(--accent-strong)">
                      {Number(line.quantity).toFixed(2)}{" "}
                      {inventoryItem?.unit ?? ""}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => editRecipeLine(line)}
                        className="grid size-9 place-items-center rounded-xl text-(--muted) transition hover:bg-(--surface-tint) hover:text-foreground focus-visible:ring-2 focus-visible:ring-(--accent)"
                        aria-label={`Edit ${inventoryItem?.name ?? "ingredient"}`}
                      >
                        <IconPencil size={16} stroke={1.8} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteRecipeLine(line)}
                        className="grid size-9 place-items-center rounded-xl text-(--muted) transition hover:bg-[#fff1ee] hover:text-[#a33b2e] focus-visible:ring-2 focus-visible:ring-(--accent)"
                        aria-label={`Delete ${inventoryItem?.name ?? "ingredient"}`}
                      >
                        <IconTrash size={16} stroke={1.8} aria-hidden />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DropdownSelect({
  value,
  onValueChange,
  options,
  ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  ariaLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption =
    options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-11 w-full items-center gap-3 rounded-xl border border-(--line) bg-white px-3.5 text-left text-sm font-medium text-foreground outline-none transition hover:border-[#b4ccca] focus:ring-2 focus:ring-[#a86100]/20"
      >
        <span className="min-w-0 flex-1 truncate">{selectedOption?.label}</span>
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-lg bg-(--surface-tint) text-(--accent) transition ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          <IconChevronDown size={17} stroke={2} aria-hidden />
        </span>
      </button>
      {isOpen ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-(--line) bg-white p-1.5 shadow-[0_16px_34px_rgba(21,58,67,0.16)]"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onValueChange(option.value);
                setIsOpen(false);
              }}
              className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-(--accent) ${
                option.value === value
                  ? "bg-(--accent-soft) text-(--accent-strong)"
                  : "text-foreground hover:bg-(--surface-tint)"
              }`}
            >
              <span className="truncate">{option.label}</span>
              {option.value === value ? (
                <IconCheck size={16} stroke={2.2} aria-hidden />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
