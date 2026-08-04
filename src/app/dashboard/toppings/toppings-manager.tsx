"use client";

import Image from "next/image";
import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import {
  IconCheck,
  IconPencil,
  IconPhotoUp,
  IconPlus,
  IconSparkles,
  IconTrash,
} from "@tabler/icons-react";

import { createClient } from "@/lib/supabase/client";

export type MenuTopping = {
  id: string;
  name: string;
  category: "standard" | "cream";
  image_url: string;
  price: number;
  is_available: boolean;
  sort_order: number;
};

type ToppingForm = {
  name: string;
  category: "standard" | "cream";
  imageUrl: string;
  price: string;
  isAvailable: boolean;
  sortOrder: string;
};

type ToppingsManagerProps = {
  initialToppings: MenuTopping[];
  initialError?: string;
};

const emptyForm: ToppingForm = {
  name: "",
  category: "standard",
  imageUrl: "",
  price: "0",
  isAvailable: true,
  sortOrder: "0",
};

const inputClass =
  "h-10 w-full rounded-lg border border-(--line) bg-white px-3 text-[13px] text-foreground outline-none transition focus:border-(--accent) focus:ring-2 focus:ring-[#b8762f]/20";
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const maxImageSize = 5 * 1024 * 1024;

function imagePathFromPublicUrl(imageUrl: string) {
  const marker = "/storage/v1/object/public/menu-images/";
  const markerIndex = imageUrl.indexOf(marker);
  return markerIndex === -1
    ? null
    : decodeURIComponent(imageUrl.slice(markerIndex + marker.length));
}

