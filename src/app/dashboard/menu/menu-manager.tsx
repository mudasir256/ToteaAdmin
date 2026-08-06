"use client";

import Image from "next/image";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  IconBan,
  IconCheck,
  IconPencil,
  IconPhotoUp,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconX,
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

export type MenuToppingOption = {
  id: string;
  name: string;
  category: "standard" | "cream";
  price: number;
  is_available: boolean;
  sort_order: number;
};

export type MenuOptionLevel = {
  id: string;
  kind: "sugar" | "ice";
  name: string;
  sort_order: number;
  is_default: boolean;
  is_active: boolean;
};

type Availability = "available" | "sold_out" | "draft";

type ItemForm = {
  categoryId: string;
  name: string;
  description: string;
  imageUrl: string;
  variants: { size: string; price: string }[];
  ingredients: string;
  calories: string;
  allergens: string;
  availability: Availability;
  sortOrder: string;
};

type OptionFormState = {
  sugarEnabled: boolean;
  iceEnabled: boolean;
  standardToppingsEnabled: boolean;
  creamToppingsEnabled: boolean;
  defaultSugarLevelId: string | null;
  defaultIceLevelId: string | null;
  selectedToppingIds: Set<string>;
};

type MenuManagerProps = {
  initialCategories: MenuCategory[];
  initialItems: MenuItem[];
  initialToppings: MenuToppingOption[];
  initialOptionLevels: MenuOptionLevel[];
  initialError?: string;
};

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const maxImageSize = 5 * 1024 * 1024;

const slideInputClass =
  "h-10 w-full rounded-lg border border-(--line) bg-white px-3 text-[13px] text-foreground outline-none transition focus:border-(--accent) focus:ring-2 focus:ring-[#b8762f]/20";
const slideTextareaClass =
  "min-h-[60px] w-full resize-y rounded-lg border border-(--line) bg-white px-3 py-2.5 text-[13px] leading-6 text-foreground outline-none transition focus:border-(--accent) focus:ring-2 focus:ring-[#b8762f]/20";
const chipBase =
  "rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition";

const availabilityOptions: Array<{
  value: Availability;
  label: string;
  activeClass: string;
}> = [
  { value: "available", label: "✓ Available", activeClass: "bg-(--green-soft) text-(--green)" },
  { value: "sold_out", label: "⛔ Sold Out", activeClass: "bg-(--red-soft) text-(--red)" },
  { value: "draft", label: "Draft", activeClass: "bg-(--surface-tint) text-(--muted)" },
];

/** Screenshot defaults — used when menu_option_levels isn't seeded yet. */
const FALLBACK_OPTION_LEVELS: MenuOptionLevel[] = [
  { id: "fallback-sugar-0", kind: "sugar", name: "Less Sugar", sort_order: 0, is_default: true, is_active: true },
  { id: "fallback-sugar-1", kind: "sugar", name: "Light Sugar", sort_order: 1, is_default: false, is_active: true },
  { id: "fallback-sugar-2", kind: "sugar", name: "Minimal Sugar", sort_order: 2, is_default: false, is_active: true },
  { id: "fallback-sugar-3", kind: "sugar", name: "No Added", sort_order: 3, is_default: false, is_active: true },
  { id: "fallback-sugar-4", kind: "sugar", name: "Super Sweet", sort_order: 4, is_default: false, is_active: true },
  { id: "fallback-ice-0", kind: "ice", name: "No Ice", sort_order: 0, is_default: false, is_active: true },
  { id: "fallback-ice-1", kind: "ice", name: "Less Ice", sort_order: 1, is_default: false, is_active: true },
  { id: "fallback-ice-2", kind: "ice", name: "Normal Ice", sort_order: 2, is_default: true, is_active: true },
  { id: "fallback-ice-3", kind: "ice", name: "More Ice", sort_order: 3, is_default: false, is_active: true },
];

function resolveOptionLevels(levels: MenuOptionLevel[]) {
  const active = levels.filter((level) => level.is_active);
  const hasSugar = active.some((level) => level.kind === "sugar");
  const hasIce = active.some((level) => level.kind === "ice");
  if (hasSugar && hasIce) return active;
  return [
    ...(hasSugar ? active.filter((level) => level.kind === "sugar") : FALLBACK_OPTION_LEVELS.filter((level) => level.kind === "sugar")),
    ...(hasIce ? active.filter((level) => level.kind === "ice") : FALLBACK_OPTION_LEVELS.filter((level) => level.kind === "ice")),
  ];
}

