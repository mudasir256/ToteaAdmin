import Link from "next/link";
import {
  IconAlertTriangle,
  IconBan,
  IconCircleCheck,
  IconCup,
  IconReceipt2,
  IconSparkles,
  IconTags,
} from "@tabler/icons-react";

import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { getDashboardContext, getDashboardOverview } from "@/lib/dashboard/data";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const quickLinks = [
  { href: "/dashboard/menu", label: "Add menu item", icon: IconCup },
  { href: "/dashboard/toppings", label: "Add topping", icon: IconSparkles },
  { href: "/dashboard/categories", label: "Add category", icon: IconTags },
  { href: "/dashboard/orders", label: "View orders", icon: IconReceipt2 },
];

export default async function DashboardPage() {
  const [{ identity }, overview] = await Promise.all([
    getDashboardContext(),
    getDashboardOverview(),
  ]);

  const alerts: Array<{ icon: "soldout" | "low"; content: React.ReactNode }> = [
    ...overview.soldOutItems.slice(0, 4).map((name) => ({
      icon: "soldout" as const,
      content: (
        <>
          <b>{name}</b> is Sold Out —{" "}
          <Link href="/dashboard/menu" className="font-semibold text-(--accent-strong) hover:underline">
            review in Menu →
          </Link>
        </>
      ),
    })),
    ...overview.lowStockItems.slice(0, 4).map((item) => ({
      icon: "low" as const,
      content: (
        <>
          <b>{item.name}</b> running low ({item.quantity} {item.unit} left) —{" "}
          <Link href="/dashboard/inventory" className="font-semibold text-(--accent-strong) hover:underline">
            view Inventory →
          </Link>
        </>
      ),
    })),
  ];

  return (
    <main className="min-h-dvh bg-(--surface) xl:grid xl:grid-cols-[230px_minmax(0,1fr)]">
      <DashboardSidebar email={identity.email} name={identity.name} />
      <section className="min-w-0 px-4 py-6 sm:px-7">
        <div className="mx-auto max-w-[1240px]">
          <header className="mb-[18px] flex flex-wrap items-center justify-between gap-2.5">
            <div>
              <h1 className="font-serif text-xl font-bold text-foreground">
                {greeting()}, {identity.name.split(" ")[0]}
              </h1>
              <p className="mt-0.5 text-xs text-(--muted)">Here&apos;s what&apos;s happening today.</p>
            </div>
          </header>

          {overview.error ? (
            <p role="alert" className="mb-4 rounded-xl border border-dashed border-[#d9b57a] bg-[#fdf3e3] px-3 py-2.5 text-xs text-(--accent-strong)">
              {overview.error}
            </p>
          ) : null}

          <section className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4" aria-label="Business overview">
            <StatCard value={String(overview.ordersTodayCount)} label="Orders today" />
            <StatCard value={money(overview.revenueToday)} label="Revenue today" />
            <StatCard value={String(overview.soldOutItems.length)} label="Items sold out" />
            <StatCard value={String(overview.stockAttention)} label="Low-stock alerts" />
          </section>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <section className="rounded-[14px] border border-(--line) bg-white py-[22px]">
              <p className="mb-3 px-6 text-sm font-bold text-foreground">Needs your attention</p>
              {alerts.length === 0 ? (
                <div className="flex items-center gap-2.5 px-6 py-2.5 text-[12.5px] text-(--muted)">
                  <IconCircleCheck size={16} stroke={1.9} className="text-(--green)" aria-hidden />
                  All clear — nothing is sold out and stock levels look healthy.
                </div>
              ) : (
                <div>
                  {alerts.map((alert, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2.5 border-b border-(--line) px-6 py-2.5 text-[12.5px] leading-5 text-foreground last:border-b-0"
                    >
                      {alert.icon === "soldout" ? (
                        <IconBan size={15} stroke={1.9} className="shrink-0 text-(--red)" aria-hidden />
                      ) : (
                        <IconAlertTriangle size={15} stroke={1.9} className="shrink-0 text-(--accent)" aria-hidden />
                      )}
                      <span className="min-w-0">{alert.content}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[14px] border border-(--line) bg-white p-[22px]">
              <p className="mb-3 text-sm font-bold text-foreground">Quick actions</p>
              <div className="grid grid-cols-2 gap-3.5">
                {quickLinks.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={label}
                    href={href}
                    className="rounded-xl border border-(--line) bg-white p-4 text-center outline-none transition hover:border-(--accent) hover:bg-(--accent-soft)/40 focus-visible:ring-2 focus-visible:ring-(--accent)"
                  >
                    <Icon size={20} stroke={1.8} className="mx-auto mb-1.5 text-(--accent)" aria-hidden />
                    <span className="block text-[12.5px] font-semibold text-foreground">{label}</span>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <section className="mt-4 overflow-hidden rounded-[14px] border border-(--line) bg-white">
            <header className="flex items-center justify-between gap-4 border-b border-(--line) px-6 py-4">
              <div>
                <p className="text-sm font-bold text-foreground">Recent orders</p>
                <p className="mt-0.5 text-xs text-(--muted)">The newest website orders.</p>
              </div>
              <Link href="/dashboard/orders" className="text-xs font-semibold text-(--accent-strong) hover:underline">
                See all →
              </Link>
            </header>
            {overview.recentOrders.length === 0 ? (
              <p className="px-6 py-10 text-center text-[12.5px] text-(--muted)">
                No orders yet — completed website checkouts will appear here.
              </p>
            ) : (
              <div>
                {overview.recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href="/dashboard/orders"
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-(--line) px-6 py-3 text-[12.5px] transition last:border-b-0 hover:bg-(--surface-tint)"
                  >
                    <span className="font-mono text-xs font-semibold text-(--accent-strong)">{order.orderNumber}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
                      {order.items[0]?.name ?? "Order"}
                    </span>
                    <span className="truncate text-(--muted)">{order.customerName}</span>
                    <span className="rounded-full bg-(--surface-tint) px-2.5 py-1 text-[11px] font-bold capitalize text-(--muted)">
                      {order.orderStatus}
                    </span>
                    <span className="font-mono font-semibold text-foreground">{money(order.total)}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <article className="rounded-[14px] border border-(--line) bg-white px-5 py-[18px]">
      <p className="font-serif text-[26px] font-semibold leading-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-[11.5px] text-(--muted)">{label}</p>
    </article>
  );
}