export function ToppingsManager({ initialToppings, initialError }: ToppingsManagerProps) {
  const [toppings, setToppings] = useState(initialToppings);
  const [form, setForm] = useState<ToppingForm>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusMenu, setStatusMenu] = useState<{ toppingId: string; top: number; left: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  useEffect(() => {
    if (!statusMenu) return;
    function close() {
      setStatusMenu(null);
    }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [statusMenu]);

  async function loadToppings() {
    setIsLoading(true);
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from("menu_toppings")
      .select("id, name, category, image_url, price, is_available, sort_order")
      .order("sort_order", { ascending: true });

    if (loadError) {
      setError(loadError.message);
    } else {
      setToppings((data ?? []) as MenuTopping[]);
    }
    setIsLoading(false);
  }

  function resetForm() {
    setForm(emptyForm);
    setImageFile(null);
    setEditingId(null);
    setError(null);
  }

  function selectImage(event: ChangeEvent<HTMLInputElement>) {
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

    setImageFile(file);
    setError(null);
  }

  async function saveTopping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    if (!imageFile && !form.imageUrl) {
      setError("Choose an image before creating this topping.");
      setIsSaving(false);
      return;
    }

    const supabase = createClient();
    let uploadedImage: { path: string; publicUrl: string } | null = null;

    if (imageFile) {
      const extension = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `toppings/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("menu-images")
        .upload(path, imageFile, {
          cacheControl: "3600",
          contentType: imageFile.type,
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
      name: form.name.trim(),
      category: form.category,
      image_url: uploadedImage?.publicUrl ?? form.imageUrl,
      price: Number(form.price),
      is_available: form.isAvailable,
      sort_order: Number(form.sortOrder),
    };
    const { error: saveError } = editingId
      ? await supabase.from("menu_toppings").update(payload).eq("id", editingId)
      : await supabase.from("menu_toppings").insert(payload);

    if (saveError) {
      if (uploadedImage) {
        await supabase.storage.from("menu-images").remove([uploadedImage.path]);
      }
      setError(saveError.message);
      setIsSaving(false);
      return;
    }

    const previousImagePath = imagePathFromPublicUrl(form.imageUrl);
    if (uploadedImage && previousImagePath) {
      await supabase.storage.from("menu-images").remove([previousImagePath]);
    }

    resetForm();
    await loadToppings();
    setIsSaving(false);
  }

  function editTopping(topping: MenuTopping) {
    setEditingId(topping.id);
    setForm({
      name: topping.name,
      category: topping.category,
      imageUrl: topping.image_url,
      price: String(topping.price),
      isAvailable: topping.is_available,
      sortOrder: String(topping.sort_order),
    });
    setImageFile(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteTopping(topping: MenuTopping) {
    if (!window.confirm(`Delete ${topping.name}?`)) return;

    setError(null);
    const supabase = createClient();
    const imagePath = imagePathFromPublicUrl(topping.image_url);
    if (imagePath) {
      const { error: imageError } = await supabase.storage
        .from("menu-images")
        .remove([imagePath]);
      if (imageError) {
        setError(`Could not remove the topping image: ${imageError.message}`);
        return;
      }
    }

    const { error: deleteError } = await supabase
      .from("menu_toppings")
      .delete()
      .eq("id", topping.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (editingId === topping.id) resetForm();
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(topping.id);
      return next;
    });
    await loadToppings();
  }

  async function setAvailability(ids: string[], isAvailable: boolean) {
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("menu_toppings")
      .update({ is_available: isAvailable })
      .in("id", ids);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setToppings((current) =>
      current.map((topping) =>
        ids.includes(topping.id) ? { ...topping, is_available: isAvailable } : topping,
      ),
    );
    setSelectedIds(new Set());
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openStatusMenu(event: React.MouseEvent, toppingId: string) {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setStatusMenu({ toppingId, top: rect.bottom + 6, left: rect.left });
  }

  const standardToppings = toppings.filter((topping) => topping.category === "standard");
  const creamToppings = toppings.filter((topping) => topping.category === "cream");
  const selectedCount = selectedIds.size;

  return (
    <div>
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex gap-2">
          <GroupTab count={standardToppings.length} label="Standard" />
          <GroupTab count={creamToppings.length} label="Cream" />
        </div>
        <button
          type="button"
          onClick={() => void loadToppings()}
          disabled={isLoading}
          className="inline-flex h-10 items-center gap-1.5 rounded-[9px] border border-(--line) bg-white px-4 text-[12.5px] font-semibold text-foreground transition hover:border-(--accent) hover:text-(--accent-strong) disabled:opacity-60"
        >
          <IconSparkles size={15} stroke={1.9} aria-hidden />
          {isLoading ? "Refreshing..." : "Refresh toppings"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mb-3.5 rounded-xl border border-dashed border-[#d9b57a] bg-[#fdf3e3] px-3 py-2.5 text-xs leading-5 text-(--accent-strong)">
          {error}
        </p>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_1.35fr]">
        <form onSubmit={saveTopping} className="rounded-[14px] border border-(--line) bg-white p-6">
          <p className="text-[15px] font-bold text-foreground">
            {editingId ? "Edit topping" : "Add a topping"}
          </p>
          <p className="mb-4 mt-1 text-[11.5px] text-(--muted)">
            Toppings saved here appear on the public menu and every item referencing this group.
          </p>

          <Field label="Topping name">
            <input
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className={inputClass}
              placeholder="e.g. Crystal Boba"
              maxLength={80}
            />
          </Field>

          <Field label="Topping group">
            <div className="flex overflow-hidden rounded-[10px] border border-(--line)">
              {[
                { value: "standard" as const, label: "Standard" },
                { value: "cream" as const, label: "Cream upsell" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, category: option.value }))}
                  className={`flex-1 px-2 py-3 text-center text-[13.5px] font-bold transition ${
                    form.category === option.value
                      ? "bg-(--green-soft) text-foreground"
                      : "text-(--muted) hover:bg-(--surface)"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Price">
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                className={inputClass}
                placeholder="0.00"
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
                placeholder="0"
              />
            </Field>
          </div>

          <Field label="Topping image">
            <label className="flex cursor-pointer items-center gap-3 rounded-[10px] border-[1.5px] border-dashed border-(--line) bg-[#fafcf9] p-3 transition hover:border-(--accent)">
              <IconPhotoUp size={19} stroke={1.7} className="shrink-0 text-(--accent)" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                {imageFile
                  ? imageFile.name
                  : form.imageUrl
                    ? "Current image saved — choose a new file to replace it"
                    : "Choose a topping image"}
                <span className="block text-[10px] font-normal text-(--muted)">
                  JPG, PNG, WebP, or AVIF · max 5 MB
                </span>
              </span>
              <span className="shrink-0 text-[11.5px] font-bold text-(--accent-strong)">Browse</span>
              <input
                required={!editingId && !form.imageUrl}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={selectImage}
                className="sr-only"
              />
            </label>
          </Field>

          <Field label="Availability">
            <div className="flex overflow-hidden rounded-[10px] border border-(--line)">
              {[
                { value: true, label: "✓ Available", activeClass: "bg-(--green-soft) text-(--green)" },
                { value: false, label: "Hidden", activeClass: "bg-(--surface-tint) text-foreground" },
              ].map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, isAvailable: option.value }))}
                  className={`flex-1 px-2 py-[11px] text-center text-[12.5px] font-bold transition ${
                    form.isAvailable === option.value ? option.activeClass : "text-(--muted) hover:bg-(--surface)"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Field>

          <div className="flex gap-2.5">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[9px] border border-(--accent) bg-(--accent) px-4 text-[12.5px] font-semibold text-white transition hover:bg-(--accent-strong) disabled:cursor-not-allowed disabled:opacity-60"
            >
              <IconPlus size={15} stroke={2.2} aria-hidden />
              {isSaving ? "Saving..." : editingId ? "Save topping" : "Create topping"}
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

        <section className="overflow-hidden rounded-[14px] border border-(--line) bg-white pb-2">
          <div className="flex items-start justify-between gap-4 px-[22px] pt-5">
            <div>
              <p className="text-base font-bold text-foreground">Topping bar</p>
              <p className="mt-0.5 text-[11.5px] text-(--muted)">
                Image, price, order, and visibility stay synchronized with the website.
              </p>
            </div>
            <span className="whitespace-nowrap rounded-[14px] border border-(--line) bg-(--surface) px-3 py-[5px] text-[11.5px] font-bold text-foreground">
              {toppings.length} total
            </span>
          </div>

          {selectedCount > 0 ? (
            <div className="mx-[22px] mt-3.5 flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-[#3f2f22] px-[18px] py-3 text-white">
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

          {toppings.length === 0 ? (
            <p className="px-[22px] py-12 text-center text-[12.5px] text-(--muted)">
              No toppings yet — add the first topping using the form.
            </p>
          ) : (
            <>
              <ToppingGroup
                label="Standard"
                toppings={standardToppings}
                selectedIds={selectedIds}
                onToggleSelected={toggleSelected}
                onEdit={editTopping}
                onDelete={(topping) => void deleteTopping(topping)}
                onStatusClick={openStatusMenu}
              />
              <ToppingGroup
                label="Cream Upsell"
                toppings={creamToppings}
                selectedIds={selectedIds}
                onToggleSelected={toggleSelected}
                onEdit={editTopping}
                onDelete={(topping) => void deleteTopping(topping)}
                onStatusClick={openStatusMenu}
              />
            </>
          )}
        </section>
      </div>

      {statusMenu ? (
        <div
          className="fixed z-50 min-w-[170px] rounded-[9px] border border-(--line) bg-white p-[5px] shadow-[0_10px_26px_rgba(0,0,0,0.12)]"
          style={{ top: statusMenu.top, left: statusMenu.left }}
        >
          <button
            type="button"
            onClick={() => {
              void setAvailability([statusMenu.toppingId], true);
              setStatusMenu(null);
            }}
            className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-2 text-left text-xs font-semibold text-(--green) transition hover:bg-(--surface)"
          >
            <IconCheck size={13} stroke={2.4} aria-hidden /> Available
          </button>
          <button
            type="button"
            onClick={() => {
              void setAvailability([statusMenu.toppingId], false);
              setStatusMenu(null);
            }}
            className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-2 text-left text-xs font-semibold text-(--muted) transition hover:bg-(--surface)"
          >
            Hidden
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ToppingGroup({
  label,
  toppings,
  selectedIds,
  onToggleSelected,
  onEdit,
  onDelete,
  onStatusClick,
}: {
  label: string;
  toppings: MenuTopping[];
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  onEdit: (topping: MenuTopping) => void;
  onDelete: (topping: MenuTopping) => void;
  onStatusClick: (event: React.MouseEvent, id: string) => void;
}) {
  if (toppings.length === 0) return null;

  return (
    <>
      <p className="mx-[22px] mb-2 mt-4 text-[10.5px] font-bold uppercase tracking-[0.05em] text-(--accent-strong)">
        {label}
      </p>
      <div className="grid gap-x-5 px-[22px] pb-2 sm:grid-cols-2">
        {toppings.map((topping) => (
          <article key={topping.id} className="flex gap-2.5 border-t border-(--line) py-3.5">
            <input
              type="checkbox"
              checked={selectedIds.has(topping.id)}
              onChange={() => onToggleSelected(topping.id)}
              aria-label={`Select ${topping.name}`}
              className="mt-1 accent-(--accent)"
            />
            <Image
              src={topping.image_url}
              alt=""
              width={88}
              height={88}
              className="size-11 shrink-0 rounded-[9px] border border-(--line) bg-(--surface-tint) object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-1.5">
                <p className="truncate text-[13px] font-bold text-foreground">{topping.name}</p>
                <div className="flex shrink-0 gap-1 text-(--muted)">
                  <button
                    type="button"
                    onClick={() => onEdit(topping)}
                    className="grid size-7 place-items-center rounded-md transition hover:bg-(--surface-tint) hover:text-foreground"
                    aria-label={`Edit ${topping.name}`}
                  >
                    <IconPencil size={14} stroke={1.8} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(topping)}
                    className="grid size-7 place-items-center rounded-md transition hover:bg-(--red-soft) hover:text-(--red)"
                    aria-label={`Delete ${topping.name}`}
                  >
                    <IconTrash size={14} stroke={1.8} aria-hidden />
                  </button>
                </div>
              </div>
              <p className="mb-1.5 text-[9.5px] font-bold uppercase text-(--accent-strong)">
                {topping.category === "cream" ? "Cream Upsell" : "Standard"}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded-lg border px-2 py-[3px] text-[10.5px] font-bold ${
                    topping.category === "cream" && Number(topping.price) === 0
                      ? "border-[#f3cfcb] bg-(--surface) text-(--red)"
                      : "border-(--line) bg-(--surface) text-foreground"
                  }`}
                >
                  {Number(topping.price) === 0
                    ? topping.category === "cream"
                      ? "$0.00 ⚠"
                      : "Free"
                    : `$${Number(topping.price).toFixed(2)}`}
                </span>
                <button
                  type="button"
                  onClick={(event) => onStatusClick(event, topping.id)}
                  className={`inline-flex items-center gap-1 whitespace-nowrap rounded-[20px] px-2.5 py-[4px] text-[11px] font-bold ${
                    topping.is_available
                      ? "bg-(--green-soft) text-(--green)"
                      : "bg-(--surface-tint) text-(--muted)"
                  }`}
                >
                  {topping.is_available ? (
                    <>
                      <IconCheck size={11} stroke={2.6} aria-hidden /> Available
                    </>
                  ) : (
                    "Hidden"
                  )}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function GroupTab({ count, label }: { count: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-xl border border-(--line) bg-white px-4 py-2.5 text-[13px] font-semibold text-foreground">
      <span className="rounded-md bg-(--surface) px-2 py-0.5 text-xs font-bold">{count}</span>
      {label}
    </span>
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
