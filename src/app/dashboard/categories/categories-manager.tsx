"use client";

import { type FormEvent, useMemo, useState } from "react";
import {
  IconCheck,
  IconGripVertical,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";

import { createClient } from "@/lib/supabase/client";

export type MenuCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  is_active: boolean;
};

export type CategoryMenuItem = {
  id: string;
  category_id: string;
  image_url: string;
};

type CategoryForm = {
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  isActive: "true" | "false";
};

const inputClass =
  "h-10 w-full rounded-lg border border-(--line) bg-white px-3 text-[13px] text-foreground outline-none transition focus:border-(--accent) focus:ring-2 focus:ring-[#b8762f]/20";

function blankCategory(): CategoryForm {
  return { name: "", slug: "", description: "", sortOrder: "0", isActive: "true" };
}

function imagePathFromPublicUrl(imageUrl: string) {
  const marker = "/storage/v1/object/public/menu-images/";
  const markerIndex = imageUrl.indexOf(marker);
  return markerIndex === -1 ? null : decodeURIComponent(imageUrl.slice(markerIndex + marker.length));
}

type CategoriesManagerProps = {
  initialCategories: MenuCategory[];
  initialItems: CategoryMenuItem[];
  initialError?: string;
};

export function CategoriesManager({
  initialCategories,
  initialItems,
  initialError,
}: CategoriesManagerProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [items, setItems] = useState(initialItems);
  const [form, setForm] = useState<CategoryForm>(blankCategory);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const categoryCount = useMemo(
    () =>
      new Map(
        categories.map((category) => [
          category.id,
          items.filter((item) => item.category_id === category.id).length,
        ]),
      ),
    [categories, items],
  );

  async function loadCategories() {
    const supabase = createClient();
    const [categoriesResult, itemsResult] = await Promise.all([
      supabase
        .from("menu_categories")
        .select("id, name, slug, description, sort_order, is_active")
        .order("sort_order", { ascending: true }),
      supabase.from("menu_items").select("id, category_id, image_url"),
    ]);

    if (categoriesResult.error || itemsResult.error) {
      setError(categoriesResult.error?.message ?? itemsResult.error?.message ?? "Could not load categories.");
      return;
    }

    setCategories((categoriesResult.data ?? []) as MenuCategory[]);
    setItems((itemsResult.data ?? []) as CategoryMenuItem[]);
  }

  function resetForm() {
    setForm(blankCategory());
    setEditingId(null);
    setError(null);
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase(),
      description: form.description.trim(),
      sort_order: Number(form.sortOrder),
      is_active: form.isActive === "true",
    };
    const supabase = createClient();
    const { error: saveError } = editingId
      ? await supabase.from("menu_categories").update(payload).eq("id", editingId)
      : await supabase.from("menu_categories").insert(payload);

    if (saveError) {
      setError(saveError.message);
      setIsSaving(false);
      return;
    }

    resetForm();
    await loadCategories();
    setIsSaving(false);
  }

  function editCategory(category: MenuCategory) {
    setEditingId(category.id);
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description,
      sortOrder: String(category.sort_order),
      isActive: String(category.is_active) as "true" | "false",
    });
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteCategory(category: MenuCategory) {
    const itemCount = categoryCount.get(category.id) ?? 0;
    const message = itemCount
      ? `Delete ${category.name} and its ${itemCount} menu item${itemCount === 1 ? "" : "s"}?`
      : `Delete ${category.name}?`;
    if (!window.confirm(message)) return;

    setError(null);
    const supabase = createClient();
    const imagePaths = items
      .filter((item) => item.category_id === category.id)
      .map((item) => imagePathFromPublicUrl(item.image_url))
      .filter((path): path is string => Boolean(path));

    if (imagePaths.length) {
      const { error: imageError } = await supabase.storage.from("menu-images").remove(imagePaths);
      if (imageError) {
        setError(`Could not remove the category images: ${imageError.message}`);
        return;
      }
    }

    const { error: deleteError } = await supabase.from("menu_categories").delete().eq("id", category.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (editingId === category.id) resetForm();
    await loadCategories();
  }

  return (
    <div>
      <div className="mb-[18px]">
        <h1 className="font-serif text-xl font-bold text-foreground">
          Categories <span className="font-sans text-base font-normal text-(--muted)">· {categories.length}</span>
        </h1>
        <p className="mt-0.5 text-xs text-(--muted)">
          Organize how drinks are grouped on the Menu and customer-facing tabs.
        </p>
      </div>

      {error ? (
        <p role="alert" className="mb-3.5 rounded-xl border border-dashed border-[#d9b57a] bg-[#fdf3e3] px-3 py-2.5 text-xs leading-5 text-(--accent-strong)">
          {error}
        </p>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_1.2fr]">
        <form onSubmit={saveCategory} className="rounded-[14px] border border-(--line) bg-white p-6">
          <p className="text-[15px] font-bold text-foreground">
            {editingId ? "Edit category" : "Add a category"}
          </p>
          <p className="mb-[18px] mt-1 text-[11.5px] text-(--muted)">
            New categories immediately appear as a tab on the customer-facing menu.
          </p>

          <Field label="Category name">
            <input
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className={inputClass}
              placeholder="e.g. Sago"
              maxLength={80}
            />
          </Field>
          <Field label="Slug">
            <input
              required
              value={form.slug}
              onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
              className={inputClass}
              placeholder="e.g. sago"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              maxLength={100}
            />
          </Field>
          <Field label="Description">
            <textarea
              required
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="min-h-[60px] w-full resize-y rounded-lg border border-(--line) bg-white px-3 py-2.5 text-[13px] leading-6 text-foreground outline-none transition focus:border-(--accent) focus:ring-2 focus:ring-[#b8762f]/20"
              placeholder="A short description for this category"
              maxLength={300}
            />
          </Field>
          <Field label="Display order">
            <input
              required
              type="number"
              min="0"
              step="1"
              value={form.sortOrder}
              onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
              className={inputClass}
              placeholder="8"
            />
          </Field>
          <Field label="Visibility">
            <div className="flex overflow-hidden rounded-[9px] border border-(--line)">
              {[
                { value: "true" as const, label: "Visible", activeClass: "bg-(--green-soft) text-(--green)" },
                { value: "false" as const, label: "Hidden", activeClass: "bg-(--surface-tint) text-foreground" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, isActive: option.value }))}
                  className={`flex-1 px-2 py-2.5 text-center text-[12.5px] font-bold transition ${
                    form.isActive === option.value ? option.activeClass : "text-(--muted) hover:bg-(--surface)"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Field>

          <div className="mt-1.5 flex gap-2.5">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[9px] border border-(--accent) bg-(--accent) px-4 text-[12.5px] font-semibold text-white transition hover:bg-(--accent-strong) disabled:cursor-not-allowed disabled:opacity-60"
            >
              <IconPlus size={15} stroke={2.2} aria-hidden />
              {isSaving ? "Saving..." : editingId ? "Save category" : "Create category"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="h-10 rounded-[9px] border border-(--line) bg-white px-4 text-[12.5px] font-semibold text-foreground transition hover:border-(--accent)"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <section className="overflow-hidden rounded-[14px] border border-(--line) bg-white">
          <div className="px-[22px] pb-3.5 pt-5">
            <p className="text-[15px] font-bold text-foreground">All categories</p>
            <p className="mt-0.5 text-[11.5px] text-(--muted)">
              Display order controls tab order on the customer-facing menu.
            </p>
          </div>
          {categories.length === 0 ? (
            <p className="px-[22px] pb-10 pt-4 text-center text-[12.5px] text-(--muted)">
              No categories yet — create the first one with the form.
            </p>
          ) : (
            categories.map((category) => {
              const count = categoryCount.get(category.id) ?? 0;
              return (
                <div
                  key={category.id}
                  className="flex items-center gap-3 border-b border-(--line) px-4 py-[13px] last:border-b-0"
                >
                  <IconGripVertical size={16} stroke={1.6} className="shrink-0 text-(--muted)" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-foreground">
                    {category.name}
                  </span>
                  <span className="whitespace-nowrap rounded-[10px] bg-(--surface) px-2.5 py-1 text-[11px] text-(--muted)">
                    {count} item{count === 1 ? "" : "s"}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-[20px] px-2.5 py-[5px] text-[11px] font-bold ${
                      category.is_active
                        ? "bg-(--green-soft) text-(--green)"
                        : "bg-(--surface-tint) text-(--muted)"
                    }`}
                  >
                    {category.is_active ? (
                      <>
                        <IconCheck size={12} stroke={2.6} aria-hidden /> Visible
                      </>
                    ) : (
                      "Hidden"
                    )}
                  </span>
                  <div className="flex gap-1 text-(--muted)">
                    <button
                      type="button"
                      onClick={() => editCategory(category)}
                      className="grid size-8 place-items-center rounded-lg transition hover:bg-(--surface-tint) hover:text-foreground"
                      aria-label={`Edit ${category.name}`}
                    >
                      <IconPencil size={16} stroke={1.8} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteCategory(category)}
                      className="grid size-8 place-items-center rounded-lg transition hover:bg-(--red-soft) hover:text-(--red)"
                      aria-label={`Delete ${category.name}`}
                    >
                      <IconTrash size={16} stroke={1.8} aria-hidden />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <span className="mb-[7px] block text-[12.5px] font-semibold text-foreground">{label}</span>
      {children}
    </div>
  );
}
