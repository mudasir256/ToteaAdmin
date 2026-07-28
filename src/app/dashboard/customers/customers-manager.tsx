"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  IconCalendar,
  IconMail,
  IconMapPin,
  IconPhone,
  IconReceipt2,
  IconSearch,
  IconUser,
  IconUsers,
  IconX,
} from "@tabler/icons-react";

import type { CustomerDTO, OrderStatus } from "@/lib/dashboard/types";

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

function date(value: string | null) {
  if (!value) return "No orders yet";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "TT";
}

function fullAddress(customer: CustomerDTO) {
  const { address } = customer;
  return [
    address.addressLine1,
    address.addressLine2,
    [address.city, address.state, address.postalCode].filter(Boolean).join(", "),
    address.country,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function CustomersManager({
  initialCustomers,
  initialError,
}: {
  initialCustomers: CustomerDTO[];
  initialError?: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CustomerDTO | null>(null);
  const visibleCustomers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return initialCustomers;
    return initialCustomers.filter((customer) =>
      [customer.fullName, customer.email, customer.contactNumber, fullAddress(customer)]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [initialCustomers, query]);

  const repeatCustomers = initialCustomers.filter((customer) => customer.orderCount > 1).length;
  const lifetimeValue = initialCustomers.reduce((sum, customer) => sum + customer.totalSpent, 0);

  return (
    <div className="mt-5">
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Customer summary">
        <Summary icon={<IconUsers size={18} stroke={1.8} aria-hidden />} label="Customers" value={String(initialCustomers.length)} />
        <Summary icon={<IconReceipt2 size={18} stroke={1.8} aria-hidden />} label="Repeat customers" value={String(repeatCustomers)} />
        <Summary icon={<IconUser size={18} stroke={1.8} aria-hidden />} label="Recorded spend" value={money(lifetimeValue)} />
      </section>

      <label className="mt-4 flex h-12 items-center gap-3 rounded-2xl border border-(--line) bg-white px-4 focus-within:border-(--accent) focus-within:ring-2 focus-within:ring-[#a86100]/15">
        <IconSearch size={18} stroke={1.8} className="shrink-0 text-(--muted)" aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-[#829399]"
          placeholder="Search by name, email, phone, or address"
        />
        <span className="text-xs font-medium text-(--muted)">{visibleCustomers.length} shown</span>
      </label>

      {initialError ? (
        <p role="alert" className="mt-3 rounded-xl border border-[#c98b26]/35 bg-(--accent-soft) px-4 py-3 text-sm text-[#7a4d00]">
          {initialError}
        </p>
      ) : null}

      {visibleCustomers.length === 0 ? (
        <section className="mt-4 rounded-2xl border border-(--line) bg-white px-5 py-16 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-(--surface-tint) text-(--accent)">
            <IconUsers size={22} stroke={1.7} aria-hidden />
          </span>
          <p className="mt-4 font-semibold text-foreground">No matching customers</p>
          <p className="mt-1 text-sm text-(--muted)">Customer profiles appear after they create an account.</p>
        </section>
      ) : (
        <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleCustomers.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => setSelected(customer)}
              className="group rounded-2xl border border-(--line) bg-white p-4 text-left outline-none transition hover:-translate-y-0.5 hover:border-[#b8cfcd] hover:shadow-[0_14px_34px_rgba(25,57,67,0.08)] focus-visible:ring-2 focus-visible:ring-(--accent) motion-reduce:hover:translate-y-0"
            >
              <span className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-(--surface-tint) text-sm font-semibold text-foreground">
                  {initials(customer.fullName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-foreground">{customer.fullName}</span>
                  <span className="mt-1 block truncate text-xs text-(--muted)">{customer.email}</span>
                </span>
                <span className="rounded-lg bg-(--accent-soft) px-2 py-1 font-mono text-xs font-semibold text-(--accent-strong)">
                  {customer.orderCount}
                </span>
              </span>
              <span className="mt-5 grid grid-cols-2 gap-3 border-t border-(--line) pt-4">
                <span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-(--muted)">Spent</span>
                  <span className="mt-1 block font-mono text-sm font-semibold text-foreground">{money(customer.totalSpent)}</span>
                </span>
                <span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-(--muted)">Last order</span>
                  <span className="mt-1 block text-sm font-medium text-foreground">{date(customer.lastOrderAt)}</span>
                </span>
              </span>
            </button>
          ))}
        </section>
      )}

      {selected ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#193943]/25 px-4 py-6 backdrop-blur-[2px]" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelected(null);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="customer-detail-title" className="mx-auto w-full max-w-3xl overflow-hidden rounded-[22px] border border-(--line) bg-white shadow-[0_28px_80px_rgba(25,57,67,0.22)]">
            <header className="flex items-start justify-between gap-5 border-b border-(--line) px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-(--surface-tint) font-semibold text-foreground">{initials(selected.fullName)}</span>
                <div>
                  <h2 id="customer-detail-title" className="text-xl font-semibold tracking-tight text-foreground">{selected.fullName}</h2>
                  <p className="mt-1 text-sm text-(--muted)">Customer since {date(selected.joinedAt)}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="grid size-10 place-items-center rounded-xl text-(--muted) transition hover:bg-(--surface-tint) hover:text-foreground focus-visible:ring-2 focus-visible:ring-(--accent)" aria-label="Close customer details">
                <IconX size={19} stroke={1.8} aria-hidden />
              </button>
            </header>

            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="space-y-3">
                <ContactLine icon={<IconMail size={17} stroke={1.8} aria-hidden />} label="Email" value={selected.email} />
                <ContactLine icon={<IconPhone size={17} stroke={1.8} aria-hidden />} label="Phone" value={selected.contactNumber || "Not provided"} />
                <ContactLine icon={<IconMapPin size={17} stroke={1.8} aria-hidden />} label="Address" value={fullAddress(selected) || "Not provided"} />
                <ContactLine icon={<IconCalendar size={17} stroke={1.8} aria-hidden />} label="Last order" value={date(selected.lastOrderAt)} />

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="rounded-xl bg-(--surface-tint) p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-(--muted)">Orders</p>
                    <p className="mt-1 font-mono text-xl font-semibold text-foreground">{selected.orderCount}</p>
                  </div>
                  <div className="rounded-xl bg-(--accent-soft) p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-(--accent-strong)">Spent</p>
                    <p className="mt-1 font-mono text-xl font-semibold text-foreground">{money(selected.totalSpent)}</p>
                  </div>
                </div>
              </div>

              <section>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-(--muted)">Recent orders</p>
                {selected.recentOrders.length === 0 ? (
                  <div className="mt-2 rounded-xl border border-dashed border-(--line) px-4 py-10 text-center text-sm text-(--muted)">No orders recorded yet.</div>
                ) : (
                  <div className="mt-2 divide-y divide-(--line) overflow-hidden rounded-xl border border-(--line)">
                    {selected.recentOrders.map((order) => (
                      <div key={order.id} className="flex items-center gap-3 border-l-[3px] border-l-(--accent) px-4 py-3">
                        <span className="min-w-0 flex-1">
                          <span className="block font-mono text-xs font-semibold text-(--accent)">{order.orderNumber}</span>
                          <span className="mt-1 block text-xs text-(--muted)">{date(order.createdAt)}</span>
                        </span>
                        <span className={`rounded-lg px-2 py-1 text-[10px] font-semibold capitalize ${statusClasses[order.orderStatus]}`}>{order.orderStatus}</span>
                        <span className="font-mono text-xs font-semibold text-foreground">{money(order.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Summary({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <article className="flex min-h-24 items-center gap-4 rounded-2xl border border-(--line) bg-white px-4 py-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-(--surface-tint) text-(--accent)">{icon}</span>
      <span>
        <span className="block font-mono text-xl font-semibold text-foreground">{value}</span>
        <span className="mt-1 block text-xs font-medium text-(--muted)">{label}</span>
      </span>
    </article>
  );
}

function ContactLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-(--line) bg-(--surface) p-3.5">
      <span className="mt-0.5 text-(--accent)">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-(--muted)">{label}</span>
        <span className="mt-1 block break-words text-sm leading-5 text-foreground">{value}</span>
      </span>
    </div>
  );
}