function isPersistedLevelId(id: string | null) {
  return Boolean(id && !id.startsWith("fallback-"));
}

function blankItem(categoryId = ""): ItemForm {
  return {
    categoryId,
    name: "",
    description: "",
    imageUrl: "",
    variants: [
      { size: "Regular", price: "" },
      { size: "Large", price: "" },
    ],
    ingredients: "See product details",
    calories: "",
    allergens: "See product details",
    availability: "draft",
    sortOrder: "0",
  };
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

function priceLabel(item: MenuItem) {
  const variants = sortedVariants(item);
  if (variants.length === 0) return `$${Number(item.price).toFixed(2)}`;
  const prices = variants.map((variant) => Number(variant.price));
  const lowest = Math.min(...prices);
  return prices.length > 1 ? `from $${lowest.toFixed(2)}` : `$${lowest.toFixed(2)}`;
}

function availabilityFromItem(item: MenuItem): Availability {
  if (item.is_available) return "available";
  if (item.recipe_required) return "draft";
  return "sold_out";
}

function defaultLevelId(levels: MenuOptionLevel[], kind: "sugar" | "ice") {
  const filtered = levels.filter((level) => level.kind === kind && level.is_active);
  return filtered.find((level) => level.is_default)?.id ?? filtered[0]?.id ?? null;
}

function defaultSelectedToppingIds(toppings: MenuToppingOption[]) {
  return new Set(toppings.filter((topping) => topping.is_available).map((topping) => topping.id));
}

function defaultOptionState(
  toppings: MenuToppingOption[],
  levels: MenuOptionLevel[],
): OptionFormState {
  return {
    sugarEnabled: true,
    iceEnabled: true,
    standardToppingsEnabled: true,
    creamToppingsEnabled: true,
    defaultSugarLevelId: defaultLevelId(levels, "sugar"),
    defaultIceLevelId: defaultLevelId(levels, "ice"),
    selectedToppingIds: defaultSelectedToppingIds(toppings),
  };
}

function isMissingTableError(message: string | null | undefined) {
  if (!message) return false;
  return (
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("menu_item_option_settings") ||
    message.includes("menu_item_toppings")
  );
}

function toppingLabel(topping: MenuToppingOption) {
  if (topping.price === 0) return `${topping.name} — Free`;
  return topping.name;
}

export function MenuManager({
  initialCategories,
  initialItems,
  initialToppings,
  initialOptionLevels,
  initialError,
}: MenuManagerProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [items, setItems] = useState(initialItems);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusMenu, setStatusMenu] = useState<{ itemId: string; top: number; left: number } | null>(null);
  const [slideoverOpen, setSlideoverOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(() => blankItem(initialCategories[0]?.id));
  const optionLevels = useMemo(
    () => resolveOptionLevels(initialOptionLevels),
    [initialOptionLevels],
  );

  const [optionForm, setOptionForm] = useState<OptionFormState>(() =>
    defaultOptionState(initialToppings, resolveOptionLevels(initialOptionLevels)),
  );
  const [itemImageFile, setItemImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [optionsWarning, setOptionsWarning] = useState<string | null>(null);

  const sugarLevels = useMemo(
    () =>
      optionLevels
        .filter((level) => level.kind === "sugar")
        .sort((left, right) => left.sort_order - right.sort_order),
    [optionLevels],
  );

  const iceLevels = useMemo(
    () =>
      optionLevels
        .filter((level) => level.kind === "ice")
        .sort((left, right) => left.sort_order - right.sort_order),
    [optionLevels],
  );

  const standardToppings = useMemo(
    () =>
      initialToppings
        .filter((topping) => topping.category === "standard")
        .sort((left, right) => left.sort_order - right.sort_order),
    [initialToppings],
  );

  const creamToppings = useMemo(
    () =>
      initialToppings
        .filter((topping) => topping.category === "cream")
        .sort((left, right) => left.sort_order - right.sort_order),
    [initialToppings],
  );

  const editingItem = useMemo(
    () => items.find((item) => item.id === editingItemId) ?? null,
    [editingItemId, items],
  );

  const selectedCategoryName = useMemo(
    () => categories.find((category) => category.id === itemForm.categoryId)?.name ?? "Uncategorized",
    [categories, itemForm.categoryId],
  );

  useEffect(() => {
    if (!statusMenu) return;
    function close() {
      setStatusMenu(null);
    }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [statusMenu]);

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
        .select(
          "id, category_id, name, description, image_url, price, sizes, ingredients, calories, allergens, is_available, sort_order, recipe_required, menu_categories(name), menu_item_variants(id, size, price, sort_order)",
        )
        .order("sort_order", { ascending: true }),
    ]);

    if (categoriesResult.error || itemsResult.error) {
      setError(
        categoriesResult.error?.message ??
          itemsResult.error?.message ??
          "Could not load the menu catalog.",
      );
    } else {
      setCategories((categoriesResult.data ?? []) as MenuCategory[]);
      setItems((itemsResult.data ?? []) as MenuItem[]);
    }

    setIsLoading(false);
  }

  async function loadItemOptions(itemId: string): Promise<OptionFormState | null> {
    const supabase = createClient();
    const [settingsResult, toppingsResult] = await Promise.all([
      supabase.from("menu_item_option_settings").select("*").eq("menu_item_id", itemId).maybeSingle(),
      supabase.from("menu_item_toppings").select("topping_id").eq("menu_item_id", itemId),
    ]);

    if (
      isMissingTableError(settingsResult.error?.message) ||
      isMissingTableError(toppingsResult.error?.message)
    ) {
      return null;
    }

    if (settingsResult.error || toppingsResult.error) {
      return null;
    }

    const settings = settingsResult.data;
    const toppingIds = toppingsResult.data?.map((row) => row.topping_id) ?? [];

    if (!settings && toppingIds.length === 0) {
      return null;
    }

    return {
      sugarEnabled: settings?.sugar_enabled ?? true,
      iceEnabled: settings?.ice_enabled ?? true,
      standardToppingsEnabled: settings?.standard_toppings_enabled ?? true,
      creamToppingsEnabled: settings?.cream_toppings_enabled ?? true,
      defaultSugarLevelId:
        settings?.default_sugar_level_id ?? defaultLevelId(optionLevels, "sugar"),
      defaultIceLevelId: settings?.default_ice_level_id ?? defaultLevelId(optionLevels, "ice"),
      selectedToppingIds:
        toppingIds.length > 0
          ? new Set(toppingIds)
          : defaultSelectedToppingIds(initialToppings),
    };
  }

  async function persistItemOptions(menuItemId: string, options: OptionFormState) {
    const supabase = createClient();

    const { error: settingsError } = await supabase.from("menu_item_option_settings").upsert(
      {
        menu_item_id: menuItemId,
        sugar_enabled: true,
        ice_enabled: true,
        standard_toppings_enabled: options.standardToppingsEnabled,
        cream_toppings_enabled: options.creamToppingsEnabled,
        default_sugar_level_id: isPersistedLevelId(options.defaultSugarLevelId)
          ? options.defaultSugarLevelId
          : null,
        default_ice_level_id: isPersistedLevelId(options.defaultIceLevelId)
          ? options.defaultIceLevelId
          : null,
      },
      { onConflict: "menu_item_id" },
    );

    if (settingsError) {
      if (isMissingTableError(settingsError.message)) {
        return "Option settings were not saved — run the latest database migration when ready.";
      }
      return settingsError.message;
    }

    const { error: deleteError } = await supabase
      .from("menu_item_toppings")
      .delete()
      .eq("menu_item_id", menuItemId);

    if (deleteError) {
      if (isMissingTableError(deleteError.message)) {
        return "Topping selections were not saved — run the latest database migration when ready.";
      }
      return deleteError.message;
    }

    const selectedIdsList = [...options.selectedToppingIds];
    if (selectedIdsList.length === 0) {
      return null;
    }

    const { error: insertError } = await supabase.from("menu_item_toppings").insert(
      selectedIdsList.map((toppingId) => ({
        menu_item_id: menuItemId,
        topping_id: toppingId,
      })),
    );

    if (insertError) {
      if (isMissingTableError(insertError.message)) {
        return "Topping selections were not saved — run the latest database migration when ready.";
      }
      return insertError.message;
    }

    return null;
  }

  function toggleRow(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((current) =>
      current.size === items.length ? new Set() : new Set(items.map((item) => item.id)),
    );
  }

  async function setAvailability(ids: string[], isAvailable: boolean) {
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("menu_items")
      .update({ is_available: isAvailable })
      .in("id", ids);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setItems((current) =>
      current.map((item) => (ids.includes(item.id) ? { ...item, is_available: isAvailable } : item)),
    );
    setSelectedIds(new Set());
  }

  function openStatusMenu(event: React.MouseEvent, itemId: string) {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setStatusMenu({ itemId, top: rect.bottom + 6, left: rect.left });
  }

  function openCreate() {
    setEditingItemId(null);
    setItemForm(blankItem(categories[0]?.id));
    setOptionForm(defaultOptionState(initialToppings, optionLevels));
    setItemImageFile(null);
    setError(null);
    setOptionsWarning(null);
    setIsLoadingOptions(false);
    setSlideoverOpen(true);
  }

  async function openEdit(item: MenuItem) {
    setEditingItemId(item.id);
    setItemForm({
      categoryId: item.category_id,
      name: item.name,
      description: item.description,
      imageUrl: item.image_url,
      variants: sortedVariants(item).map((variant) => ({
        size: variant.size,
        price: String(variant.price),
      })),
      ingredients: item.ingredients,
      calories: item.calories,
      allergens: item.allergens,
      availability: availabilityFromItem(item),
      sortOrder: String(item.sort_order),
    });
    setOptionForm(defaultOptionState(initialToppings, optionLevels));
    setItemImageFile(null);
    setError(null);
    setOptionsWarning(null);
    setIsLoadingOptions(true);
    setSlideoverOpen(true);

    const loadedOptions = await loadItemOptions(item.id);
    if (loadedOptions) {
      setOptionForm(loadedOptions);
    }
    setIsLoadingOptions(false);
  }

  function closeSlideover() {
    setSlideoverOpen(false);
    setEditingItemId(null);
    setItemImageFile(null);
    setIsLoadingOptions(false);
  }

  function clearFormFields() {
    setItemForm((form) => ({ ...form, description: "" }));
    setOptionForm(defaultOptionState(initialToppings, optionLevels));
    setError(null);
  }

  function updateVariant(index: number, field: "size" | "price", value: string) {
    setItemForm((form) => ({
      ...form,
      variants: form.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, [field]: value } : variant,
      ),
    }));
  }

  function addVariant() {
    setItemForm((form) => ({ ...form, variants: [...form.variants, { size: "", price: "" }] }));
  }

  function removeVariant(index: number) {
    setItemForm((form) => ({
      ...form,
      variants: form.variants.filter((_, variantIndex) => variantIndex !== index),
    }));
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

  function toggleTopping(toppingId: string) {
    setOptionForm((current) => {
      const next = new Set(current.selectedToppingIds);
      if (next.has(toppingId)) next.delete(toppingId);
      else next.add(toppingId);
      return { ...current, selectedToppingIds: next };
    });
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setOptionsWarning(null);
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
      variants.some((variant) => !variant.size || !Number.isFinite(variant.price) || variant.price <= 0)
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
      description: itemForm.description.trim(),
      image_url: uploadedImage?.publicUrl ?? itemForm.imageUrl.trim(),
      ingredients: itemForm.ingredients.trim(),
      calories: itemForm.calories.trim(),
      allergens: itemForm.allergens.trim(),
      is_available: itemForm.availability === "available",
      sort_order: Number(itemForm.sortOrder),
    };
    const { data: savedMenuItemId, error: saveError } = await supabase.rpc(
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

    const menuItemId = editingItemId ?? (typeof savedMenuItemId === "string" ? savedMenuItemId : null);
    if (menuItemId) {
      const optionsWarningMessage = await persistItemOptions(menuItemId, optionForm);
      if (optionsWarningMessage) {
        setOptionsWarning(optionsWarningMessage);
      }
    }

    closeSlideover();
    await loadCatalog();
    setIsSaving(false);
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

    if (editingItemId === item.id) closeSlideover();
    await loadCatalog();
  }

  const selectedCount = selectedIds.size;

  return (
    <div>
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h1 className="font-serif text-xl font-bold text-foreground">
            Menu items <span className="font-sans text-base font-normal text-(--muted)">· {items.length}</span>
          </h1>
          <p className="mt-0.5 text-xs text-(--muted)">
            Click a status pill to change it instantly. Select rows for bulk actions. Click the pencil for full details.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadCatalog()}
            disabled={isLoading}
            className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-(--line) bg-white px-4 text-[12.5px] font-semibold text-foreground transition hover:border-(--accent) hover:text-(--accent-strong) disabled:opacity-60"
          >
            <IconRefresh size={15} stroke={2} aria-hidden />
            {isLoading ? "Refreshing..." : "Refresh Menu"}
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-(--accent) bg-(--accent) px-4 text-[12.5px] font-semibold text-white transition hover:bg-(--accent-strong)"
          >
            <IconPlus size={15} stroke={2.2} aria-hidden />
            Add item
          </button>
        </div>
      </div>

      {error && !slideoverOpen ? (
        <p
          role="alert"
          className="mb-3.5 rounded-xl border border-dashed border-[#d9b57a] bg-[#fdf3e3] px-3 py-2.5 text-xs leading-5 text-(--accent-strong)"
        >
          {error}
        </p>
      ) : null}

      {optionsWarning && !slideoverOpen ? (
        <p className="mb-3.5 rounded-xl border border-dashed border-(--line) bg-(--surface-tint) px-3 py-2.5 text-xs leading-5 text-(--muted)">
          {optionsWarning}
        </p>
      ) : null}

      {selectedCount > 0 ? (
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-[#3f2f22] px-[18px] py-3 text-white">
          <span className="text-[12.5px]">
            <b>{selectedCount} selected</b>
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void setAvailability([...selectedIds], false)}
              className="rounded-lg bg-white/12 px-3 py-2 text-xs font-semibold transition hover:bg-white/20"
            >
              ⛔ Mark Sold Out
            </button>
            <button
              type="button"
              onClick={() => void setAvailability([...selectedIds], true)}
              className="rounded-lg bg-white/12 px-3 py-2 text-xs font-semibold transition hover:bg-white/20"
            >
              ✓ Mark Available
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="rounded-lg bg-white/12 px-3 py-2 text-xs font-semibold transition hover:bg-white/20"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[14px] border border-(--line) bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                <th className="w-[34px] border-b border-(--line) bg-[#fbf8f3] px-3.5 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedCount === items.length}
                    onChange={toggleAll}
                    aria-label="Select all menu items"
                    className="accent-(--accent)"
                  />
                </th>
                {["Item", "Category", "Price", "Status"].map((heading) => (
                  <th
                    key={heading}
                    className="border-b border-(--line) bg-[#fbf8f3] px-3.5 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.04em] text-(--muted)"
                  >
                    {heading}
                  </th>
                ))}
                <th className="w-[84px] border-b border-(--line) bg-[#fbf8f3] px-3.5 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.04em] text-(--muted)">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center text-[12.5px] text-(--muted)">
                    {categories.length === 0
                      ? "Create a category first, then add the first drink."
                      : "No menu items yet — add the first drink."}
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-(--line) transition last:border-b-0 hover:bg-[#fcfaf6]">
                    <td className="px-3.5 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleRow(item.id)}
                        aria-label={`Select ${item.name}`}
                        className="accent-(--accent)"
                      />
                    </td>
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Image
                          src={item.image_url}
                          alt=""
                          width={76}
                          height={76}
                          className="size-[38px] shrink-0 rounded-lg border border-(--line) bg-(--surface-tint) object-cover"
                        />
                        <span className="text-[13px] font-medium text-foreground">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className="whitespace-nowrap rounded-[10px] bg-(--accent-soft) px-2.5 py-1 text-[10.5px] font-bold text-(--accent-strong)">
                        {menuCategoryName(item.menu_categories)}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-[13px] text-foreground">{priceLabel(item)}</td>
                    <td className="px-3.5 py-2.5">
                      <button
                        type="button"
                        onClick={(event) => openStatusMenu(event, item.id)}
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[20px] px-2.5 py-[5px] text-[11px] font-bold ${
                          item.is_available
                            ? "bg-(--green-soft) text-(--green)"
                            : "bg-(--red-soft) text-(--red)"
                        }`}
                      >
                        {item.is_available ? (
                          <>
                            <IconCheck size={12} stroke={2.6} aria-hidden /> Available
                          </>
                        ) : (
                          <>
                            <IconBan size={12} stroke={2.4} aria-hidden /> Sold Out
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <div className="flex gap-1 text-(--muted)">
                        <button
                          type="button"
                          onClick={() => void openEdit(item)}
                          className="grid size-8 place-items-center rounded-lg transition hover:bg-(--surface-tint) hover:text-foreground"
                          aria-label={`Edit ${item.name}`}
                        >
                          <IconPencil size={16} stroke={1.8} aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteItem(item)}
                          className="grid size-8 place-items-center rounded-lg transition hover:bg-(--red-soft) hover:text-(--red)"
                          aria-label={`Delete ${item.name}`}
                        >
                          <IconTrash size={16} stroke={1.8} aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 text-[11.5px] text-(--muted)">
          Showing {items.length} of {items.length} items
        </div>
      </div>

      {statusMenu ? (
        <div
          className="fixed z-50 min-w-[170px] rounded-[9px] border border-(--line) bg-white p-[5px] shadow-[0_10px_26px_rgba(0,0,0,0.12)]"
          style={{ top: statusMenu.top, left: statusMenu.left }}
        >
          <button
            type="button"
            onClick={() => {
              void setAvailability([statusMenu.itemId], true);
              setStatusMenu(null);
            }}
            className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-2 text-left text-xs font-semibold text-(--green) transition hover:bg-(--surface)"
          >
            <IconCheck size={13} stroke={2.4} aria-hidden /> Available
          </button>
          <button
            type="button"
            onClick={() => {
              void setAvailability([statusMenu.itemId], false);
              setStatusMenu(null);
            }}
            className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-2 text-left text-xs font-semibold text-(--red) transition hover:bg-(--surface)"
          >
            <IconBan size={13} stroke={2.2} aria-hidden /> Sold Out
          </button>
        </div>
      ) : null}

      {slideoverOpen ? (
        <>
          <div className="fixed inset-0 z-[60] bg-[#4a3626]/40" onClick={closeSlideover} aria-hidden />
          <form
            onSubmit={saveItem}
            className="fixed right-0 top-0 z-[61] flex h-dvh w-[600px] max-w-[94vw] flex-col bg-white shadow-[-10px_0_40px_rgba(0,0,0,0.15)]"
          >
            <header className="flex items-center justify-between gap-4 border-b border-(--line) px-6 py-[18px]">
              <div>
                <p className="font-serif text-[17px] font-semibold text-foreground">
                  {editingItem ? itemForm.name || editingItem.name : "Add a menu item"}
                </p>
                <p className="mt-0.5 text-[11px] text-(--muted)">
                  {editingItem
                    ? `${selectedCategoryName} · Editing existing item`
                    : "New items are saved as drafts until every size has a recipe."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeSlideover}
                className="grid size-8 shrink-0 place-items-center rounded-full bg-(--surface) text-foreground transition hover:bg-(--surface-tint)"
                aria-label="Close editor"
              >
                <IconX size={15} stroke={2} aria-hidden />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-[22px]">
              {categories.length === 0 ? (
                <p className="rounded-xl border border-dashed border-(--line) bg-(--surface-tint) px-4 py-5 text-[12.5px] text-(--muted)">
                  Create a category first — every menu item must belong to a category.
                </p>
              ) : (
                <>
                  <SlideField label="Menu image">
                    <label className="flex cursor-pointer items-center gap-3 rounded-[10px] border-[1.5px] border-dashed border-(--line) bg-[#fafcf9] p-3 transition hover:border-(--accent)">
                      {itemForm.imageUrl && !itemImageFile ? (
                        <Image
                          src={itemForm.imageUrl}
                          alt=""
                          width={48}
                          height={48}
                          className="size-12 shrink-0 rounded-lg border border-(--line) bg-(--surface-tint) object-cover"
                        />
                      ) : null}
                      <IconPhotoUp size={20} stroke={1.7} className="shrink-0 text-(--accent)" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                        {itemImageFile
                          ? itemImageFile.name
                          : itemForm.imageUrl
                            ? "Current image saved — choose a new file to replace it"
                            : "Choose a product image"}
                        <span className="block text-[10px] font-normal text-(--muted)">
                          JPG, PNG, WebP, or AVIF · max 5 MB
                        </span>
                      </span>
                      <span className="shrink-0 text-[11.5px] font-bold text-(--accent-strong)">Browse</span>
                      <input
                        required={!editingItemId && !itemForm.imageUrl}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/avif"
                        onChange={selectItemImage}
                        className="sr-only"
                      />
                    </label>
                  </SlideField>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <SlideField label="Category">
                      <select
                        required
                        value={itemForm.categoryId}
                        onChange={(event) =>
                          setItemForm((form) => ({ ...form, categoryId: event.target.value }))
                        }
                        className="h-10 w-full rounded-lg border border-(--line) bg-white px-3 text-[13px] text-foreground outline-none transition focus:border-(--accent) focus:ring-2 focus:ring-[#b8762f]/20"
                      >
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </SlideField>
                    <SlideField label="Menu item name">
                      <input
                        required
                        value={itemForm.name}
                        onChange={(event) => setItemForm((form) => ({ ...form, name: event.target.value }))}
                        className={slideInputClass}
                        placeholder="Sea Salt Coffee"
                        maxLength={120}
                      />
                    </SlideField>
                  </div>

                  <SlideField label="Description">
                    <textarea
                      required
                      value={itemForm.description}
                      onChange={(event) =>
                        setItemForm((form) => ({ ...form, description: event.target.value }))
                      }
                      className={slideTextareaClass}
                      placeholder="Describe the drink in the words customers will read."
                      maxLength={1000}
                    />
                  </SlideField>

                  <SlideField label="Availability">
                    <div className="flex overflow-hidden rounded-[9px] border border-(--line)">
                      {availabilityOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setItemForm((form) => ({ ...form, availability: option.value }))
                          }
                          className={`flex-1 px-2 py-2.5 text-center text-xs font-bold transition ${
                            itemForm.availability === option.value
                              ? option.activeClass
                              : "text-(--muted) hover:bg-(--surface)"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </SlideField>

                  <div className="mt-5 border-t border-(--line) pt-[18px]">
                    <p className="text-sm font-bold text-foreground">Options &amp; Toppings</p>
                    <p className="mb-3.5 mt-0.5 text-[11px] text-(--muted)">
                      Sugar and ice are compulsory on every drink (not inventory). Toppings lists are managed in their own tabs.
                    </p>

                    {isLoadingOptions ? (
                      <p className="mb-3 text-[11px] text-(--muted)">Loading item options…</p>
                    ) : null}

                    <div className="grid gap-3">
                      <OptionCard title="Sugar Level" compulsory>
                        <div className="flex flex-wrap gap-1.5">
                          {sugarLevels.map((level) => {
                            const isDefault = optionForm.defaultSugarLevelId === level.id;
                            return (
                              <button
                                key={level.id}
                                type="button"
                                onClick={() =>
                                  setOptionForm((current) => ({
                                    ...current,
                                    sugarEnabled: true,
                                    defaultSugarLevelId: level.id,
                                  }))
                                }
                                className={
                                  isDefault
                                    ? `${chipBase} border-(--accent) bg-(--accent) text-white`
                                    : `${chipBase} border-(--line) bg-(--surface) text-foreground`
                                }
                              >
                                {level.name}
                                {isDefault ? " ★" : ""}
                              </button>
                            );
                          })}
                        </div>
                      </OptionCard>

                      <OptionCard title="Ice Level" compulsory>
                        <div className="flex flex-wrap gap-1.5">
                          {iceLevels.map((level) => {
                            const isDefault = optionForm.defaultIceLevelId === level.id;
                            return (
                              <button
                                key={level.id}
                                type="button"
                                onClick={() =>
                                  setOptionForm((current) => ({
                                    ...current,
                                    iceEnabled: true,
                                    defaultIceLevelId: level.id,
                                  }))
                                }
                                className={
                                  isDefault
                                    ? `${chipBase} border-(--accent) bg-(--accent) text-white`
                                    : `${chipBase} border-(--line) bg-(--surface) text-foreground`
                                }
                              >
                                {level.name}
                                {isDefault ? " ★" : ""}
                              </button>
                            );
                          })}
                        </div>
                      </OptionCard>

                      <OptionCard
                        title="Toppings — Standard"
                        enabled={optionForm.standardToppingsEnabled}
                        onToggle={(enabled) =>
                          setOptionForm((current) => ({ ...current, standardToppingsEnabled: enabled }))
                        }
                      >
                        <div className="flex flex-wrap gap-1.5">
                          {standardToppings.map((topping) => {
                            const isSelected = optionForm.selectedToppingIds.has(topping.id);
                            const isFree = topping.price === 0;
                            return (
                              <button
                                key={topping.id}
                                type="button"
                                onClick={() => toggleTopping(topping.id)}
                                className={
                                  isSelected
                                    ? isFree
                                      ? `${chipBase} border-(--green) bg-(--green) text-white`
                                      : `${chipBase} border-(--accent) bg-(--accent) text-white`
                                    : `${chipBase} border-(--line) bg-(--surface) text-foreground`
                                }
                              >
                                {toppingLabel(topping)}
                              </button>
                            );
                          })}
                        </div>
                      </OptionCard>

                      <OptionCard
                        title="Cream Top"
                        enabled={optionForm.creamToppingsEnabled}
                        onToggle={(enabled) =>
                          setOptionForm((current) => ({ ...current, creamToppingsEnabled: enabled }))
                        }
                      >
                        <div className="flex flex-wrap gap-1.5">
                          {creamToppings.map((topping) => {
                            const isSelected = optionForm.selectedToppingIds.has(topping.id);
                            const isFree = topping.price === 0;
                            return (
                              <button
                                key={topping.id}
                                type="button"
                                onClick={() => toggleTopping(topping.id)}
                                className={
                                  isSelected
                                    ? isFree
                                      ? `${chipBase} border-(--green) bg-(--green) text-white`
                                      : `${chipBase} border-(--accent) bg-(--accent) text-white`
                                    : `${chipBase} border-(--line) bg-(--surface) text-foreground`
                                }
                              >
                                {toppingLabel(topping)}
                              </button>
                            );
                          })}
                        </div>
                      </OptionCard>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-(--line) pt-[18px]">
                    <p className="text-sm font-bold text-foreground">Sizes &amp; Prices</p>
                    <p className="mb-3.5 mt-0.5 text-[11px] text-(--muted)">
                      Set the exact amount customers pay for each available size.
                    </p>
                    <div className="rounded-[10px] border border-(--line) bg-[#fcfaf6] p-3.5">
                      <div className="grid gap-2.5">
                        {itemForm.variants.map((variant, index) => (
                          <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(110px,0.6fr)_36px] gap-2">
                            <input
                              required
                              value={variant.size}
                              onChange={(event) => updateVariant(index, "size", event.target.value)}
                              className={slideInputClass}
                              placeholder={index === 0 ? "Regular" : "Large"}
                              maxLength={60}
                              aria-label={`Size ${index + 1} name`}
                            />
                            <div className="relative">
                              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[13px] font-semibold text-(--muted)">
                                $
                              </span>
                              <input
                                required
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={variant.price}
                                onChange={(event) => updateVariant(index, "price", event.target.value)}
                                className={`${slideInputClass} pl-7`}
                                placeholder="5.25"
                                aria-label={`Size ${index + 1} price`}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeVariant(index)}
                              disabled={itemForm.variants.length === 1}
                              className="grid size-10 place-items-center rounded-lg text-(--muted) transition hover:bg-(--red-soft) hover:text-(--red) disabled:cursor-not-allowed disabled:opacity-30"
                              aria-label={`Remove size ${index + 1}`}
                            >
                              <IconTrash size={16} stroke={1.8} aria-hidden />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={addVariant}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-[20px] border border-dashed border-(--line) bg-(--surface) px-3 py-1.5 text-[11.5px] font-bold text-(--accent-strong) transition hover:border-(--accent)"
                      >
                        <IconPlus size={13} stroke={2.4} aria-hidden /> Add size
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-(--line) pt-[18px]">
                    <SlideField label="Calories">
                      <input
                        required
                        value={itemForm.calories}
                        onChange={(event) => setItemForm((form) => ({ ...form, calories: event.target.value }))}
                        className={slideInputClass}
                        placeholder="180–250 cal"
                        maxLength={60}
                      />
                    </SlideField>
                  </div>

                  {error ? (
                    <p
                      role="alert"
                      className="mt-4 rounded-xl border border-dashed border-[#d9b57a] bg-[#fdf3e3] px-3 py-2.5 text-xs leading-5 text-(--accent-strong)"
                    >
                      {error}
                    </p>
                  ) : null}
                </>
              )}
            </div>

            <footer className="flex gap-2.5 border-t border-(--line) px-6 py-3.5">
              <button
                type="submit"
                disabled={isSaving || categories.length === 0}
                className="h-10 flex-1 rounded-[9px] border border-(--accent) bg-(--accent) px-4 text-[12.5px] font-semibold text-white transition hover:bg-(--accent-strong) disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : editingItemId ? "Save Changes" : "Create item"}
              </button>
              <button
                type="button"
                onClick={clearFormFields}
                className="h-10 rounded-[9px] border border-(--line) bg-white px-4 text-[12.5px] font-semibold text-foreground transition hover:border-(--accent)"
              >
                Clear
              </button>
            </footer>
          </form>
        </>
      ) : null}
    </div>
  );
}

function SlideField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <span className="mb-[7px] block text-[12.5px] font-semibold text-foreground">{label}</span>
      {children}
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-[21px] w-9 shrink-0 rounded-full transition ${checked ? "bg-(--accent)" : "bg-(--line)"}`}
    >
      <span
        className={`absolute top-[3px] size-[15px] rounded-full bg-white transition ${checked ? "left-[18px]" : "left-[3px]"}`}
      />
    </button>
  );
}

function OptionCard({
  title,
  enabled = true,
  onToggle,
  compulsory = false,
  children,
}: {
  title: string;
  enabled?: boolean;
  onToggle?: (enabled: boolean) => void;
  compulsory?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[10px] border border-(--line) bg-[#fcfaf6] p-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="text-[12.5px] font-semibold text-foreground">{title}</span>
        {compulsory ? (
          <span className="rounded-full border border-(--line) bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-(--muted)">
            Compulsory
          </span>
        ) : (
          <Switch checked={Boolean(enabled)} onChange={(value) => onToggle?.(value)} />
        )}
      </div>
      <div className={compulsory || enabled ? "" : "pointer-events-none opacity-35"}>{children}</div>
    </div>
  );
}
