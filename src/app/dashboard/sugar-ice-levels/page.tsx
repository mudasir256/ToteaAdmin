import { getOptionLevelsPageData } from "@/lib/dashboard/data";

import { LevelsManager } from "./levels-manager";

export default async function SugarIceLevelsPage() {
  const { sugarLevels, iceLevels, error } = await getOptionLevelsPageData();

  return (
    <section className="min-w-0 px-4 py-6 sm:px-7">
      <div className="mx-auto max-w-[1240px]">
        <LevelsManager
          initialSugarLevels={sugarLevels}
          initialIceLevels={iceLevels}
          initialError={error}
        />
      </div>
    </section>
  );
}
