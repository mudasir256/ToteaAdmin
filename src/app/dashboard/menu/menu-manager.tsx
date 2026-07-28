"use client";

import Image from "next/image";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  IconAdjustmentsHorizontal,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconCup,
  IconPencil,
  IconPhotoUp,
  IconPlus,
  IconTags,
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

export type MenuItemVariant = {
  id: string;
  size: string;
  price: number;
  sort_order: number;
};

export type MenuItem = {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  price: number;
  sizes: string;
  ingredients: string;
  calories: string;
  allergens: string;
  is_available: boolean;
  sort_order: number;
  recipe_required: boolean;
  menu_categories: { name: string } | { name: string }[] | null;
  menu_item_variants: MenuItemVariant[];
};

type CategoryForm = {
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  isActive: "true" | "false";
};

type ItemForm = {
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  variants: { size: string; price: string }[];
  ingredients: string;
  calories: string;
  allergens: string;
  isAvailable: "true" | "false";
  sortOrder: string;
};

const fieldClass =
  "h-11 w-full rounded-xl border border-(--line) bg-white px-3.5 text-sm text-foreground outline-none transition placeholder:text-[#829399] focus:border-(--accent) focus:ring-2 focus:ring-[#a86100]/20";
const textareaClass =
  "min-h-24 w-full resize-y rounded-xl border border-(--line) bg-white px-3.5 py-3 text-sm leading-6 text-foreground outline-none transition placeholder:text-[#829399] focus:border-(--accent) focus:ring-2 focus:ring-[#a86100]/20";
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const maxImageSize = 5 * 1024 * 1024;

function blankCategory(): CategoryForm {
  return { name: "", slug: "", description: "", sortOrder: "0", isActive: "true" };
}

function blankItem(categoryId = ""): ItemForm {
  return {
    categoryId,
    name: "",
    slug: "",
    description: "",
    imageUrl: "",
    variants: [
      { size: "Regular", price: "" },
      { size: "Large", price: "" },
    ],
    ingredients: "",
    calories: "",
    allergens: "",
    isAvailable: "false",
    sortOrder: "0",
  };
}

type MenuManagerProps = {
  initialCategories: MenuCategory[];
  initialItems: MenuItem[];
  initialError?: string;
};

