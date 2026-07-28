"use client";

import { type FormEvent, useState } from "react";
import {
  IconPencil,
  IconPlus,
  IconStar,
  IconStarFilled,
  IconTrash,
} from "@tabler/icons-react";

import { createClient } from "@/lib/supabase/client";

type Review = {
  id: string;
  reviewer_name: string;
  rating: number;
  description: string;
};

const emptyForm = {
  reviewerName: "",
  rating: 5,
  description: "",
};

type ReviewsManagerProps = {
  initialReviews: Review[];
  initialError?: string;
};

export function ReviewsManager({ initialReviews, initialError }: ReviewsManagerProps) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function loadReviews() {
    setIsLoading(true);
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from("reviews")
      .select("id, reviewer_name, rating, description")
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
    } else {
      setReviews(data as Review[]);
    }

    setIsLoading(false);
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    const payload = {
      reviewer_name: form.reviewerName.trim(),
      rating: form.rating,
      description: form.description.trim(),
    };
    const supabase = createClient();
    const { error: saveError } = editingId
      ? await supabase.from("reviews").update(payload).eq("id", editingId)
      : await supabase.from("reviews").insert(payload);

    if (saveError) {
      setError(saveError.message);
      setIsSaving(false);
      return;
    }

    resetForm();
    await loadReviews();
    setIsSaving(false);
  }

  function startEdit(review: Review) {
    setEditingId(review.id);
    setForm({
      reviewerName: review.reviewer_name,
      rating: review.rating,
      description: review.description,
    });
    setError(null);
  }

  async function deleteReview(id: string) {
    if (!window.confirm("Delete this review?")) {
      return;
    }

    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("reviews").delete().eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    await loadReviews();
  }

  return (
    <div className="mt-6 grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
      <form onSubmit={handleSubmit} className="h-fit rounded-2xl border border-(--line) bg-(--surface-raised) p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-foreground">{editingId ? "Edit review" : "Add a review"}</p>
            <p className="mt-1 text-sm leading-6 text-(--muted)">This review will be readable on the public website.</p>
          </div>
          <span className="grid size-9 place-items-center rounded-xl bg-(--accent-soft) text-(--accent)">
            <IconPlus size={18} stroke={1.9} aria-hidden={true} />
          </span>
        </div>

        <div className="mt-6 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Reviewer name</span>
            <input
              value={form.reviewerName}
              onChange={(event) => setForm((current) => ({ ...current, reviewerName: event.target.value }))}
              className="h-11 rounded-xl border border-(--line) bg-white px-3.5 text-sm text-foreground outline-none transition placeholder:text-[#829399] focus:border-(--accent) focus:ring-2 focus:ring-[#a86100]/20"
              placeholder="Customer name"
              maxLength={120}
              required
            />
          </label>

          <fieldset>
            <legend className="text-sm font-medium text-foreground">Rating</legend>
            <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  role="radio"
                  aria-checked={form.rating === rating}
                  aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
                  onClick={() => setForm((current) => ({ ...current, rating }))}
                  className="grid size-10 place-items-center rounded-xl text-(--accent) outline-none transition hover:bg-(--accent-soft) focus-visible:ring-2 focus-visible:ring-(--accent)"
                >
                  {rating <= form.rating ? <IconStarFilled size={21} aria-hidden={true} /> : <IconStar size={21} stroke={1.8} aria-hidden={true} />}
                </button>
              ))}
              <span className="ml-2 text-sm font-medium text-(--muted)">{form.rating} / 5</span>
            </div>
          </fieldset>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Description</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="min-h-32 resize-y rounded-xl border border-(--line) bg-white px-3.5 py-3 text-sm leading-6 text-foreground outline-none transition placeholder:text-[#829399] focus:border-(--accent) focus:ring-2 focus:ring-[#a86100]/20"
              placeholder="Write the customer review"
              maxLength={1000}
              required
            />
          </label>
        </div>

        {error ? <p role="alert" className="mt-4 rounded-xl border border-[#c98b26]/35 bg-(--accent-soft) px-3.5 py-3 text-sm leading-6 text-[#7a4d00]">{error}</p> : null}

        <div className="mt-6 flex gap-3">
          <button type="submit" disabled={isSaving} className="inline-flex h-11 items-center justify-center rounded-xl bg-(--accent) px-5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(168,97,0,0.16)] transition hover:bg-(--accent-strong) active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60">
            {isSaving ? "Saving..." : editingId ? "Save review" : "Publish review"}
          </button>
          {editingId ? <button type="button" onClick={resetForm} className="inline-flex h-11 items-center justify-center rounded-xl border border-(--line) px-4 text-sm font-semibold text-(--muted) transition hover:border-(--accent) hover:text-(--accent-strong)">Cancel</button> : null}
        </div>
      </form>

      <section className="flex min-h-0 flex-col rounded-2xl border border-(--line) bg-(--surface-raised)">
        <div className="border-b border-(--line) px-5 py-5 sm:px-6">
          <p className="text-base font-semibold text-foreground">Published reviews</p>
          <p className="mt-1 text-sm text-(--muted)">Every review here is visible on the main website.</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? <div className="grid gap-3 p-5 sm:p-6"><div className="h-24 animate-pulse rounded-xl bg-(--surface-tint)" /><div className="h-24 animate-pulse rounded-xl bg-(--surface-tint)" /></div> : null}

          {!isLoading && reviews.length === 0 ? <div className="px-5 py-14 text-center sm:px-6"><p className="text-base font-semibold text-foreground">No reviews yet.</p><p className="mt-2 text-sm leading-6 text-(--muted)">Use the form to publish the first customer review.</p></div> : null}

          {!isLoading && reviews.length > 0 ? <div className="divide-y divide-(--line)">{reviews.map((review) => (
          <article key={review.id} className="px-5 py-5 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-foreground">{review.reviewer_name}</p>
                <div className="mt-1 flex gap-0.5 text-(--accent)" aria-label={`${review.rating} out of 5 stars`}>
                  {Array.from({ length: review.rating }).map((_, index) => <IconStarFilled key={index} size={15} aria-hidden={true} />)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => startEdit(review)} className="grid size-9 place-items-center rounded-xl text-(--muted) outline-none transition hover:bg-(--surface-tint) hover:text-foreground focus-visible:ring-2 focus-visible:ring-(--accent)" aria-label={`Edit review from ${review.reviewer_name}`}><IconPencil size={17} stroke={1.8} aria-hidden={true} /></button>
                <button type="button" onClick={() => void deleteReview(review.id)} className="grid size-9 place-items-center rounded-xl text-(--muted) outline-none transition hover:bg-[#fff1ee] hover:text-[#a33b2e] focus-visible:ring-2 focus-visible:ring-(--accent)" aria-label={`Delete review from ${review.reviewer_name}`}><IconTrash size={17} stroke={1.8} aria-hidden={true} /></button>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-(--muted)">{review.description}</p>
          </article>
          ))}</div> : null}
        </div>
      </section>
    </div>
  );
}
