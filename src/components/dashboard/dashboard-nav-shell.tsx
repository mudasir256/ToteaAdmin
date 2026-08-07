import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";

export function DashboardNavShell({
  email,
  name,
}: {
  email: string;
  name: string;
}) {
  return <DashboardSidebar email={email} name={name} />;
}