export function MenuManager({ initialCategories, initialItems, initialError }: MenuManagerProps) {
  const [section, setSection] = useState<"items" | "categories">("items");
  const [categories, setCategories] = useState(initialCategories);
  const [items, setItems] = useState(initialItems);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(blankCategory);
  const [itemForm, setItemForm] = useState<ItemForm>(() => blankItem(initialCategories[0]?.id));
  const [itemImageFile, setItemImageFile] = useState<File | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const categoryCount = useMemo(
    () => new Map(categories.map((category) => [category.id, items.filter((item) => item.category_id === category.id).length])),
    [categories, items],
  );

  async function loadCatalog() {
    setIsLoading(true);
    const supabase = createClient();
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

    if (categoriesResult.error || itemsResult.error) {
      setError(categoriesResult.error?.message ?? itemsResult.error?.message ?? "Could not load the menu catalog.");
    } else {
      setCategories((categoriesResult.data ?? []) as MenuCategory[]);
      setItems((itemsResult.data ?? []) as MenuItem[]);
    }

    setIsLoading(false);
  }

  function resetCategoryForm() {
    setCategoryForm(blankCategory());
    setEditingCategoryId(null);
    setError(null);
  }

  function resetItemForm() {
    setItemForm(blankItem(categories[0]?.id));
    setItemImageFile(null);
    setEditingItemId(null);
    setError(null);
  }

  function updateVariant(
    index: number,
    field: "size" | "price",
    value: string,
  ) {
    setItemForm((form) => ({
      ...form,
      variants: form.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, [field]: value } : variant,
      ),
    }));
  }

  function addVariant() {
    setItemForm((form) => ({
      ...form,
      variants: [...form.variants, { size: "", price: "" }],
    }));
  }

  function removeVariant(index: number) {
    setItemForm((form) => ({
      ...form,
      variants: form.variants.filter((_, variantIndex) => variantIndex !== index),
    }));
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    const payload = {
      name: categoryForm.name.trim(),
      slug: categoryForm.slug.trim().toLowerCase(),
      description: categoryForm.description.trim(),
      sort_order: Number(categoryForm.sortOrder),
      is_active: categoryForm.isActive === "true",
    };
    const supabase = createClient();
    const { error: saveError } = editingCategoryId
      ? await supabase.from("menu_categories").update(payload).eq("id", editingCategoryId)
      : await supabase.from("menu_categories").insert(payload);

    if (saveError) {
      setError(saveError.message);
      setIsSaving(false);
      return;
    }

    resetCategoryForm();
    await loadCatalog();
    setIsSaving(false);
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    if (!itemImageFile && !itemForm.imageUrl) {
      setError("Choose an image before creating this menu item.");
      setIsSaving(false);
      return;
    }

    const variants = itemForm.variants.map((variant, index) => ({
      size: variant.size.trim(),
      price: Number(variant.price),
      sort_order: index,
    }));
    const sizeKeys = variants.map((variant) => variant.size.toLowerCase());
    if (
      variants.length === 0 ||
      variants.some(
        (variant) =>
          !variant.size ||
          !Number.isFinite(variant.price) ||
          variant.price <= 0,
      )
    ) {
      setError("Every size needs a name and a price greater than zero.");
      setIsSaving(false);
      return;
    }
    if (new Set(sizeKeys).size !== sizeKeys.length) {
      setError("Each size name must be unique.");
      setIsSaving(false);
      return;
    }

    const supabase = createClient();
    let uploadedImage: { path: string; publicUrl: string } | null = null;

    if (itemImageFile) {
      const extension = itemImageFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `menu/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("menu-images").upload(path, itemImageFile, {
        cacheControl: "3600",
        contentType: itemImageFile.type,
        upsert: false,
      });

      if (uploadError) {
        setError(uploadError.message);
        setIsSaving(false);
        return;
      }

      const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
      uploadedImage = { path, publicUrl: data.publicUrl };
    }

    const payload = {
      category_id: itemForm.categoryId,
      name: itemForm.name.trim(),
      slug: itemForm.slug.trim().toLowerCase(),
      description: itemForm.description.trim(),
      image_url: uploadedImage?.publicUrl ?? itemForm.imageUrl.trim(),
      ingredients: itemForm.ingredients.trim(),
      calories: itemForm.calories.trim(),
      allergens: itemForm.allergens.trim(),
      is_available: editingItemId ? itemForm.isAvailable === "true" : false,
      sort_order: Number(itemForm.sortOrder),
    };
    const { error: saveError } = await supabase.rpc(
      "save_menu_item_with_variants",
      {
        p_menu_item_id: editingItemId,
        p_item: payload,
        p_variants: variants,
      },
    );

    if (saveError) {
      if (uploadedImage) {
        await supabase.storage.from("menu-images").remove([uploadedImage.path]);
      }
      setError(saveError.message);
      setIsSaving(false);
      return;
    }

    const previousImagePath = imagePathFromPublicUrl(itemForm.imageUrl);
    if (uploadedImage && previousImagePath) {
      await supabase.storage.from("menu-images").remove([previousImagePath]);
    }

    resetItemForm();
    await loadCatalog();
    setIsSaving(false);
  }

  function editCategory(category: MenuCategory) {
    setSection("categories");
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name,
      slug: category.slug,
      description: category.description,
      sortOrder: String(category.sort_order),
      isActive: String(category.is_active) as "true" | "false",
    });
    setError(null);
  }

  function editItem(item: MenuItem) {
    setSection("items");
    setEditingItemId(item.id);
    setItemForm({
      categoryId: item.category_id,
      name: item.name,
      slug: item.slug,
      description: item.description,
      imageUrl: item.image_url,
      variants: sortedVariants(item).map((variant) => ({
        size: variant.size,
        price: String(variant.price),
      })),
      ingredients: item.ingredients,
      calories: item.calories,
      allergens: item.allergens,
      isAvailable: String(item.is_available) as "true" | "false",
      sortOrder: String(item.sort_order),
    });
    setItemImageFile(null);
    setError(null);
  }

  function selectItemImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!allowedImageTypes.has(file.type)) {
      setError("Choose a JPG, PNG, WebP, or AVIF image.");
      event.target.value = "";
      return;
    }
    if (file.size > maxImageSize) {
      setError("Image files must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    setItemImageFile(file);
    setError(null);
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

    if (editingCategoryId === category.id) resetCategoryForm();
    await loadCatalog();
  }

  async function deleteItem(item: MenuItem) {
    if (!window.confirm(`Delete ${item.name}?`)) return;

    setError(null);
    const supabase = createClient();
    const imagePath = imagePathFromPublicUrl(item.image_url);
    if (imagePath) {
      const { error: imageError } = await supabase.storage.from("menu-images").remove([imagePath]);
      if (imageError) {
        setError(`Could not remove the menu image: ${imageError.message}`);
        return;
      }
    }

    const { error: deleteError } = await supabase.from("menu_items").delete().eq("id", item.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (editingItemId === item.id) resetItemForm();
    await loadCatalog();
  }

  return (
    <div className="py-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-(--line) bg-(--surface-raised) p-1" role="tablist" aria-label="Menu catalog sections">
          <button
            type="button"
            role="tab"
            aria-selected={section === "items"}
            onClick={() => setSection("items")}
            className={`inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-(--accent) ${section === "items" ? "bg-foreground text-white shadow-sm" : "text-(--muted) hover:text-foreground"}`}
          >
            <IconCup size={16} stroke={1.9} aria-hidden={true} /> Menu items <span className="text-xs opacity-70">{items.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={section === "categories"}
            onClick={() => setSection("categories")}
            className={`inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-(--accent) ${section === "categories" ? "bg-foreground text-white shadow-sm" : "text-(--muted) hover:text-foreground"}`}
          >
            <IconTags size={16} stroke={1.9} aria-hidden={true} /> Categories <span className="text-xs opacity-70">{categories.length}</span>
          </button>
        </div>
        <button type="button" onClick={() => void loadCatalog()} disabled={isLoading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-(--line) bg-(--surface-raised) px-3.5 text-sm font-semibold text-(--muted) outline-none transition hover:border-(--accent) hover:text-(--accent-strong) focus-visible:ring-2 focus-visible:ring-(--accent) disabled:opacity-60">
          <IconAdjustmentsHorizontal size={17} stroke={1.8} aria-hidden={true} /> {isLoading ? "Refreshing..." : "Refresh catalog"}
        </button>
      </div>

      {error ? <p role="alert" className="mt-5 rounded-xl border border-[#c98b26]/35 bg-(--accent-soft) px-4 py-3 text-sm leading-6 text-[#7a4d00]">{error}</p> : null}

      {section === "categories" ? (
        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,0.82fr)_minmax(360px,1.18fr)]">
          <form onSubmit={saveCategory} className="rounded-2xl border border-(--line) bg-(--surface-raised) p-5 shadow-[0_18px_45px_rgba(21,58,67,0.05)] sm:p-6">
            <FormHeading icon={<IconTags size={18} stroke={1.8} aria-hidden={true} />} title={editingCategoryId ? "Edit category" : "Add a category"} copy="Categories organize the drinks on the public menu." />
            <div className="mt-6 grid gap-4">
              <Field label="Category name"><input required value={categoryForm.name} onChange={(event) => setCategoryForm((form) => ({ ...form, name: event.target.value }))} className={fieldClass} placeholder="Vietnamese Coffee" maxLength={80} /></Field>
              <Field label="Slug"><input required value={categoryForm.slug} onChange={(event) => setCategoryForm((form) => ({ ...form, slug: event.target.value }))} className={fieldClass} placeholder="vietnamese-coffee" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} /></Field>
              <Field label="Description"><textarea required value={categoryForm.description} onChange={(event) => setCategoryForm((form) => ({ ...form, description: event.target.value }))} className={textareaClass} placeholder="A short description for this category" maxLength={300} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Display order"><input required type="number" min="0" step="1" value={categoryForm.sortOrder} onChange={(event) => setCategoryForm((form) => ({ ...form, sortOrder: event.target.value }))} className={fieldClass} /></Field>
                <Field label="Visibility"><DropdownSelect value={categoryForm.isActive} onValueChange={(value) => setCategoryForm((form) => ({ ...form, isActive: value as "true" | "false" }))} ariaLabel="Category visibility" options={[{ value: "true", label: "Active" }, { value: "false", label: "Hidden" }]} /></Field>
              </div>
            </div>
            <FormActions saving={isSaving} editing={Boolean(editingCategoryId)} saveLabel="Save category" createLabel="Create category" onCancel={resetCategoryForm} />
          </form>
          <section className="overflow-hidden rounded-2xl border border-(--line) bg-(--surface-raised) shadow-[0_18px_45px_rgba(21,58,67,0.04)]">
            <div className="flex items-start justify-between gap-4 border-b border-(--line) px-5 py-5 sm:px-6"><div><p className="text-base font-semibold text-foreground">Category shelf</p><p className="mt-1 text-sm text-(--muted)">Order and visibility are reflected on the menu.</p></div><span className="grid size-9 place-items-center rounded-xl bg-(--surface-tint) text-foreground"><IconTags size={18} stroke={1.8} aria-hidden={true} /></span></div>
            {categories.length === 0 ? <EmptyState title="No categories yet" copy="Create a category before adding menu items." /> : <div className="divide-y divide-(--line)">{categories.map((category) => <article key={category.id} className="group flex items-start gap-4 px-5 py-5 sm:px-6"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-(--accent-soft) text-sm font-bold text-(--accent)">{String(category.sort_order + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-foreground">{category.name}</p><Status active={category.is_active} activeLabel="Active" inactiveLabel="Hidden" /></div><p className="mt-1 text-sm leading-6 text-(--muted)">{category.description}</p><p className="mt-2 text-xs font-medium text-[#789096]">{categoryCount.get(category.id) ?? 0} menu item{(categoryCount.get(category.id) ?? 0) === 1 ? "" : "s"} <span aria-hidden={true}>Ã‚Â·</span> /{category.slug}</p></div><RowActions onEdit={() => editCategory(category)} onDelete={() => void deleteCategory(category)} label={category.name} /></article>)}</div>}
          </section>
        </div>
      ) : (
        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <form onSubmit={saveItem} className="rounded-2xl border border-(--line) bg-(--surface-raised) p-5 shadow-[0_18px_45px_rgba(21,58,67,0.05)] sm:p-6">
            <FormHeading icon={<IconCup size={18} stroke={1.8} aria-hidden={true} />} title={editingItemId ? "Edit menu item" : "Add a menu item"} copy={editingItemId ? "Update the product details customers read on the menu." : "New products are saved as drafts until every size has a recipe."} />
            {categories.length === 0 ? <div className="mt-6 rounded-xl border border-dashed border-(--line) bg-(--surface-tint) p-5"><p className="font-semibold text-foreground">Create a category first</p><p className="mt-1 text-sm leading-6 text-(--muted)">Every menu item must belong to a category.</p><button type="button" onClick={() => setSection("categories")} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-white transition hover:bg-[#24505c]"><IconChevronRight size={17} aria-hidden={true} /> Go to categories</button></div> : <>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Category"><DropdownSelect value={itemForm.categoryId} onValueChange={(value) => setItemForm((form) => ({ ...form, categoryId: value }))} ariaLabel="Menu item category" options={categories.map((category) => ({ value: category.id, label: category.name }))} /></Field>
                <Field label="Menu item name"><input required value={itemForm.name} onChange={(event) => setItemForm((form) => ({ ...form, name: event.target.value }))} className={fieldClass} placeholder="Vietnamese Sea Salt Coffee" maxLength={120} /></Field>
                <Field label="Slug"><input required value={itemForm.slug} onChange={(event) => setItemForm((form) => ({ ...form, slug: event.target.value }))} className={fieldClass} placeholder="vietnamese-sea-salt-coffee" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} /></Field>
                <div className="sm:col-span-2"><ImageUploadField file={itemImageFile} hasCurrentImage={Boolean(itemForm.imageUrl)} required={!editingItemId && !itemForm.imageUrl} onChange={selectItemImage} /></div>
              </div>
              <div className="mt-4"><Field label="Description"><textarea required value={itemForm.description} onChange={(event) => setItemForm((form) => ({ ...form, description: event.target.value }))} className={textareaClass} placeholder="Describe the drink in the words customers will read." maxLength={1000} /></Field></div>
              <div className="mt-4">
                <SizePriceEditor
                  variants={itemForm.variants}
                  onAdd={addVariant}
                  onRemove={removeVariant}
                  onChange={updateVariant}
                />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Calories"><input required value={itemForm.calories} onChange={(event) => setItemForm((form) => ({ ...form, calories: event.target.value }))} className={fieldClass} placeholder="180Ã¢â‚¬â€œ250 cal" maxLength={60} /></Field>
                <Field label="Ingredients"><textarea required value={itemForm.ingredients} onChange={(event) => setItemForm((form) => ({ ...form, ingredients: event.target.value }))} className={textareaClass} placeholder="Vietnamese Coffee, Sea Salt Cream..." maxLength={1000} /></Field>
                <Field label="Allergens"><textarea required value={itemForm.allergens} onChange={(event) => setItemForm((form) => ({ ...form, allergens: event.target.value }))} className={textareaClass} placeholder="Dairy" maxLength={200} /></Field>
                <Field label="Availability"><DropdownSelect value={itemForm.isAvailable} onValueChange={(value) => setItemForm((form) => ({ ...form, isAvailable: value as "true" | "false" }))} ariaLabel="Menu item availability" options={editingItemId ? [{ value: "true", label: "Available" }, { value: "false", label: "Draft / unavailable" }] : [{ value: "false", label: "Draft — add recipes before publishing" }]} /></Field>
                <Field label="Display order"><input required type="number" min="0" step="1" value={itemForm.sortOrder} onChange={(event) => setItemForm((form) => ({ ...form, sortOrder: event.target.value }))} className={fieldClass} /></Field>
              </div>
              <FormActions saving={isSaving} editing={Boolean(editingItemId)} saveLabel="Save menu item" createLabel="Create menu item" onCancel={resetItemForm} />
            </>}
          </form>
          <section className="overflow-hidden rounded-2xl border border-(--line) bg-(--surface-raised) shadow-[0_18px_45px_rgba(21,58,67,0.04)]">
            <div className="flex items-start justify-between gap-4 border-b border-(--line) px-5 py-5 sm:px-6"><div><p className="text-base font-semibold text-foreground">Menu board</p><p className="mt-1 text-sm text-(--muted)">Products customers can see and order.</p></div><span className="grid size-9 place-items-center rounded-xl bg-(--accent-soft) text-(--accent)"><IconCup size={18} stroke={1.8} aria-hidden={true} /></span></div>
            {items.length === 0 ? (
              <EmptyState
                title="No menu items yet"
                copy={categories.length ? "Add the first drink to start building the menu." : "Create the first drink and upload its product image."}
              />
            ) : (
              <div className="divide-y divide-(--line)">
                {items.map((item) => (
                  <article key={item.id} className="group px-5 py-5 sm:px-6">
                    <div className="flex items-start gap-3">
                      <Image src={item.image_url} alt="" width={80} height={80} className="size-10 shrink-0 rounded-xl border border-(--line) bg-(--surface-tint) object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-foreground">{item.name}</p>
                          <Status active={item.is_available} activeLabel="Available" inactiveLabel="Off menu" />
                        </div>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-(--accent)">
                          {menuCategoryName(item.menu_categories)}
                        </p>
                      </div>
                      <RowActions onEdit={() => editItem(item)} onDelete={() => void deleteItem(item)} label={item.name} />
                    </div>
                    <p className="mt-4 text-sm leading-6 text-(--muted)">{item.description}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium">
                      {sortedVariants(item).map((variant) => (
                        <span key={variant.id} className="rounded-lg bg-(--accent-soft) px-2.5 py-1.5 text-(--accent-strong)">
                          {variant.size} · ${Number(variant.price).toFixed(2)}
                        </span>
                      ))}
                      <span className="rounded-lg bg-(--surface-tint) px-2.5 py-1.5 text-(--muted)">{item.calories}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2"><span className="text-sm font-medium text-foreground">{label}</span>{children}</label>;
}

function SizePriceEditor({
  variants,
  onAdd,
  onRemove,
  onChange,
}: {
  variants: ItemForm["variants"];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, field: "size" | "price", value: string) => void;
}) {
  return (
    <fieldset className="rounded-2xl border border-(--line) bg-(--surface-tint) p-4">
      <legend className="sr-only">Sizes and prices</legend>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Sizes and prices</p>
          <p className="mt-1 text-xs leading-5 text-(--muted)">
            Set the exact amount customers pay for each available size.
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-(--line) bg-white px-3 text-xs font-semibold text-(--accent-strong) outline-none transition hover:border-(--accent) focus-visible:ring-2 focus-visible:ring-(--accent)"
        >
          <IconPlus size={15} stroke={2} aria-hidden={true} />
          Add size
        </button>
      </div>
      <div className="mt-4 grid gap-3">
        {variants.map((variant, index) => (
          <div
            key={index}
            className="grid grid-cols-[minmax(0,1fr)_minmax(120px,0.7fr)_40px] gap-2"
          >
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-(--muted)">Size {index + 1}</span>
              <input
                required
                value={variant.size}
                onChange={(event) => onChange(index, "size", event.target.value)}
                className={fieldClass}
                placeholder={index === 0 ? "Regular" : "Large"}
                maxLength={60}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-(--muted)">Price</span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-semibold text-(--muted)">
                  $
                </span>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={variant.price}
                  onChange={(event) => onChange(index, "price", event.target.value)}
                  className={`${fieldClass} pl-7`}
                  placeholder={index === 0 ? "25.00" : "30.00"}
                />
              </div>
            </label>
            <button
              type="button"
              onClick={() => onRemove(index)}
              disabled={variants.length === 1}
              className="mt-[26px] grid size-10 place-items-center rounded-xl text-(--muted) outline-none transition hover:bg-[#fff1ee] hover:text-[#a33b2e] focus-visible:ring-2 focus-visible:ring-(--accent) disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={`Remove ${variant.size || `size ${index + 1}`}`}
            >
              <IconTrash size={17} stroke={1.8} aria-hidden={true} />
            </button>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

function DropdownSelect({ value, onValueChange, options, ariaLabel }: { value: string; onValueChange: (value: string) => void; options: { value: string; label: string }[]; ariaLabel: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  return <div ref={containerRef} className="relative"><button type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)} onKeyDown={(event) => { if (event.key === "Escape") setIsOpen(false); if (event.key === "ArrowDown") { event.preventDefault(); setIsOpen(true); } }} className="flex h-11 w-full items-center gap-3 rounded-xl border border-(--line) bg-(--surface-raised) px-3.5 text-left text-sm font-medium text-foreground shadow-[0_1px_0_rgba(21,58,67,0.02)] outline-none transition hover:border-[#b4ccca]  focus:ring-2 focus:ring-[#a86100]/20"><span className="min-w-0 flex-1 truncate">{selectedOption?.label}</span><span className={`grid size-8 shrink-0 place-items-center rounded-lg bg-(--surface-tint) text-(--accent) transition ${isOpen ? "rotate-180" : ""}`}><IconChevronDown size={17} stroke={2} aria-hidden={true} /></span></button>{isOpen ? <div role="listbox" aria-label={ariaLabel} className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-(--line) bg-white p-1.5 shadow-[0_16px_34px_rgba(21,58,67,0.16)]">{options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => { onValueChange(option.value); setIsOpen(false); }} className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-(--accent) ${option.value === value ? "bg-(--accent-soft) text-(--accent-strong)" : "text-foreground hover:bg-(--surface-tint)"}`}><span className="truncate">{option.label}</span>{option.value === value ? <IconCheck size={16} stroke={2.2} aria-hidden={true} /> : null}</button>)}</div> : null}</div>;
}

