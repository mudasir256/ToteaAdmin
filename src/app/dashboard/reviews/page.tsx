import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { getDashboardContext } from "@/lib/dashboard/data";

import { ReviewsManager } from "./reviews-manager";

export default async function ReviewsPage() {
  const { supabase, identity } = await getDashboardContext();
  const { data: reviews, error: reviewsError } = await supabase
    .from("reviews")
    .select("id, reviewer_name, rating, description")
    .order("created_at", { ascending: false });

  return (
    <main className="h-[100dvh] overflow-hidden bg-(--surface) xl:grid xl:grid-cols-[236px_minmax(0,1fr)]">
      <DashboardSidebar email={identity.email} name={identity.name} activeItem="reviews" />
      <section className="min-w-0 overflow-hidden px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        <div className="mx-auto flex h-full min-h-0 max-w-6xl flex-col">
          <header>
            <p className="text-sm font-medium text-(--accent)">Main website content</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Reviews</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-(--muted)">
              Add and maintain the customer reviews that appear on the public ToTea website.
            </p>
          </header>
          <ReviewsManager initialReviews={reviews ?? []} initialError={reviewsError?.message} />
        </div>
      </section>
    </main>
  );
}
