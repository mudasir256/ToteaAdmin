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
  const selectedDrinkCount = selected
    ? selected.items.reduce((sum, item) => sum + item.quantity, 0)
    : 0;

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
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#1a1410]/45 px-0 py-0 backdrop-blur-[3px] sm:items-center sm:px-4 sm:py-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-detail-title"
            className="flex max-h-[100dvh] w-full max-w-[52rem] flex-col overflow-hidden rounded-t-[24px] border border-(--line) bg-white shadow-[0_32px_90px_rgba(26,20,16,0.28)] sm:max-h-[min(92vh,860px)] sm:rounded-[24px]"
          >
            <header className="shrink-0 border-b border-(--line) bg-[linear-gradient(180deg,#fffdf9_0%,#ffffff_100%)] px-5 pb-4 pt-5 sm:px-7 sm:pb-5 sm:pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-[11px] font-semibold tracking-wide text-(--accent)">
                      {selected.orderNumber}
                    </p>
                    <span
                      className={`inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-semibold uppercase tracking-[0.04em] ${statusClasses[selected.orderStatus]}`}
                    >
                      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
                      {statusLabels[selected.orderStatus]}
                    </span>
                    <span
                      className={`inline-flex h-6 items-center rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-[0.04em] ${
                        selected.paymentStatus === "paid"
                          ? "bg-[#e8f5ef] text-[#247158]"
                          : "bg-(--accent-soft) text-(--accent-strong)"
                      }`}
                    >
                      {selected.paymentStatus}
                    </span>
                  </div>
                  <h2
                    id="order-detail-title"
                    className="mt-2 font-serif text-[1.65rem] font-semibold leading-none tracking-tight text-foreground"
                  >
                    Order details
                  </h2>
                  <p className="mt-2 text-[13px] text-(--muted)">{dateTime(selected.createdAt)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="grid size-10 shrink-0 place-items-center rounded-full border border-(--line) bg-white text-(--muted) transition hover:border-(--accent)/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-(--accent)"
                  aria-label="Close order details"
                >
                  <IconX size={18} stroke={1.8} aria-hidden />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="grid gap-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.9fr)]">
                <div className="space-y-6 px-5 py-5 sm:px-7 sm:py-6">
                  <section>
                    <div className="mb-3 flex items-end justify-between gap-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-(--muted)">
                        Items
                      </p>
                      <p className="text-[12px] text-(--muted)">
                        {selectedDrinkCount} {selectedDrinkCount === 1 ? "drink" : "drinks"}
                      </p>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-(--line) bg-white">
                      <ul className="divide-y divide-(--line)">
                        {selected.items.map((item, index) => (
                          <li
                            key={`${item.menuItemId}-${item.size}-${index}`}
                            className="flex gap-3.5 px-4 py-3.5 sm:px-5"
                          >
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt=""
                                className="size-12 shrink-0 rounded-xl object-cover ring-1 ring-(--line)"
                              />
                            ) : (
                              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-(--surface-tint) text-(--accent) ring-1 ring-(--line)">
                                <IconPackage size={18} stroke={1.7} aria-hidden />
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-[14px] font-semibold leading-snug text-foreground">
                                  {item.name}
                                </p>
                                <p className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-foreground">
                                  {money(item.lineTotal)}
                                </p>
                              </div>
                              <p className="mt-1 text-[12px] text-(--muted)">
                                {item.quantity} × {money(item.unitPrice)}
                                {item.size ? ` · ${item.size}` : ""}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {item.sweetness ? (
                                  <span className="rounded-full bg-(--surface-tint) px-2 py-0.5 text-[11px] font-medium text-foreground">
                                    {item.sweetness}
                                  </span>
                                ) : null}
                                {item.ice ? (
                                  <span className="rounded-full bg-(--surface-tint) px-2 py-0.5 text-[11px] font-medium text-foreground">
                                    {item.ice}
                                  </span>
                                ) : null}
                                {item.toppings.map((topping) => (
                                  <span
                                    key={topping.id}
                                    className="rounded-full border border-(--line) bg-white px-2 py-0.5 text-[11px] font-medium text-(--muted)"
                                  >
                                    {topping.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <div className="space-y-2 border-t border-(--line) bg-(--surface) px-4 py-3.5 sm:px-5">
                        <div className="flex items-center justify-between text-[13px]">
                          <span className="text-(--muted)">Subtotal</span>
                          <span className="font-mono tabular-nums text-foreground">
                            {money(selected.subtotal || selected.total)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[13px]">
                          <span className="text-(--muted)">Tax (10%)</span>
                          <span className="font-mono tabular-nums text-foreground">
                            {money(selected.tax)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[13px]">
                          <span className="text-(--muted)">Tip</span>
                          <span className="font-mono tabular-nums text-foreground">
                            {money(selected.tip)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t border-(--line) pt-2.5">
                          <span className="text-[13px] font-semibold text-foreground">
                            Paid total
                          </span>
                          <span className="font-mono text-[1.15rem] font-semibold tabular-nums text-foreground">
                            {money(selected.total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section>
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-(--muted)">
                      Update status
                    </p>
                    <div className="rounded-2xl border border-(--line) bg-(--surface) p-1.5">
                      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                        {orderStatuses.map((status) => {
                          const active = selected.orderStatus === status;
                          return (
                            <button
                              key={status}
                              type="button"
                              disabled={isPending}
                              onClick={() => changeStatus(selected, status)}
                              className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-[12px] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-(--accent) disabled:opacity-50 ${
                                active
                                  ? `${statusClasses[status]} shadow-[0_1px_2px_rgba(25,57,67,0.08)]`
                                  : "bg-transparent text-(--muted) hover:bg-white hover:text-foreground"
                              }`}
                            >
                              {active ? <IconCheck size={14} stroke={2.2} aria-hidden /> : null}
                              {statusLabels[status]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                </div>

                <aside className="border-t border-(--line) bg-(--surface) px-5 py-5 sm:px-6 sm:py-6 lg:border-l lg:border-t-0">
                  <div className="space-y-4">
                    <DetailCard
                      icon={<IconUser size={17} stroke={1.75} aria-hidden />}
                      title="Customer"
                      accent="accent"
                    >
                      <p className="text-[14px] font-semibold text-foreground">
                        {selected.customerName}
                      </p>
                      <a
                        href={`mailto:${selected.customerEmail}`}
                        className="mt-1.5 block break-all text-[13px] text-(--muted) transition hover:text-(--accent-strong)"
                      >
                        {selected.customerEmail}
                      </a>
                      {selected.contactNumber ? (
                        <a
                          href={`tel:${selected.contactNumber}`}
                          className="mt-1 block text-[13px] text-(--muted) transition hover:text-(--accent-strong)"
                        >
                          {selected.contactNumber}
                        </a>
                      ) : (
                        <p className="mt-1 text-[13px] text-(--muted)">No phone saved</p>
                      )}
                    </DetailCard>

                    <DetailCard
                      icon={<IconMapPin size={17} stroke={1.75} aria-hidden />}
                      title="Address"
                      accent="blue"
                    >
                      <p className="text-[13px] leading-6 text-foreground">
                        {selected.shippingAddress.addressLine1}
                        {selected.shippingAddress.addressLine2
                          ? `, ${selected.shippingAddress.addressLine2}`
                          : ""}
                        <br />
                        {selected.shippingAddress.city}, {selected.shippingAddress.state}{" "}
                        {selected.shippingAddress.postalCode}
                        <br />
                        <span className="text-(--muted)">{selected.shippingAddress.country}</span>
                      </p>
                    </DetailCard>

                    <DetailCard
                      icon={<IconCreditCard size={17} stroke={1.75} aria-hidden />}
                      title="Payment"
                      accent="green"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[13px] font-medium text-foreground">Square card</span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${
                            selected.paymentStatus === "paid"
                              ? "bg-[#e8f5ef] text-[#247158]"
                              : "bg-(--accent-soft) text-(--accent-strong)"
                          }`}
                        >
                          {selected.paymentStatus}
                        </span>
                      </div>
                      {selected.squarePaymentId ? (
                        <p
                          className="mt-2 break-all font-mono text-[10px] leading-4 text-(--muted)"
                          title={selected.squarePaymentId}
                        >
                          {selected.squarePaymentId}
                        </p>
                      ) : null}
                    </DetailCard>

                    <DetailCard
                      icon={<IconChefHat size={17} stroke={1.75} aria-hidden />}
                      title="Inventory"
                      accent="olive"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${inventoryClasses[selected.inventoryStatus]}`}
                        >
                          {selected.inventoryStatus === "deducted" ? (
                            <IconCheck size={13} stroke={2.2} aria-hidden />
                          ) : null}
                          {inventoryLabels[selected.inventoryStatus]}
                        </span>
                        {canRetryInventory(selected) ? (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => retryInventory(selected)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-(--line) bg-white px-2.5 text-[11px] font-semibold text-foreground transition hover:border-(--accent) hover:text-(--accent-strong) focus-visible:ring-2 focus-visible:ring-(--accent) disabled:opacity-50"
                          >
                            {selected.inventoryStatus === "failed" ||
                            selected.inventoryStatus === "insufficient_stock" ? (
                              <IconAlertTriangle size={14} stroke={1.9} aria-hidden />
                            ) : (
                              <IconRefresh size={14} stroke={1.9} aria-hidden />
                            )}
                            Retry
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-2.5 text-[12px] leading-5 text-(--muted)">
                        {selected.inventoryError ??
                          "Each paid order is deducted once from its saved recipe."}
                      </p>
                    </DetailCard>
                  </div>
                </aside>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function DetailCard({
  icon,
  title,
  children,
  accent = "accent",
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  accent?: "accent" | "blue" | "green" | "olive";
}) {
  const iconTone = {
    accent: "bg-(--accent-soft) text-(--accent-strong)",
    blue: "bg-[#edf4ff] text-[#315e92]",
    green: "bg-[#e8f5ef] text-[#247158]",
    olive: "bg-[#f0eff8] text-[#5d50a8]",
  }[accent];

  return (
    <section className="rounded-2xl border border-(--line) bg-white p-4 shadow-[0_1px_0_rgba(25,57,67,0.03)]">
      <div className="flex items-center gap-2.5">
        <span className={`grid size-8 place-items-center rounded-xl ${iconTone}`}>{icon}</span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-(--muted)">
          {title}
        </p>
      </div>
      <div className="mt-3 pl-[2.65rem]">{children}</div>
    </section>
  );
}
