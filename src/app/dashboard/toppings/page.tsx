import { getDashboardContext } from "@/lib/dashboard/data";

import { ToppingsManager, type MenuTopping } from "./toppings-manager";

export default async function ToppingsPage() {
  const { supabase } = await getDashboardContext();
  const { data, error } = await supabase
    .from("menu_toppings")
    .select("id, name, category, image_url, price, is_available, sort_order")
    .order("sort_order", { ascending: true });

  return (
    <section className="min-w-0 px-4 py-6 sm:px-7">
      <div className="mx-auto max-w-[1240px]">
        <ToppingsManager
          initialToppings={(data ?? []) as MenuTopping[]}
          initialError={error?.message}
        />
      </div>
    </section>
  );
}
