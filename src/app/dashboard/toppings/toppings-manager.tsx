"use client";

import Image from "next/image";
import { type ChangeEvent, type FormEvent, useState } from "react";
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

const fieldClass =
  "h-11 w-full rounded-xl border border-(--line) bg-white px-3.5 text-sm text-foreground outline-none transition placeholder:text-[#829399] focus:border-(--accent) focus:ring-2 focus:ring-[#a86100]/20";
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const maxImageSize = 5 * 1024 * 1024;

export function ToppingsManager({
  initialToppings,
  initialError,
}: ToppingsManagerProps) {
  const [toppings, setToppings] = useState(initialToppings);
  const [form, setForm] = useState<ToppingForm>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

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
    await loadToppings();
  }

  const standardCount = toppings.filter((topping) => topping.category === "standard").length;
  const creamCount = toppings.length - standardCount;

  return (
    <div className="py-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <SummaryPill label="Standard" value={standardCount} />
          <SummaryPill label="Cream" value={creamCount} />
        </div>
        <button
          type="button"
          onClick={() => void loadToppings()}
          disabled={isLoading}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-(--line) bg-(--surface-raised) px-3.5 text-sm font-semibold text-(--muted) outline-none transition hover:border-(--accent) hover:text-(--accent-strong) focus-visible:ring-2 focus-visible:ring-(--accent) disabled:opacity-60"
        >
          <IconSparkles size={17} stroke={1.8} aria-hidden={true} />
          {isLoading ? "Refreshing..." : "Refresh toppings"}
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-[#c98b26]/35 bg-(--accent-soft) px-4 py-3 text-sm leading-6 text-[#7a4d00]"
        >
          {error}
        </p>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(340px,0.76fr)_minmax(0,1.24fr)]">
        <form
          onSubmit={saveTopping}
          className="rounded-2xl border border-(--line) bg-(--surface-raised) p-5 shadow-[0_18px_45px_rgba(21,58,67,0.05)] sm:p-6"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-(--accent-soft) text-(--accent)">
              <IconSparkles size={18} stroke={1.8} aria-hidden={true} />
            </span>
            <div>
              <p className="text-base font-semibold text-foreground">
                {editingId ? "Edit topping" : "Add a topping"}
              </p>
              <p className="mt-1 text-sm leading-6 text-(--muted)">
                Toppings saved here appear on the public menu.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <Field label="Topping name">
              <input
                required
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                className={fieldClass}
                placeholder="Honey Boba"
                maxLength={80}
              />
            </Field>

            <fieldset>
              <legend className="text-sm font-medium text-foreground">Topping group</legend>
              <div className="mt-2 grid grid-cols-2 rounded-xl border border-(--line) bg-(--surface-tint) p-1">
                {[
                  { value: "standard" as const, label: "Standard" },
                  { value: "cream" as const, label: "Cream upsell" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setForm((current) => ({ ...current, category: option.value }))
                    }
                    className={`h-9 rounded-lg px-3 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-(--accent) ${
                      form.category === option.value
                        ? "bg-white text-foreground shadow-sm"
                        : "text-(--muted) hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Price">
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, price: event.target.value }))
                  }
                  className={fieldClass}
                  placeholder="0.75"
                />
              </Field>
              <Field label="Display order">
                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={form.sortOrder}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sortOrder: event.target.value,
                    }))
                  }
                  className={fieldClass}
                />
              </Field>
            </div>

            <div className="grid min-w-0 gap-2">
              <span className="text-sm font-medium text-foreground">Topping image</span>
              <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-(--line) bg-(--surface-tint) px-3.5 py-2.5 text-sm transition hover:border-(--accent) hover:bg-(--accent-soft)">
                <IconPhotoUp
                  size={18}
                  stroke={1.8}
                  className="shrink-0 text-(--accent)"
                  aria-hidden={true}
                />
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {imageFile
                    ? imageFile.name
                    : form.imageUrl
                      ? "Current image saved — choose a new file to replace it"
                      : "Choose a topping image"}
                </span>
                <span className="shrink-0 text-xs font-semibold text-(--accent)">
                  Browse
                </span>
                <input
                  required={!editingId && !form.imageUrl}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={selectImage}
                  className="sr-only"
                />
              </label>
              <p className="text-xs leading-5 text-(--muted)">
                JPG, PNG, WebP, or AVIF. Maximum file size 5 MB.
              </p>
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-foreground">Availability</legend>
              <div className="mt-2 grid grid-cols-2 rounded-xl border border-(--line) bg-(--surface-tint) p-1">
                {[
                  { value: true, label: "Available" },
                  { value: false, label: "Hidden" },
                ].map((option) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        isAvailable: option.value,
                      }))
                    }
                    className={`h-9 rounded-lg px-3 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-(--accent) ${
                      form.isAvailable === option.value
                        ? "bg-white text-foreground shadow-sm"
                        : "text-(--muted) hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-(--accent) px-5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(168,97,0,0.16)] transition hover:bg-(--accent-strong) active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
            >
              <IconPlus size={17} stroke={2} aria-hidden={true} />
              {isSaving ? "Saving..." : editingId ? "Save topping" : "Create topping"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-(--line) px-4 text-sm font-semibold text-(--muted) transition hover:border-(--accent) hover:text-(--accent-strong)"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <section className="overflow-hidden rounded-2xl border border-(--line) bg-(--surface-raised) shadow-[0_18px_45px_rgba(21,58,67,0.04)]">
          <div className="flex items-start justify-between gap-4 border-b border-(--line) px-5 py-5 sm:px-6">
            <div>
              <p className="text-base font-semibold text-foreground">Topping bar</p>
              <p className="mt-1 text-sm text-(--muted)">
                Image, price, order, and visibility stay synchronized with the website.
              </p>
            </div>
            <span className="rounded-full border border-(--line) bg-(--surface-tint) px-3 py-1.5 text-xs font-semibold text-(--muted)">
              {toppings.length} total
            </span>
          </div>

          {toppings.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-(--accent-soft) text-(--accent)">
                <IconSparkles size={20} stroke={1.8} aria-hidden={true} />
              </span>
              <p className="mt-4 font-semibold text-foreground">No toppings yet</p>
              <p className="mt-2 text-sm text-(--muted)">
                Add the first topping using the form.
              </p>
            </div>
          ) : (
            <div className="grid gap-px bg-(--line) sm:grid-cols-2">
              {toppings.map((topping) => (
                <article key={topping.id} className="bg-white p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <Image
                      src={topping.image_url}
                      alt=""
                      width={96}
                      height={96}
                      className="size-14 shrink-0 rounded-2xl border border-(--line) bg-(--surface-tint) object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">
                            {topping.name}
                          </p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.1em] text-(--accent)">
                            {topping.category === "cream"
                              ? "Cream upsell"
                              : "Standard"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => editTopping(topping)}
                            className="grid size-8 place-items-center rounded-lg text-(--muted) outline-none transition hover:bg-(--surface-tint) hover:text-foreground focus-visible:ring-2 focus-visible:ring-(--accent)"
                            aria-label={`Edit ${topping.name}`}
                          >
                            <IconPencil size={16} stroke={1.8} aria-hidden={true} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteTopping(topping)}
                            className="grid size-8 place-items-center rounded-lg text-(--muted) outline-none transition hover:bg-[#fff1ee] hover:text-[#a33b2e] focus-visible:ring-2 focus-visible:ring-(--accent)"
                            aria-label={`Delete ${topping.name}`}
                          >
                            <IconTrash size={16} stroke={1.8} aria-hidden={true} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-(--accent-soft) px-2.5 py-1.5 text-xs font-semibold text-(--accent-strong)">
                      ${Number(topping.price).toFixed(2)}
                    </span>
                    <span className="rounded-lg bg-(--surface-tint) px-2.5 py-1.5 text-xs font-medium text-(--muted)">
                      Order {topping.sort_order}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                        topping.is_available
                          ? "bg-[#eaf7ef] text-[#26734b]"
                          : "bg-[#f2f4f4] text-[#728084]"
                      }`}
                    >
                      {topping.is_available ? (
                        <IconCheck size={13} stroke={2.4} aria-hidden={true} />
                      ) : null}
                      {topping.is_available ? "Available" : "Hidden"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-(--line) bg-(--surface-raised) px-3.5 text-sm text-(--muted)">
      <strong className="text-base text-foreground">{value}</strong>
      {label}
    </span>
  );
}

function imagePathFromPublicUrl(imageUrl: string) {
  const marker = "/storage/v1/object/public/menu-images/";
  const markerIndex = imageUrl.indexOf(marker);
  return markerIndex === -1
    ? null
    : decodeURIComponent(imageUrl.slice(markerIndex + marker.length));
}
