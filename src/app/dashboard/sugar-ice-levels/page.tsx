import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { getDashboardContext, getOptionLevelsPageData } from "@/lib/dashboard/data";

import { LevelsManager } from "./levels-manager";

export default async function SugarIceLevelsPage() {
  const [{ identity }, { sugarLevels, iceLevels, error }] = await Promise.all([
    getDashboardContext(),
    getOptionLevelsPageData(),
  ]);

  return (
    <main className="min-h-dvh bg-(--surface) xl:grid xl:grid-cols-[230px_minmax(0,1fr)]">
      <DashboardSidebar
        email={identity.email}
        name={identity.name}
        activeItem="sugar-ice-levels"
      />
      <section className="min-w-0 px-4 py-6 sm:px-7">
        <div className="mx-auto max-w-[1240px]">
          <LevelsManager
            initialSugarLevels={sugarLevels}
            initialIceLevels={iceLevels}
            initialError={error}
          />
        </div>
      </section>
    </main>
  );
}
