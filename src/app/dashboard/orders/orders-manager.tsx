"use client";

import { useMemo, useState, useTransition } from "react";
import {
  IconArrowRight,
  IconCheck,
  IconAlertTriangle,
  IconChefHat,
  IconRefresh,
  IconCreditCard,
  IconMapPin,
  IconPackage,
  IconReceipt2,
  IconSearch,
  IconUser,
  IconX,
} from "@tabler/icons-react";

import type { InventoryStatus, OrderDTO, OrderStatus } from "@/lib/dashboard/types";
import { orderStatuses } from "@/lib/dashboard/types";

import { retryOrderInventoryAction, updateOrderStatusAction } from "./actions";

type OrderFilter = "all" | "open" | "completed" | "cancelled";

const statusLabels: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const statusClasses: Record<OrderStatus, string> = {
  pending: "border-[#e4b65e]/45 bg-(--accent-soft) text-(--accent-strong)",
  confirmed: "border-[#b9d2ed] bg-[#edf4ff] text-[#315e92]",
  processing: "border-[#cbc6ef] bg-[#f0efff] text-[#5d50a8]",
  ready: "border-[#b9ddce] bg-[#e8f5ef] text-[#247158]",
  completed: "border-[#bdd8d2] bg-[#edf7f4] text-[#245f52]",
  cancelled: "border-[#efc5bc] bg-[#fff0ed] text-[#a33b2e]",
  refunded: "border-[#dcd4cb] bg-[#f4f1ed] text-[#6f6257]",
};

const inventoryLabels: Record<InventoryStatus, string> = {
  pending: "Inventory pending",
  deducted: "Stock deducted",
  needs_recipe: "Recipe needed",
  insufficient_stock: "Low inventory",
  failed: "Inventory issue",
};

const inventoryClasses: Record<InventoryStatus, string> = {
  pending: "border-(--line) bg-(--surface-tint) text-(--muted)",
  deducted: "border-[#c8e2d8] bg-white text-[#247158]",
  needs_recipe: "border-[#e4b65e]/45 bg-(--accent-soft) text-(--accent-strong)",
  insufficient_stock: "border-[#efc5bc] bg-[#fff0ed] text-[#a33b2e]",
  failed: "border-[#efc5bc] bg-[#fff0ed] text-[#a33b2e]",
};

function canRetryInventory(order: OrderDTO) {
  return order.paymentStatus === "paid" && order.inventoryStatus !== "deducted";
}

