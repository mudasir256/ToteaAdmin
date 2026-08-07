"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  IconAlertTriangle,
  IconArchive,
  IconArchiveOff,
  IconArrowsExchange,
  IconBan,
  IconCheck,
  IconChevronDown,
  IconCurrencyDollar,
  IconPackage,
  IconPackages,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
  IconX,
} from "@tabler/icons-react";

import { createClient } from "@/lib/supabase/client";
import styles from "./inventory-manager.module.css";

export type InventoryCategory = {
  id: string;
  name: string;
  sort_order: number;
};

type CategoryRelation = { name: string } | { name: string }[] | null;

export type InventoryItem = {
  id: string;
  category_id: string;
  name: string;
  current_quantity: number;
  unit: string;
  minimum_quantity: number;
  cost_per_unit: number;
  supplier: string | null;
  expiration_date: string | null;
  notes: string | null;
  is_active: boolean;
  inventory_categories: CategoryRelation;
};

type StockAction = "stock_in" | "stock_out" | "adjustment";
type StatusFilter = "all" | "available" | "low" | "out" | "archived";

type InventoryManagerProps = {
  initialCategories: InventoryCategory[];
  initialItems: InventoryItem[];
  initialError?: string;
};

const emptyItemForm = {
  categoryId: "",
  name: "",
  openingQuantity: "0",
  unit: "piece",
  minimumQuantity: "0",
  costPerUnit: "0",
  supplier: "",
  expirationDate: "",
  notes: "",
};

const inventoryUnitGroups: Array<{
  label: string;
  options: Array<{ value: string; label: string }>;
}> = [
  {
    label: "Weight",
    options: [
      { value: "g", label: "gram (g)" },
      { value: "kg", label: "kilogram (kg)" },
      { value: "oz", label: "ounce (oz)" },
      { value: "lb", label: "pound (lb)" },
    ],
  },
  {
    label: "Volume",
    options: [
      { value: "ml", label: "milliliter (ml)" },
      { value: "L", label: "liter (L)" },
      { value: "fl oz", label: "fluid ounce (fl oz)" },
      { value: "quart", label: "quart" },
      { value: "gallon", label: "gallon" },
    ],
  },
  {
    label: "Count / containers",
    options: [
      { value: "piece", label: "piece" },
      { value: "each", label: "each" },
      { value: "bag", label: "bag" },
      { value: "bottle", label: "bottle" },
      { value: "can", label: "can" },
      { value: "box", label: "box" },
      { value: "case", label: "case" },
      { value: "pack", label: "pack" },
      { value: "tub", label: "tub" },
      { value: "carton", label: "carton (milk)" },
      { value: "jug", label: "jug (syrup)" },
      { value: "keg", label: "keg" },
      { value: "sleeve", label: "sleeve (cups/lids)" },
      { value: "roll", label: "roll (receipt paper, towels)" },
    ],
  },
];

const inventoryUnitOptions = inventoryUnitGroups.flatMap((group) => group.options);

const stockActionCopy: Record<StockAction, { label: string; helper: string; button: string }> = {
  stock_in: {
    label: "Quantity received",
    helper: "Adds this amount to the available stock.",
    button: "Receive stock",
  },
  stock_out: {
    label: "Quantity used",
    helper: "Removes this amount without allowing negative stock.",
    button: "Record stock out",
  },
  adjustment: {
    label: "Correct quantity",
    helper: "Sets the exact quantity currently counted on the shelf.",
    button: "Save adjustment",
  },
};

function relationValue<T>(relation: T | T[] | null): T | null {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function numberValue(value: number | string) {
  return Number(value) || 0;
}

function formatQuantity(value: number | string) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(numberValue(value));
}

function formatMoney(value: number | string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numberValue(value));
}

function itemStatus(item: InventoryItem): Exclude<StatusFilter, "all"> {
  if (!item.is_active) return "archived";
  if (numberValue(item.current_quantity) === 0) return "out";
  if (
    numberValue(item.minimum_quantity) > 0 &&
    numberValue(item.current_quantity) <= numberValue(item.minimum_quantity)
  ) {
    return "low";
  }
  return "available";
}

const statusStyles = {
  available: "bg-[#e8f5ef] text-[#247158]",
  low: "bg-(--accent-soft) text-(--accent-strong)",
  out: "bg-[#fff0ed] text-[#a33b2e]",
  archived: "bg-(--surface-tint) text-(--muted)",
};

const statusLabels = {
  available: "Available",
  low: "Low stock",
  out: "Out of stock",
  archived: "Archived",
};

function stockRailWidth(item: InventoryItem) {
  const current = numberValue(item.current_quantity);
  const minimum = numberValue(item.minimum_quantity);
  if (current === 0) return "0%";
  if (minimum === 0) return "100%";
  return `${Math.min(100, Math.max(8, (current / (minimum * 2)) * 100))}%`;
}

