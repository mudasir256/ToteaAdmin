import Link from "next/link";
import {
  IconChefHat,
  IconCup,
  IconDroplet,
  IconLayoutDashboard,
  IconPackages,
  IconReceipt2,
  IconSparkles,
  IconStar,
  IconTags,
  IconUsers,
} from "@tabler/icons-react";

import { SignOutButton } from "@/app/dashboard/sign-out-button";

const navigation = [
  { key: "overview", href: "/dashboard", label: "Overview", icon: IconLayoutDashboard },
  { key: "orders", href: "/dashboard/orders", label: "Orders", icon: IconReceipt2 },
  { key: "customers", href: "/dashboard/customers", label: "Customers", icon: IconUsers },
  { key: "menu", href: "/dashboard/menu", label: "Menu", icon: IconCup },
  { key: "categories", href: "/dashboard/categories", label: "Categories", icon: IconTags },
  { key: "toppings", href: "/dashboard/toppings", label: "Toppings", icon: IconSparkles },
  {
    key: "sugar-ice-levels",
    href: "/dashboard/sugar-ice-levels",
    label: "Sugar & Ice Levels",
    icon: IconDroplet,
  },
  { key: "recipes", href: "/dashboard/recipes", label: "Recipes", icon: IconChefHat },
  { key: "inventory", href: "/dashboard/inventory", label: "Inventory", icon: IconPackages },
  { key: "reviews", href: "/dashboard/reviews", label: "Reviews", icon: IconStar },
];

type DashboardSidebarProps = {
  email: string;
  name: string;
  activeItem?:
    | "overview"
    | "orders"
    | "customers"
    | "menu"
    | "categories"
    | "toppings"
    | "sugar-ice-levels"
    | "recipes"
    | "inventory"
    | "reviews";
};

export function DashboardSidebar({
  email,
  name,
  activeItem = "overview",
}: DashboardSidebarProps) {
  const initials = name
    .split(" ")
    .map((part) => part.at(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="hidden h-dvh flex-col overflow-hidden border-r border-(--line) bg-white px-4 py-5 xl:sticky xl:top-0 xl:flex">
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 rounded-xl px-2.5 pb-5 pt-1.5 outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
        aria-label="Totea dashboard home"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full border-[1.5px] border-(--foreground) font-serif text-[13px] font-semibold text-foreground">
          TT
        </span>
        <span>
          <span className="block font-serif text-[15px] font-semibold leading-tight text-foreground">
            Totea
          </span>
          <span className="block text-[9px] font-medium uppercase tracking-[0.1em] text-(--muted)">
            Operations
          </span>
        </span>
      </Link>

      <nav className="grid gap-0.5" aria-label="Dashboard sections">
        {navigation.map(({ key, href, label, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            className={`flex items-center gap-3 rounded-[9px] px-3 py-[11px] text-[13.5px] outline-none transition focus-visible:ring-2 focus-visible:ring-(--accent) ${
              key === activeItem
                ? "bg-(--accent-soft) font-bold text-(--accent-strong)"
                : "font-medium text-foreground hover:bg-(--surface-tint)"
            }`}
          >
            <Icon size={18} stroke={1.8} className="opacity-80" aria-hidden={true} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto border-t border-(--line) pt-2.5">
        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-(--line) bg-(--surface) text-[11px] font-bold text-(--muted)">
            {initials || "TT"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-semibold text-foreground">
              {name}
            </span>
            <span className="block truncate text-[10.5px] text-(--muted)">{email}</span>
          </span>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