const filters: Array<{ value: OrderFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function dateTime(value: string) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function itemSummary(order: OrderDTO) {
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const first = order.items[0]?.name;
  if (!first) return `${count} ${count === 1 ? "item" : "items"}`;
  return order.items.length > 1 ? `${first} +${order.items.length - 1}` : first;
}

function matchesFilter(order: OrderDTO, filter: OrderFilter) {
  if (filter === "all") return true;
  if (filter === "open") {
    return ["pending", "confirmed", "processing", "ready"].includes(order.orderStatus);
  }
  if (filter === "completed") return order.orderStatus === "completed";
  return order.orderStatus === "cancelled" || order.orderStatus === "refunded";
}

const PAGE_SIZE = 40;

export function OrdersManager({
  initialOrders,
  initialError,
}: {
  initialOrders: OrderDTO[];
  initialError?: string;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<OrderDTO | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [isPending, startTransition] = useTransition();

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesQuery =
        !normalizedQuery ||
        order.orderNumber.toLowerCase().includes(normalizedQuery) ||
        order.customerName.toLowerCase().includes(normalizedQuery) ||
        order.customerEmail.toLowerCase().includes(normalizedQuery) ||
        order.items.some((item) => item.name.toLowerCase().includes(normalizedQuery));
      return matchesQuery && matchesFilter(order, filter);
    });
  }, [filter, orders, query]);

  const visibleOrders = filteredOrders.slice(0, visibleCount);

  function changeStatus(order: OrderDTO, nextStatus: OrderStatus) {
    if (order.orderStatus === nextStatus) return;
    setError(null);
    startTransition(async () => {
      const result = await updateOrderStatusAction(order.id, nextStatus);
      if (!result.success) {
        setError(result.error ?? "Unable to update the order.");
        return;
      }

      setOrders((current) =>
        current.map((entry) =>
          entry.id === order.id ? { ...entry, orderStatus: nextStatus } : entry,
        ),
      );
      setSelected((current) =>
        current?.id === order.id ? { ...current, orderStatus: nextStatus } : current,
      );
    });
  }

  function retryInventory(order: OrderDTO) {
    setError(null);
    startTransition(async () => {
      const result = await retryOrderInventoryAction(order.id);
      if (!result.success || !result.inventoryStatus) {
        setError(result.error ?? "Unable to check inventory for this order.");
        return;
      }

      const inventoryError =
        result.inventoryStatus === "deducted"
          ? null
          : result.missing?.length
            ? `Missing recipe: ${result.missing.join(", ")}`
            : result.message ?? null;
      const update = { inventoryStatus: result.inventoryStatus, inventoryError };
      setOrders((current) =>
        current.map((entry) => (entry.id === order.id ? { ...entry, ...update } : entry)),
      );
      setSelected((current) =>
        current?.id === order.id ? { ...current, ...update } : current,
      );
    });
  }

  return (
    <div className="mt-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-(--line) bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border border-(--line) bg-(--surface) px-3.5 focus-within:border-(--accent) focus-within:ring-2 focus-within:ring-[#a86100]/15">
          <IconSearch size={18} stroke={1.8} className="shrink-0 text-(--muted)" aria-hidden />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-[#829399]"
            placeholder="Search order, customer, or item"
          />
        </label>
        <div className="flex flex-wrap gap-1 rounded-xl bg-(--surface-tint) p-1" aria-label="Order filters">
          {filters.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setFilter(option.value);
                setVisibleCount(PAGE_SIZE);
              }}
              className={`h-9 rounded-lg px-3 text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-(--accent) ${
                filter === option.value
                  ? "bg-white text-foreground shadow-[0_1px_4px_rgba(25,57,67,0.1)]"
                  : "text-(--muted) hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-xl border border-[#c98b26]/35 bg-(--accent-soft) px-4 py-3 text-sm text-[#7a4d00]">
          {error}
        </p>
      ) : null}

      <section className="mt-4 overflow-hidden rounded-2xl border border-(--line) bg-white">
        <div className="hidden grid-cols-[1.05fr_1fr_0.85fr_0.65fr_36px] gap-4 border-b border-(--line) px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-(--muted) md:grid">
          <span>Ticket</span>
          <span>Customer</span>
          <span>Status</span>
          <span className="text-right">Total</span>
          <span />
        </div>

        {visibleOrders.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-(--surface-tint) text-(--accent)">
              <IconReceipt2 size={22} stroke={1.7} aria-hidden />
            </span>
            <p className="mt-4 font-semibold text-foreground">No matching orders</p>
            <p className="mt-1 text-sm text-(--muted)">New website orders will appear here automatically.</p>
          </div>
        ) : (
          <div className="divide-y divide-(--line)">
            {visibleOrders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => setSelected(order)}
                className="group relative grid w-full gap-3 border-l-[3px] border-l-(--accent) px-4 py-4 text-left outline-none transition hover:bg-(--surface) focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--accent) md:grid-cols-[1.05fr_1fr_0.85fr_0.65fr_36px] md:items-center md:gap-4 md:px-5"
              >
                <span className="min-w-0">
                  <span className="block font-mono text-xs font-semibold text-(--accent)">{order.orderNumber}</span>
                  <span className="mt-1 block truncate text-sm font-semibold text-foreground">{itemSummary(order)}</span>
                  <span className="mt-1 block text-xs text-(--muted)">{dateTime(order.createdAt)}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">{order.customerName}</span>
                  <span className="mt-1 block truncate text-xs text-(--muted)">{order.customerEmail}</span>
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold leading-none ${statusClasses[order.orderStatus]}`}
                  >
                    <span className="size-1.5 shrink-0 rounded-full bg-current opacity-70" aria-hidden />
                    {statusLabels[order.orderStatus]}
                  </span>
                  <span
                    className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold leading-none ${inventoryClasses[order.inventoryStatus]}`}
                  >
                    {order.inventoryStatus === "deducted" ? (
                      <IconCheck size={13} stroke={2.2} aria-hidden />
                    ) : null}
                    {inventoryLabels[order.inventoryStatus]}
                  </span>
                </span>
                <span className="font-mono text-sm font-semibold text-foreground md:text-right">{money(order.total)}</span>
                <span className="hidden size-9 place-items-center rounded-xl text-(--muted) transition group-hover:bg-(--surface-tint) group-hover:text-foreground md:grid">
                  <IconArrowRight size={17} stroke={1.8} aria-hidden />
                </span>
              </button>
            ))}
          </div>
        )}
        {filteredOrders.length > visibleCount ? (
          <div className="border-t border-(--line) px-5 py-3">
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              className="w-full rounded-xl border border-(--line) bg-(--surface) px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-white focus-visible:ring-2 focus-visible:ring-(--accent)"
            >
              Show more orders ({filteredOrders.length - visibleCount} remaining)
            </button>
          </div>
        ) : null}
      </section>

      {selected ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#193943]/25 px-4 py-6 backdrop-blur-[2px]" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelected(null);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="order-detail-title" className="mx-auto w-full max-w-3xl overflow-hidden rounded-[22px] border border-(--line) bg-white shadow-[0_28px_80px_rgba(25,57,67,0.22)]">
            <header className="flex items-start justify-between gap-5 border-b border-(--line) px-5 py-5 sm:px-6">
              <div>
                <p className="font-mono text-xs font-semibold text-(--accent)">{selected.orderNumber}</p>
                <h2 id="order-detail-title" className="mt-1 text-xl font-semibold tracking-tight text-foreground">Order details</h2>
                <p className="mt-1 text-sm text-(--muted)">{dateTime(selected.createdAt)}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="grid size-10 place-items-center rounded-xl text-(--muted) transition hover:bg-(--surface-tint) hover:text-foreground focus-visible:ring-2 focus-visible:ring-(--accent)" aria-label="Close order details">
                <IconX size={19} stroke={1.8} aria-hidden />
              </button>
            </header>

            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(240px,0.85fr)]">
              <div className="space-y-5">
                <section>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-(--muted)">Items</p>
                  <div className="mt-2 divide-y divide-(--line) rounded-xl border border-(--line)">
                    {selected.items.map((item, index) => (
                      <div key={`${item.menuItemId}-${item.size}-${index}`} className="flex items-center gap-3 px-4 py-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-(--surface-tint) text-(--accent)">
                          <IconPackage size={17} stroke={1.8} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">{item.name}</span>
                          <span className="mt-0.5 block text-xs text-(--muted)">
                            {[
                              item.size || null,
                              item.sweetness ? `Sugar: ${item.sweetness}` : null,
                              item.ice ? `Ice: ${item.ice}` : null,
                              `${item.quantity} × ${money(item.unitPrice)}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                          {item.toppings.length > 0 ? (
                            <span className="mt-1 block text-xs leading-5 text-(--muted)">
                              Toppings: {item.toppings.map((topping) => topping.name).join(", ")}
                            </span>
                          ) : null}
                        </span>
                        <span className="font-mono text-xs font-semibold text-foreground">{money(item.lineTotal)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm font-semibold text-foreground">Total</span>
                      <span className="font-mono text-base font-semibold text-foreground">{money(selected.total)}</span>
                    </div>
                  </div>
                </section>

                <section>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-(--muted)">Update status</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {orderStatuses.map((status) => (
                      <button key={status} type="button" disabled={isPending} onClick={() => changeStatus(selected, status)} className={`h-9 rounded-xl px-3 text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-(--accent) disabled:opacity-50 ${selected.orderStatus === status ? statusClasses[status] : "border border-(--line) bg-white text-(--muted) hover:border-(--accent) hover:text-foreground"}`}>
                        {selected.orderStatus === status ? <IconCheck size={14} stroke={2.2} className="mr-1 inline" aria-hidden /> : null}
                        {statusLabels[status]}
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <div className="space-y-3">
                <DetailCard icon={<IconUser size={18} stroke={1.8} aria-hidden />} title="Customer">
                  <p className="font-semibold text-foreground">{selected.customerName}</p>
                  <p className="mt-1 break-all text-sm text-(--muted)">{selected.customerEmail}</p>
                  <p className="mt-1 text-sm text-(--muted)">{selected.contactNumber || "No phone saved"}</p>
                </DetailCard>
                <DetailCard icon={<IconMapPin size={18} stroke={1.8} aria-hidden />} title="Delivery">
                  <p className="text-sm leading-6 text-foreground">
                    {selected.shippingAddress.addressLine1}
                    {selected.shippingAddress.addressLine2 ? `, ${selected.shippingAddress.addressLine2}` : ""}<br />
                    {selected.shippingAddress.city}, {selected.shippingAddress.state} {selected.shippingAddress.postalCode}<br />
                    {selected.shippingAddress.country}
                  </p>
                </DetailCard>
                <DetailCard icon={<IconCreditCard size={18} stroke={1.8} aria-hidden />} title="Payment">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-foreground">Square card</span>
                    <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${selected.paymentStatus === "paid" ? "bg-[#e8f5ef] text-[#247158]" : "bg-(--accent-soft) text-(--accent-strong)"}`}>
                      {selected.paymentStatus}
                    </span>
                  </div>
                  {selected.squarePaymentId ? <p className="mt-2 break-all font-mono text-[10px] leading-4 text-(--muted)">{selected.squarePaymentId}</p> : null}
                </DetailCard>
                <DetailCard icon={<IconChefHat size={18} stroke={1.8} aria-hidden />} title="Inventory">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${inventoryClasses[selected.inventoryStatus]}`}>
                      {inventoryLabels[selected.inventoryStatus]}
                    </span>
                    {canRetryInventory(selected) ? (
                      <button type="button" disabled={isPending} onClick={() => retryInventory(selected)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-(--line) bg-white px-2.5 text-xs font-semibold text-foreground transition hover:border-(--accent) hover:text-(--accent-strong) focus-visible:ring-2 focus-visible:ring-(--accent) disabled:opacity-50">
                        {selected.inventoryStatus === "failed" || selected.inventoryStatus === "insufficient_stock" ? <IconAlertTriangle size={14} stroke={1.9} aria-hidden /> : <IconRefresh size={14} stroke={1.9} aria-hidden />}
                        Retry
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-(--muted)">
                    {selected.inventoryError ?? "Each paid order is deducted once from its saved recipe."}
                  </p>
                </DetailCard>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function DetailCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-(--line) bg-(--surface) p-4">
      <div className="flex items-center gap-2 text-(--muted)">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-[0.08em]">{title}</p>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
