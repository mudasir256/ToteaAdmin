import { DashboardNavShell } from "@/components/dashboard/dashboard-nav-shell";
import { getDashboardContext } from "@/lib/dashboard/data";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { identity } = await getDashboardContext();

  return (
    <main className="min-h-dvh bg-(--surface) xl:grid xl:grid-cols-[230px_minmax(0,1fr)]">
      <DashboardNavShell email={identity.email} name={identity.name} />
      {children}
    </main>
  );
}