function ImageUploadField({ file, hasCurrentImage, required, onChange }: { file: File | null; hasCurrentImage: boolean; required: boolean; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <div className="grid min-w-0 gap-2"><span className="text-sm font-medium text-foreground">Menu image</span><label className="flex h-11 min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-(--line) bg-(--surface-tint) px-3.5 text-sm text-(--muted) transition hover:border-(--accent) hover:bg-(--accent-soft)"><IconPhotoUp size={18} stroke={1.8} className="shrink-0 text-(--accent)" aria-hidden={true} /><span className="min-w-0 flex-1 truncate font-medium text-foreground">{file ? file.name : hasCurrentImage ? "Current image saved Ã¢â‚¬â€ choose a new file to replace it" : "Choose a product image"}</span><span className="shrink-0 text-xs font-semibold text-(--accent)">Browse</span><input required={required} type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={onChange} className="sr-only" /></label><p className="text-xs leading-5 text-(--muted)">JPG, PNG, WebP, or AVIF. Maximum file size 5 MB.</p></div>;
}

function imagePathFromPublicUrl(imageUrl: string) {
  const marker = "/storage/v1/object/public/menu-images/";
  const markerIndex = imageUrl.indexOf(marker);
  return markerIndex === -1 ? null : decodeURIComponent(imageUrl.slice(markerIndex + marker.length));
}

function sortedVariants(item: MenuItem) {
  const variants = [...(item.menu_item_variants ?? [])].sort(
    (left, right) => left.sort_order - right.sort_order,
  );
  if (variants.length > 0) return variants;

  return item.sizes
    .split(",")
    .map((size) => size.trim())
    .filter(Boolean)
    .map((size, index) => ({
      id: `legacy-${index}-${size}`,
      size,
      price: item.price,
      sort_order: index,
    }));
}

function menuCategoryName(category: MenuItem["menu_categories"]) {
  if (Array.isArray(category)) return category[0]?.name ?? "Uncategorized";
  return category?.name ?? "Uncategorized";
}

function FormHeading({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) {
  return <div className="flex items-start gap-3"><span className="grid size-9 place-items-center rounded-xl bg-(--accent-soft) text-(--accent)">{icon}</span><div><p className="text-base font-semibold text-foreground">{title}</p><p className="mt-1 text-sm leading-6 text-(--muted)">{copy}</p></div></div>;
}

function FormActions({ saving, editing, saveLabel, createLabel, onCancel }: { saving: boolean; editing: boolean; saveLabel: string; createLabel: string; onCancel: () => void }) {
  return <div className="mt-6 flex flex-wrap gap-3"><button type="submit" disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-(--accent) px-5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(168,97,0,0.16)] transition hover:bg-(--accent-strong) active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"><IconPlus size={17} stroke={2} aria-hidden={true} />{saving ? "Saving..." : editing ? saveLabel : createLabel}</button>{editing ? <button type="button" onClick={onCancel} className="inline-flex h-11 items-center justify-center rounded-xl border border-(--line) px-4 text-sm font-semibold text-(--muted) transition hover:border-(--accent) hover:text-(--accent-strong)">Cancel</button> : null}</div>;
}

function Status({ active, activeLabel, inactiveLabel }: { active: boolean; activeLabel: string; inactiveLabel: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${active ? "bg-[#eaf7ef] text-[#26734b]" : "bg-[#f2f4f4] text-[#728084]"}`}>{active ? <IconCheck size={12} stroke={2.4} aria-hidden={true} /> : null}{active ? activeLabel : inactiveLabel}</span>;
}

function RowActions({ onEdit, onDelete, label }: { onEdit: () => void; onDelete: () => void; label: string }) {
  return <div className="flex shrink-0 items-center gap-1"><button type="button" onClick={onEdit} className="grid size-9 place-items-center rounded-xl text-(--muted) outline-none transition hover:bg-(--surface-tint) hover:text-foreground focus-visible:ring-2 focus-visible:ring-(--accent)" aria-label={`Edit ${label}`}><IconPencil size={17} stroke={1.8} aria-hidden={true} /></button><button type="button" onClick={onDelete} className="grid size-9 place-items-center rounded-xl text-(--muted) outline-none transition hover:bg-[#fff1ee] hover:text-[#a33b2e] focus-visible:ring-2 focus-visible:ring-(--accent)" aria-label={`Delete ${label}`}><IconTrash size={17} stroke={1.8} aria-hidden={true} /></button></div>;
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return <div className="px-6 py-14 text-center"><p className="text-base font-semibold text-foreground">{title}</p><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-(--muted)">{copy}</p></div>;
}