function SelectMenu({
  label,
  value,
  options,
  groups,
  onChange,
  ariaLabel,
}: {
  label: string;
  value: string;
  options?: { value: string; label: string }[];
  groups?: Array<{ label: string; options: Array<{ value: string; label: string }> }>;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const flatOptions = groups?.flatMap((group) => group.options) ?? options ?? [];

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const selectedLabel =
    flatOptions.find((option) => option.value === value)?.label ??
    (value ? value : label);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`flex h-10 w-full items-center justify-between gap-3 rounded-xl border bg-white px-3.5 text-left text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-(--accent) ${
          isOpen ? "border-(--accent) shadow-[0_0_0_3px_rgba(168,97,0,0.12)]" : "border-(--line)"
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
      >
        <span className={`truncate ${value ? "text-foreground" : "text-(--muted)"}`}>
          {selectedLabel}
        </span>
        <IconChevronDown
          size={17}
          stroke={1.9}
          className={`shrink-0 text-(--accent) transition ${isOpen ? "rotate-180" : ""}`}
          aria-hidden={true}
        />
      </button>
      {isOpen ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-(--line) bg-white p-1.5 shadow-[0_18px_50px_rgba(25,57,67,0.16)]"
        >
          {groups
            ? groups.map((group) => (
                <div key={group.label} className="pb-1.5">
                  <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-(--muted)">
                    {group.label}
                  </p>
                  {group.options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={value === option.value}
                      onClick={() => {
                        onChange(option.value);
                        setIsOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-(--accent) ${
                        value === option.value
                          ? "bg-(--surface-tint) font-semibold text-foreground"
                          : "text-(--muted) hover:bg-(--surface-tint) hover:text-foreground"
                      }`}
                    >
                      <span>{option.label}</span>
                      {value === option.value ? (
                        <IconCheck size={16} stroke={2} aria-hidden={true} />
                      ) : null}
                    </button>
                  ))}
                </div>
              ))
            : flatOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={value === option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-(--accent) ${
                    value === option.value
                      ? "bg-(--surface-tint) font-semibold text-foreground"
                      : "text-(--muted) hover:bg-(--surface-tint) hover:text-foreground"
                  }`}
                >
                  <span>{option.label}</span>
                  {value === option.value ? <IconCheck size={16} stroke={2} aria-hidden={true} /> : null}
                </button>
              ))}
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "warning" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "bg-[#fff6f3] text-[#a33b2e]"
      : tone === "warning"
        ? "bg-(--accent-soft) text-(--accent-strong)"
        : "bg-(--surface-tint) text-foreground";

  return (
    <article className="flex min-h-[106px] min-w-0 items-center gap-4 rounded-2xl border border-(--line) bg-(--surface-raised) px-4 py-4">
      <div className={`grid size-11 shrink-0 place-items-center rounded-xl ${toneClass}`}>{icon}</div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <p className="font-mono text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="truncate text-base font-semibold text-foreground">{label}</p>
        </div>
        <p className="mt-1 truncate text-sm text-(--muted)">{detail}</p>
      </div>
    </article>
  );
}

function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#193943]/25 px-4 py-6 backdrop-blur-[2px]">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-dialog-title"
        className="my-auto w-full max-w-2xl overflow-hidden rounded-[22px] border border-(--line) bg-(--surface-raised) shadow-[0_28px_80px_rgba(25,57,67,0.22)]"
      >
        <header className="flex items-start justify-between gap-5 border-b border-(--line) px-5 py-5 sm:px-6">
          <div>
            <h2 id="inventory-dialog-title" className="text-xl font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-(--muted)">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-xl text-(--muted) outline-none transition hover:bg-(--surface-tint) hover:text-foreground focus-visible:ring-2 focus-visible:ring-(--accent)"
            aria-label="Close dialog"
          >
            <IconX size={18} stroke={1.9} aria-hidden={true} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

const inputClass =
  `${styles.field} h-11 w-full rounded-xl border bg-white px-3.5 text-sm outline-none transition`;

export function InventoryManager({
  initialCategories,
  initialItems,
  initialError,
}: InventoryManagerProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<InventoryCategory | null>(null);
  const [stockItem, setStockItem] = useState<InventoryItem | null>(null);
  const [stockAction, setStockAction] = useState<StockAction>("stock_in");
  const [stockQuantity, setStockQuantity] = useState("");
  const [stockReason, setStockReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeItems = useMemo(() => items.filter((item) => item.is_active), [items]);
  const lowCount = activeItems.filter((item) => itemStatus(item) === "low").length;
  const outCount = activeItems.filter((item) => itemStatus(item) === "out").length;
  const inventoryValue = activeItems.reduce(
    (total, item) => total + numberValue(item.current_quantity) * numberValue(item.cost_per_unit),
    0,
  );

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return items.filter((item) => {
      const category = relationValue(item.inventory_categories)?.name ?? "Uncategorized";
      const matchesSearch =
        !normalizedSearch ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        category.toLowerCase().includes(normalizedSearch) ||
        item.supplier?.toLowerCase().includes(normalizedSearch);
      const matchesCategory = categoryFilter === "all" || item.category_id === categoryFilter;
      const matchesStatus = statusFilter === "all" || itemStatus(item) === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, items, search, statusFilter]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function loadInventory() {
    setIsRefreshing(true);
    const supabase = createClient();
    const [categoriesResult, itemsResult] = await Promise.all([
      supabase
        .from("inventory_categories")
        .select("id, name, sort_order")
        .order("sort_order", { ascending: true }),
      supabase
        .from("inventory_items")
        .select(
          "id, category_id, name, current_quantity, unit, minimum_quantity, cost_per_unit, supplier, expiration_date, notes, is_active, inventory_categories(name)",
        )
        .order("name", { ascending: true }),
    ]);

    if (categoriesResult.error || itemsResult.error) {
      setError(
        categoriesResult.error?.message ??
          itemsResult.error?.message ??
          "Inventory could not refresh.",
      );
    } else {
      setCategories((categoriesResult.data ?? []) as InventoryCategory[]);
      setItems((itemsResult.data ?? []) as InventoryItem[]);
    }
    setIsRefreshing(false);
  }

  function openCreateItem() {
    if (categories.length === 0) {
      setCategoryName("");
      setEditingCategory(null);
      setError(null);
      setCategoryDialogOpen(true);
      return;
    }
    setEditingItem(null);
    setItemForm({ ...emptyItemForm, categoryId: categories[0]?.id ?? "" });
    setError(null);
    setItemDialogOpen(true);
  }

  function openCategoryDialog() {
    setCategoryName("");
    setEditingCategory(null);
    setError(null);
    setCategoryDialogOpen(true);
  }

  function editCategory(category: InventoryCategory) {
    setEditingCategory(category);
    setCategoryName(category.name);
    setError(null);
  }

  function resetCategoryForm() {
    setEditingCategory(null);
    setCategoryName("");
    setError(null);
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    const supabase = createClient();
    const trimmedName = categoryName.trim();
    if (editingCategory) {
      const { error: updateError } = await supabase
        .from("inventory_categories")
        .update({ name: trimmedName })
        .eq("id", editingCategory.id);

      if (updateError) {
        setError(updateError.message);
        setIsSaving(false);
        return;
      }

      setCategories((current) =>
        current.map((category) =>
          category.id === editingCategory.id ? { ...category, name: trimmedName } : category,
        ),
      );
      setItems((current) =>
        current.map((item) =>
          item.category_id === editingCategory.id
            ? {
                ...item,
                inventory_categories: { name: trimmedName },
              }
            : item,
        ),
      );
      setNotice("Category renamed.");
    } else {
      const sortOrder = (categories.at(-1)?.sort_order ?? 0) + 10;
      const { data, error: insertError } = await supabase
        .from("inventory_categories")
        .insert({ name: trimmedName, sort_order: sortOrder })
        .select("id, name, sort_order")
        .single();

      if (insertError || !data) {
        setError(insertError?.message ?? "Could not create category.");
        setIsSaving(false);
        return;
      }

      setCategories((current) => [...current, data as InventoryCategory]);
      setNotice("Category created.");
    }

    resetCategoryForm();
    setIsSaving(false);
  }

  async function deleteCategory(category: InventoryCategory) {
    const itemCount = items.filter((item) => item.category_id === category.id).length;
    if (itemCount > 0) {
      setError(`Move the ${itemCount} item${itemCount === 1 ? "" : "s"} in ${category.name} to another category before deleting it.`);
      return;
    }

    if (!window.confirm(`Delete the ${category.name} category?`)) return;

    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("inventory_categories")
      .delete()
      .eq("id", category.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (editingCategory?.id === category.id) resetCategoryForm();
    setCategories((current) => current.filter((entry) => entry.id !== category.id));
    setNotice("Category deleted.");
  }

  function openEditItem(item: InventoryItem) {
    setEditingItem(item);
    setItemForm({
      categoryId: item.category_id,
      name: item.name,
      openingQuantity: String(item.current_quantity),
      unit: item.unit,
      minimumQuantity: String(item.minimum_quantity),
      costPerUnit: String(item.cost_per_unit),
      supplier: item.supplier ?? "",
      expirationDate: item.expiration_date ?? "",
      notes: item.notes ?? "",
    });
    setError(null);
    setItemDialogOpen(true);
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    const sharedPayload = {
      category_id: itemForm.categoryId,
      name: itemForm.name.trim(),
      unit: itemForm.unit.trim(),
      minimum_quantity: numberValue(itemForm.minimumQuantity),
      cost_per_unit: numberValue(itemForm.costPerUnit),
      supplier: itemForm.supplier.trim() || null,
      expiration_date: itemForm.expirationDate || null,
      notes: itemForm.notes.trim() || null,
    };
    const categoryName =
      categories.find((category) => category.id === itemForm.categoryId)?.name ?? "Uncategorized";
    const supabase = createClient();

    if (editingItem) {
      const { error: updateError } = await supabase
        .from("inventory_items")
        .update(sharedPayload)
        .eq("id", editingItem.id);

      if (updateError) {
        setError(updateError.message);
        setIsSaving(false);
        return;
      }

      setItems((current) =>
        current.map((item) =>
          item.id === editingItem.id
            ? {
                ...item,
                ...sharedPayload,
                inventory_categories: { name: categoryName },
              }
            : item,
        ),
      );
      setNotice("Item details updated.");
    } else {
      const openingQuantity = numberValue(itemForm.openingQuantity);
      const { data, error: insertError } = await supabase
        .from("inventory_items")
        .insert({
          ...sharedPayload,
          current_quantity: openingQuantity,
        })
        .select(
          "id, category_id, name, current_quantity, unit, minimum_quantity, cost_per_unit, supplier, expiration_date, notes, is_active, inventory_categories(name)",
        )
        .single();

      if (insertError || !data) {
        setError(insertError?.message ?? "Could not add inventory item.");
        setIsSaving(false);
        return;
      }

      setItems((current) => [...current, data as InventoryItem]);
      setNotice("Inventory item added.");
    }

    setItemDialogOpen(false);
    setIsSaving(false);
  }

  function openStockDialog(item: InventoryItem, action: StockAction = "stock_in") {
    setStockItem(item);
    setStockAction(action);
    setStockQuantity(action === "adjustment" ? String(item.current_quantity) : "");
    setStockReason("");
    setError(null);
  }

  async function saveStockMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stockItem) return;

    setIsSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: movementError } = await supabase.rpc("adjust_inventory_stock", {
      p_item_id: stockItem.id,
      p_movement_type: stockAction,
      p_quantity: numberValue(stockQuantity),
      p_reason: stockReason.trim(),
    });

    if (movementError) {
      setError(movementError.message);
      setIsSaving(false);
      return;
    }

    const quantity = numberValue(stockQuantity);
    const nextQuantity =
      stockAction === "adjustment"
        ? quantity
        : stockAction === "stock_in"
          ? Number(stockItem.current_quantity) + quantity
          : Math.max(0, Number(stockItem.current_quantity) - quantity);

    setItems((current) =>
      current.map((item) =>
        item.id === stockItem.id ? { ...item, current_quantity: nextQuantity } : item,
      ),
    );
    setStockItem(null);
    setNotice(`${stockItem.name} stock updated.`);
    setIsSaving(false);
  }

  async function toggleArchive(item: InventoryItem) {
    if (item.is_active && !window.confirm(`Archive ${item.name}? Its history will remain available.`)) return;

    setError(null);
    const supabase = createClient();
    const nextActive = !item.is_active;
    const { error: archiveError } = await supabase
      .from("inventory_items")
      .update({ is_active: nextActive })
      .eq("id", item.id);

    if (archiveError) {
      setError(archiveError.message);
      return;
    }

    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, is_active: nextActive } : entry,
      ),
    );
    setNotice(item.is_active ? "Item archived." : "Item restored.");
  }

  async function deleteItem(item: InventoryItem) {
    const confirmed = window.confirm(
      `Permanently delete ${item.name}? This also removes its complete stock history and cannot be undone.`,
    );
    if (!confirmed) return;

    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", item.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (editingItem?.id === item.id) {
      setItemDialogOpen(false);
      setEditingItem(null);
    }
    if (stockItem?.id === item.id) setStockItem(null);

    setItems((current) => current.filter((entry) => entry.id !== item.id));
    setNotice("Inventory item deleted.");
  }

  const categoryOptions = [
    { value: "all", label: "All categories" },
    ...categories.map((category) => ({ value: category.id, label: category.name })),
  ];
  const itemCategoryOptions = categories.map((category) => ({ value: category.id, label: category.name }));
  const statusOptions = [
    { value: "all", label: "All stock states" },
    { value: "available", label: "Available" },
    { value: "low", label: "Low stock" },
    { value: "out", label: "Out of stock" },
    { value: "archived", label: "Archived" },
  ];

  return (
    <div className="mt-3 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
      <section className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Inventory summary">
        <MetricCard
          icon={<IconPackages size={20} stroke={1.8} aria-hidden={true} />}
          label="Active items"
          value={String(activeItems.length)}
          detail={`${categories.length} stockroom categories`}
        />
        <MetricCard
          icon={<IconAlertTriangle size={20} stroke={1.8} aria-hidden={true} />}
          label="Low stock"
          value={String(lowCount)}
          detail="At or below the minimum"
          tone="warning"
        />
        <MetricCard
          icon={<IconBan size={20} stroke={1.8} aria-hidden={true} />}
          label="Out of stock"
          value={String(outCount)}
          detail="No quantity available"
          tone="danger"
        />
        <MetricCard
          icon={<IconCurrencyDollar size={20} stroke={1.8} aria-hidden={true} />}
          label="Stock value"
          value={formatMoney(inventoryValue)}
          detail="Quantity × cost per unit"
        />
      </section>

      {notice ? (
        <div role="status" className="mt-3 flex items-center gap-2 rounded-xl border border-[#87c7b0] bg-[#eef9f4] px-3.5 py-3 text-sm font-medium text-[#24664f]">
          <IconCheck size={17} stroke={2} aria-hidden={true} />
          {notice}
        </div>
      ) : null}
      {error && !itemDialogOpen && !categoryDialogOpen && !stockItem ? (
        <div role="alert" className="mt-3 rounded-xl border border-[#c98b26]/35 bg-(--accent-soft) px-3.5 py-3 text-sm leading-6 text-[#7a4d00]">
          {error}
        </div>
      ) : null}

      <div className="mt-3 xl:min-h-0 xl:flex-1">
        <section className="overflow-visible rounded-2xl border border-(--line) bg-(--surface-raised) xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-(--line) p-3">
            <label className="relative min-w-[220px] flex-1">
              <span className="sr-only">Search inventory</span>
              <IconSearch size={18} stroke={1.8} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-(--muted)" aria-hidden={true} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={`${styles.field} h-10 w-full rounded-xl border bg-(--surface) pl-10 pr-3.5 text-sm outline-none transition`}
                placeholder="Search items, categories, suppliers"
              />
            </label>
            <div className="w-full sm:w-[190px]">
              <SelectMenu
                label="All categories"
                value={categoryFilter}
                options={categoryOptions}
                onChange={setCategoryFilter}
                ariaLabel="Filter by category"
              />
            </div>
            <div className="w-full sm:w-[175px]">
              <SelectMenu
                label="All stock states"
                value={statusFilter}
                options={statusOptions}
                onChange={(value) => setStatusFilter(value as StatusFilter)}
                ariaLabel="Filter by stock state"
              />
            </div>
            <button
              type="button"
              onClick={openCategoryDialog}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-(--line) bg-white px-3.5 text-sm font-semibold text-foreground outline-none transition hover:border-(--accent) hover:text-(--accent-strong) focus-visible:ring-2 focus-visible:ring-(--accent)"
            >
              <IconPackages size={17} stroke={1.9} aria-hidden={true} />
              Categories
            </button>
            <button
              type="button"
              onClick={openCreateItem}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-(--accent) px-3.5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(168,97,0,0.14)] transition hover:bg-(--accent-strong) active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2"
            >
              <IconPlus size={17} stroke={2} aria-hidden={true} />
              Add item
            </button>
          </div>

          <div className="border-b border-(--line) px-3.5 py-2 text-xs text-(--muted)">
            <span>{filteredItems.length} of {items.length} items</span>
            {isRefreshing ? <span className="ml-2">· Refreshing…</span> : null}
          </div>

          <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-auto">
            {items.length === 0 && categories.length === 0 ? (
              <div className="grid min-h-64 place-items-center px-5 py-7 text-center">
                <div className="max-w-xl">
                  <span className="mx-auto grid size-10 place-items-center rounded-xl bg-(--accent-soft) text-(--accent-strong)">
                    <IconPackages size={19} stroke={1.8} aria-hidden={true} />
                  </span>
                  <p className="mt-3 text-base font-semibold tracking-tight text-foreground">Build your stockroom</p>
                  <p className="mx-auto mt-1 max-w-md text-sm leading-5 text-(--muted)">
                    Start with a category your team recognizes, then add the ingredients and supplies stored inside it.
                  </p>
                  <div className="mx-auto mt-3 grid max-w-lg gap-2 text-left sm:grid-cols-2">
                    <div className="rounded-xl border border-(--line) bg-(--surface-tint) px-3 py-2.5">
                      <p className="text-xs font-semibold text-(--accent-strong)">1 · Create category</p>
                      <p className="mt-1 text-xs leading-5 text-(--muted)">Tea, packaging, toppings, or your own name.</p>
                    </div>
                    <div className="rounded-xl border border-(--line) px-3 py-2.5">
                      <p className="text-xs font-semibold text-foreground">2 · Add items</p>
                      <p className="mt-1 text-xs leading-5 text-(--muted)">Set the unit, minimum, cost, and opening stock.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={openCategoryDialog}
                    className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-(--accent) px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(168,97,0,0.14)] transition hover:bg-(--accent-strong) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2"
                  >
                    <IconPlus size={17} stroke={2} aria-hidden={true} />
                    Create first category
                  </button>
                </div>
              </div>
            ) : items.length === 0 ? (
              <div className="grid min-h-56 place-items-center px-5 py-8 text-center">
                <div>
                  <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-(--surface-tint) text-(--muted)">
                    <IconPackage size={20} stroke={1.8} aria-hidden={true} />
                  </span>
                  <p className="mt-4 font-semibold text-foreground">Your categories are ready.</p>
                  <p className="mt-1 text-sm text-(--muted)">Add the first inventory item to begin tracking stock.</p>
                  <button
                    type="button"
                    onClick={openCreateItem}
                    className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-(--accent) px-4 text-sm font-semibold text-white transition hover:bg-(--accent-strong)"
                  >
                    <IconPlus size={16} stroke={2} aria-hidden={true} />
                    Add first item
                  </button>
                </div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="grid min-h-52 place-items-center px-5 py-8 text-center">
                <div>
                  <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-(--surface-tint) text-(--muted)">
                    <IconSearch size={20} stroke={1.8} aria-hidden={true} />
                  </span>
                  <p className="mt-4 font-semibold text-foreground">No inventory items match.</p>
                  <p className="mt-1 text-sm text-(--muted)">Clear a filter or search for another item.</p>
                </div>
              </div>
            ) : (
              <table className="w-full min-w-[800px] table-fixed text-left">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[26%]" />
                  <col className="w-[12%]" />
                  <col className="w-[16%]" />
                  <col className="w-[18%]" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-(--surface-raised) text-xs font-medium text-(--muted)">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Item</th>
                    <th className="px-3 py-2.5 font-medium">Stock / minimum</th>
                    <th className="px-3 py-2.5 font-medium">Value</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {filteredItems.map((item) => {
                    const status = itemStatus(item);
                    const categoryName = relationValue(item.inventory_categories)?.name ?? "Uncategorized";
                    return (
                      <tr key={item.id} className="border-t border-(--line) text-foreground transition hover:bg-[#f9fcfb]">
                        <td className="px-4 py-3">
                          <p className="max-w-[260px] truncate font-semibold">{item.name}</p>
                          <p className="mt-1 text-xs text-(--muted)">{categoryName}</p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-mono text-base font-semibold">{formatQuantity(item.current_quantity)}</span>
                            <span className="text-xs text-[#829399]">/ {formatQuantity(item.minimum_quantity)}</span>
                            <span className="text-xs text-(--muted)">{item.unit}</span>
                          </div>
                          <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-(--surface-tint)">
                            <div
                              className={`h-full rounded-full ${
                                status === "out" ? "bg-[#c95b4b]" : status === "low" ? "bg-(--accent)" : "bg-[#4a9b7c]"
                              }`}
                              style={{ width: stockRailWidth(item) }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs font-semibold">
                          {formatMoney(numberValue(item.current_quantity) * numberValue(item.cost_per_unit))}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}>
                            {statusLabels[status]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openStockDialog(item)}
                              disabled={!item.is_active}
                              className="grid size-9 place-items-center rounded-xl text-(--accent) outline-none transition hover:bg-(--accent-soft) focus-visible:ring-2 focus-visible:ring-(--accent) disabled:cursor-not-allowed disabled:opacity-35"
                              aria-label={`Update stock for ${item.name}`}
                              title="Update stock"
                            >
                              <IconArrowsExchange size={17} stroke={1.9} aria-hidden={true} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditItem(item)}
                              className="grid size-9 place-items-center rounded-xl text-(--muted) outline-none transition hover:bg-(--surface-tint) hover:text-foreground focus-visible:ring-2 focus-visible:ring-(--accent)"
                              aria-label={`Edit ${item.name}`}
                              title="Edit item"
                            >
                              <IconPencil size={17} stroke={1.8} aria-hidden={true} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void toggleArchive(item)}
                              className="grid size-9 place-items-center rounded-xl text-(--muted) outline-none transition hover:bg-(--surface-tint) hover:text-foreground focus-visible:ring-2 focus-visible:ring-(--accent)"
                              aria-label={`${item.is_active ? "Archive" : "Restore"} ${item.name}`}
                              title={item.is_active ? "Archive item" : "Restore item"}
                            >
                              {item.is_active ? <IconArchive size={17} stroke={1.8} aria-hidden={true} /> : <IconArchiveOff size={17} stroke={1.8} aria-hidden={true} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteItem(item)}
                              className="grid size-9 place-items-center rounded-xl text-(--muted) outline-none transition hover:bg-[#fff0ed] hover:text-[#a33b2e] focus-visible:ring-2 focus-visible:ring-(--accent)"
                              aria-label={`Permanently delete ${item.name}`}
                              title="Delete item"
                            >
                              <IconTrash size={17} stroke={1.8} aria-hidden={true} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

      </div>

      {categoryDialogOpen ? (
        <Modal
          title="Inventory categories"
          description="Use the same category names your team uses in the stockroom."
          onClose={() => setCategoryDialogOpen(false)}
        >
          <div className="px-5 py-5 sm:px-6">
            <form onSubmit={saveCategory} className="rounded-2xl border border-(--line) bg-(--surface-tint) p-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">
                  {editingCategory ? "Rename category" : "New category"}
                </span>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={categoryName}
                    onChange={(event) => setCategoryName(event.target.value)}
                    className={`${inputClass} flex-1`}
                    placeholder="Example: Tea, packaging, toppings"
                    maxLength={80}
                    required
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={isSaving || !categoryName.trim()}
                    className="h-11 shrink-0 rounded-xl bg-(--accent) px-4 text-sm font-semibold text-white transition hover:bg-(--accent-strong) disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? "Saving…" : editingCategory ? "Save name" : "Add category"}
                  </button>
                  {editingCategory ? (
                    <button
                      type="button"
                      onClick={resetCategoryForm}
                      className="h-11 shrink-0 rounded-xl border border-(--line) bg-white px-4 text-sm font-semibold text-(--muted) transition hover:border-(--accent) hover:text-(--accent-strong)"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </label>
            </form>

            {error ? (
              <p role="alert" className="mt-4 rounded-xl border border-[#c98b26]/35 bg-(--accent-soft) px-3.5 py-3 text-sm leading-6 text-[#7a4d00]">
                {error}
              </p>
            ) : null}

            <div className="mt-5 overflow-hidden rounded-2xl border border-(--line)">
              <div className="flex items-center justify-between gap-4 border-b border-(--line) bg-(--surface-raised) px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Your categories</p>
                <span className="font-mono text-xs text-(--muted)">{categories.length}</span>
              </div>
              {categories.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm font-semibold text-foreground">No categories yet.</p>
                  <p className="mt-1 text-xs leading-5 text-(--muted)">Create the first category above.</p>
                </div>
              ) : (
                <div className="max-h-72 divide-y divide-(--line) overflow-y-auto">
                  {categories.map((category) => {
                    const categoryItemCount = items.filter((item) => item.category_id === category.id).length;
                    return (
                      <div key={category.id} className="flex items-center gap-3 px-4 py-3.5">
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-(--surface-tint) text-(--accent-strong)">
                          <IconPackages size={17} stroke={1.8} aria-hidden={true} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{category.name}</p>
                          <p className="mt-0.5 text-xs text-(--muted)">
                            {categoryItemCount} item{categoryItemCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => editCategory(category)}
                          className="grid size-9 place-items-center rounded-xl text-(--muted) outline-none transition hover:bg-(--surface-tint) hover:text-foreground focus-visible:ring-2 focus-visible:ring-(--accent)"
                          aria-label={`Rename ${category.name}`}
                          title="Rename category"
                        >
                          <IconPencil size={16} stroke={1.8} aria-hidden={true} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteCategory(category)}
                          className="grid size-9 place-items-center rounded-xl text-(--muted) outline-none transition hover:bg-[#fff0ed] hover:text-[#a33b2e] focus-visible:ring-2 focus-visible:ring-(--accent)"
                          aria-label={`Delete ${category.name}`}
                          title="Delete category"
                        >
                          <IconTrash size={16} stroke={1.8} aria-hidden={true} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end border-t border-(--line) pt-5">
              <button
                type="button"
                onClick={() => setCategoryDialogOpen(false)}
                className="h-11 rounded-xl border border-(--line) px-4 text-sm font-semibold text-(--muted) transition hover:border-(--accent) hover:text-(--accent-strong)"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {itemDialogOpen ? (
        <Modal
          title={editingItem ? "Edit inventory item" : "Add inventory item"}
          description={editingItem ? "Update the item details. Use stock activity to change its quantity." : "Create an item and optionally record its opening quantity."}
          onClose={() => setItemDialogOpen(false)}
        >
          <form onSubmit={saveItem} className="max-h-[calc(100dvh-10rem)] overflow-y-auto px-5 py-5 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Item name</span>
                <input
                  value={itemForm.name}
                  onChange={(event) => setItemForm((current) => ({ ...current, name: event.target.value }))}
                  className={inputClass}
                  placeholder="Matcha powder"
                  maxLength={140}
                  required
                  autoFocus
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Category</span>
                <SelectMenu
                  label="Choose category"
                  value={itemForm.categoryId}
                  options={itemCategoryOptions}
                  onChange={(value) => setItemForm((current) => ({ ...current, categoryId: value }))}
                  ariaLabel="Choose inventory category"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Unit</span>
                <SelectMenu
                  label="Choose unit"
                  value={itemForm.unit}
                  groups={
                    itemForm.unit &&
                    !inventoryUnitOptions.some((option) => option.value === itemForm.unit)
                      ? [
                          {
                            label: "Current",
                            options: [{ value: itemForm.unit, label: itemForm.unit }],
                          },
                          ...inventoryUnitGroups,
                        ]
                      : inventoryUnitGroups
                  }
                  onChange={(value) => setItemForm((current) => ({ ...current, unit: value }))}
                  ariaLabel="Choose inventory unit"
                />
              </label>
              {!editingItem ? (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">Opening quantity</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemForm.openingQuantity}
                    onChange={(event) => setItemForm((current) => ({ ...current, openingQuantity: event.target.value }))}
                    className={inputClass}
                    required
                  />
                </label>
              ) : (
                <div className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">Current quantity</span>
                  <div className="flex h-11 items-center rounded-xl border border-(--line) bg-(--surface-tint) px-3.5 text-sm font-semibold text-foreground">
                    {formatQuantity(editingItem.current_quantity)} {editingItem.unit}
                  </div>
                </div>
              )}
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Low-stock minimum</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemForm.minimumQuantity}
                  onChange={(event) => setItemForm((current) => ({ ...current, minimumQuantity: event.target.value }))}
                  className={inputClass}
                  required
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Cost per unit</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-(--muted)">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemForm.costPerUnit}
                    onChange={(event) => setItemForm((current) => ({ ...current, costPerUnit: event.target.value }))}
                    className={`${inputClass} pl-8`}
                    required
                  />
                </div>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Supplier <span className="font-normal text-(--muted)">(optional)</span></span>
                <input
                  value={itemForm.supplier}
                  onChange={(event) => setItemForm((current) => ({ ...current, supplier: event.target.value }))}
                  className={inputClass}
                  placeholder="Supplier name"
                  maxLength={140}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Expiration date <span className="font-normal text-(--muted)">(optional)</span></span>
                <input
                  type="date"
                  value={itemForm.expirationDate}
                  onChange={(event) => setItemForm((current) => ({ ...current, expirationDate: event.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className="grid gap-2 sm:col-span-2">
                <span className="text-sm font-medium text-foreground">Notes <span className="font-normal text-(--muted)">(optional)</span></span>
                <textarea
                  value={itemForm.notes}
                  onChange={(event) => setItemForm((current) => ({ ...current, notes: event.target.value }))}
                  className={`${styles.field} min-h-24 resize-y rounded-xl border bg-white px-3.5 py-3 text-sm leading-6 outline-none transition`}
                  placeholder="Storage location or handling note"
                  maxLength={600}
                />
              </label>
            </div>

            {error ? <p role="alert" className="mt-4 rounded-xl border border-[#c98b26]/35 bg-(--accent-soft) px-3.5 py-3 text-sm leading-6 text-[#7a4d00]">{error}</p> : null}

            <div className="mt-6 flex justify-end gap-3 border-t border-(--line) pt-5">
              <button type="button" onClick={() => setItemDialogOpen(false)} className="h-11 rounded-xl border border-(--line) px-4 text-sm font-semibold text-(--muted) transition hover:border-(--accent) hover:text-(--accent-strong)">
                Cancel
              </button>
              <button type="submit" disabled={isSaving || !itemForm.categoryId} className="h-11 rounded-xl bg-(--accent) px-5 text-sm font-semibold text-white transition hover:bg-(--accent-strong) disabled:cursor-not-allowed disabled:opacity-60">
                {isSaving ? "Saving…" : editingItem ? "Save changes" : "Add item"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {stockItem ? (
        <Modal
          title={`Update ${stockItem.name}`}
          description={`Currently ${formatQuantity(stockItem.current_quantity)} ${stockItem.unit} available.`}
          onClose={() => setStockItem(null)}
        >
          <form onSubmit={saveStockMovement} className="px-5 py-5 sm:px-6">
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-(--surface-tint) p-1.5">
              {(["stock_in", "stock_out", "adjustment"] as StockAction[]).map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => {
                    setStockAction(action);
                    setStockQuantity(action === "adjustment" ? String(stockItem.current_quantity) : "");
                    setError(null);
                  }}
                  className={`rounded-lg px-2 py-2.5 text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-(--accent) ${stockAction === action ? "bg-white text-foreground shadow-[0_4px_14px_rgba(25,57,67,0.08)]" : "text-(--muted) hover:text-foreground"}`}
                >
                  {action === "stock_in" ? "Stock in" : action === "stock_out" ? "Stock out" : "Adjust"}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">{stockActionCopy[stockAction].label}</span>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={stockQuantity}
                    onChange={(event) => setStockQuantity(event.target.value)}
                    className={`${inputClass} pr-20`}
                    placeholder="0"
                    required
                    autoFocus
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 max-w-16 -translate-y-1/2 truncate text-xs font-medium text-(--muted)">{stockItem.unit}</span>
                </div>
                <span className="text-xs leading-5 text-(--muted)">{stockActionCopy[stockAction].helper}</span>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Reason</span>
                <textarea
                  value={stockReason}
                  onChange={(event) => setStockReason(event.target.value)}
                  className={`${styles.field} min-h-[92px] resize-none rounded-xl border bg-white px-3.5 py-3 text-sm leading-6 outline-none transition`}
                  placeholder={stockAction === "stock_in" ? "Supplier delivery" : stockAction === "stock_out" ? "Used during service" : "Physical count correction"}
                  maxLength={240}
                  required
                />
              </label>
            </div>

            {error ? <p role="alert" className="mt-4 rounded-xl border border-[#c98b26]/35 bg-(--accent-soft) px-3.5 py-3 text-sm leading-6 text-[#7a4d00]">{error}</p> : null}

            <div className="mt-6 flex justify-end gap-3 border-t border-(--line) pt-5">
              <button type="button" onClick={() => setStockItem(null)} className="h-11 rounded-xl border border-(--line) px-4 text-sm font-semibold text-(--muted) transition hover:border-(--accent) hover:text-(--accent-strong)">
                Cancel
              </button>
              <button type="submit" disabled={isSaving} className="h-11 rounded-xl bg-(--accent) px-5 text-sm font-semibold text-white transition hover:bg-(--accent-strong) disabled:cursor-not-allowed disabled:opacity-60">
                {isSaving ? "Saving…" : stockActionCopy[stockAction].button}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
