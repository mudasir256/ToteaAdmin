import Link from "next/link";
import {
  IconArrowRight,
  IconCurrencyDollar,
  IconPackages,
  IconReceipt2,
  IconUsers,
} from "@tabler/icons-react";

import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { Metric } from "@/components/dashboard/metric";
import { getDashboardContext, getDashboardOverview } from "@/lib/dashboard/data";
import type { OrderStatus } from "@/lib/dashboard/types";

const statusClasses: Record<OrderStatus, string> = {
  pending: "bg-(--accent-soft) text-(--accent-strong)",
  confirmed: "bg-[#edf4ff] text-[#315e92]",
  processing: "bg-[#f0efff] text-[#5d50a8]",
  ready: "bg-[#e8f5ef] text-[#247158]",
  completed: "bg-(--surface-tint) text-foreground",
  cancelled: "bg-[#fff0ed] text-[#a33b2e]",
  refunded: "bg-[#f4f1ed] text-[#6f6257]",
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function orderTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function DashboardPage() {
  const [{ identity }, overview] = await Promise.all([
    getDashboardContext(),
    getDashboardOverview(),
  ]);

  return (
    <main className="min-h-dvh bg-(--surface) xl:grid xl:grid-cols-[236px_minmax(0,1fr)]">
      <DashboardSidebar email={identity.email} name={identity.name} />
      <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-[1240px]">
          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-(--line) pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--accent)">ToTea operations</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
                Welcome back, {identity.name.split(" ")[0]}.
              </h1>
              <p className="mt-1 text-sm leading-6 text-(--muted)">
                Live customers, orders, menu, and stock in one place.
              </p>
            </div>
            <Link href="/dashboard/orders" className="inline-flex h-10 items-center gap-2 rounded-xl bg-(--accent) px-4 text-sm font-semibold text-white transition hover:bg-(--accent-strong) focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2">
              View orders <IconArrowRight size={16} stroke={1.9} aria-hidden />
            </Link>
          </header>

          {overview.error ? (
            <p role="alert" className="mt-4 rounded-xl border border-[#c98b26]/35 bg-(--accent-soft) px-4 py-3 text-sm text-[#7a4d00]">{overview.error}</p>
          ) : null}

          <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Business overview">
            <Metric icon={IconReceipt2} label="Orders" value={String(overview.orders.length)} detail="All website orders" />
            <Metric icon={IconReceipt2} label="Open orders" value={String(overview.openOrderCount)} detail="Pending through ready" />
            <Metric icon={IconUsers} label="Customers" value={String(overview.customerCount)} detail="Registered customer profiles" />
            <Metric icon={IconCurrencyDollar} label="Recorded sales" value={money(overview.paidTotal)} detail="Paid orders in the database" />
          </section>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section className="overflow-hidden rounded-2xl border border-(--line) bg-white">
              <header className="flex items-center justify-between gap-4 border-b border-(--line) px-5 py-4">
                <div>
                  <h2 className="font-semibold text-foreground">Recent order tickets</h2>
                  <p className="mt-1 text-xs text-(--muted)">The newest website orders, updated from Square.</p>
                </div>
                <Link href="/dashboard/orders" className="text-xs font-semibold text-(--accent) hover:text-(--accent-strong)">See all</Link>
              </header>
              {overview.recentOrders.length === 0 ? (
                <div className="px-5 py-14 text-center">
                  <p className="font-semibold text-foreground">No orders yet</p>
                  <p className="mt-1 text-sm text-(--muted)">Completed website checkouts will appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-(--line)">
                  {overview.recentOrders.map((order) => (
                    <Link key={order.id} href="/dashboard/orders" className="grid gap-3 border-l-[3px] border-l-(--accent) px-4 py-3.5 transition hover:bg-(--surface) sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center sm:gap-4 sm:px-5">
                      <span className="min-w-0">
                        <span className="block font-mono text-xs font-semibold text-(--accent)">{order.orderNumber}</span>
                        <span className="mt-1 block truncate text-sm font-semibold text-foreground">{order.items[0]?.name ?? "Order"}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-foreground">{order.customerName}</span>
                        <span className="mt-1 block text-xs text-(--muted)">{orderTime(order.createdAt)}</span>
                      </span>
                      <span className={`w-fit rounded-lg px-2.5 py-1 text-xs font-semibold capitalize ${statusClasses[order.orderStatus]}`}>{order.orderStatus}</span>
                      <span className="font-mono text-sm font-semibold text-foreground">{money(order.total)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <aside className="h-fit rounded-2xl border border-(--line) bg-(--surface-tint) p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-white text-(--accent)">
                <IconPackages size={19} stroke={1.8} aria-hidden />
              </span>
              <p className="mt-5 font-mono text-3xl font-semibold tracking-tight text-foreground">{overview.stockAttention}</p>
              <h2 className="mt-1 font-semibold text-foreground">Stock items need attention</h2>
              <p className="mt-2 text-sm leading-6 text-(--muted)">Items at or below their minimum quantity.</p>
              <Link href="/dashboard/inventory" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-(--accent) hover:text-(--accent-strong)">
                Open inventory <IconArrowRight size={16} stroke={1.9} aria-hidden />
              </Link>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}

