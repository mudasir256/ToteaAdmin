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
    <main className="h-[100dvh] overflow-hidden bg-(--surface) xl:grid xl:grid-cols-[230px_minmax(0,1fr)]">
      <DashboardSidebar email={identity.email} name={identity.name} activeItem="reviews" />
      <section className="min-w-0 overflow-hidden px-4 py-6 sm:px-7">
        <div className="mx-auto flex h-full min-h-0 max-w-[1240px] flex-col">
          <header>
            <h1 className="font-serif text-xl font-bold text-foreground">Reviews</h1>
            <p className="mt-0.5 text-xs text-(--muted)">
              Add and maintain the customer reviews that appear on the public Totea website.
            </p>
          </header>
          <ReviewsManager initialReviews={reviews ?? []} initialError={reviewsError?.message} />
        </div>
      </section>
    </main>
  );
}
