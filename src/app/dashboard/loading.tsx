export default function DashboardLoading() {
  return (
    <section className="min-w-0 px-4 py-6 sm:px-7" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-[1240px] animate-pulse">
        <div className="h-7 w-48 rounded-lg bg-(--line)" />
        <div className="mt-2 h-3.5 w-72 max-w-full rounded-md bg-(--line)/70" />

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="h-56 rounded-[14px] border border-(--line) bg-white p-5">
            <div className="h-4 w-28 rounded bg-(--line)" />
            <div className="mt-4 space-y-3">
              <div className="h-10 rounded-lg bg-(--surface-tint)" />
              <div className="h-10 rounded-lg bg-(--surface-tint)" />
              <div className="h-10 rounded-lg bg-(--surface-tint)" />
              <div className="h-10 rounded-lg bg-(--surface-tint)" />
            </div>
          </div>
          <div className="h-56 rounded-[14px] border border-(--line) bg-white p-5">
            <div className="h-4 w-28 rounded bg-(--line)" />
            <div className="mt-4 space-y-3">
              <div className="h-10 rounded-lg bg-(--surface-tint)" />
              <div className="h-10 rounded-lg bg-(--surface-tint)" />
              <div className="h-10 rounded-lg bg-(--surface-tint)" />
              <div className="h-10 rounded-lg bg-(--surface-tint)" />
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs font-medium text-(--muted)">Loading…</p>
      </div>
    </section>
  );
}
