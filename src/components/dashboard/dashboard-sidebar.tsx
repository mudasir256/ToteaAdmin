import Image from "next/image";
import Link from "next/link";
import {
  IconChefHat,
  IconCup,
  IconLayoutDashboard,
  IconPackages,
  IconReceipt2,
  IconSparkles,
  IconStar,
  IconUsers,
} from "@tabler/icons-react";

import { SignOutButton } from "@/app/dashboard/sign-out-button";

const logoUrl = "https://to-tea.vercel.app/assets/logo-CKB8Ex8V.png";

const navigation = [
  { key: "overview", href: "/dashboard", label: "Overview", icon: IconLayoutDashboard },
  { key: "orders", href: "/dashboard/orders", label: "Orders", icon: IconReceipt2 },
  { key: "customers", href: "/dashboard/customers", label: "Customers", icon: IconUsers },
  { key: "menu", href: "/dashboard/menu", label: "Menu", icon: IconCup },
  { key: "recipes", href: "/dashboard/recipes", label: "Recipes", icon: IconChefHat },
  { key: "toppings", href: "/dashboard/toppings", label: "Toppings", icon: IconSparkles },
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
    | "recipes"
    | "toppings"
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
    <aside className="hidden h-dvh flex-col overflow-hidden border-r border-(--line) bg-(--surface-raised) px-4 py-5 xl:sticky xl:top-0 xl:flex">
      <Link
        href="/dashboard"
        className="flex items-center gap-3 rounded-xl px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
        aria-label="ToTea dashboard home"
      >
        <Image
          src={logoUrl}
          alt="ToTea"
          width={42}
          height={42}
          priority
          className="size-10 rounded-full border border-(--line) bg-white object-cover"
        />
        <span>
          <span className="block text-base font-semibold tracking-tight text-foreground">
            ToTea
          </span>
          <span className="block text-[10px] font-medium tracking-[0.16em] text-(--muted)">
            OPERATIONS
          </span>
        </span>
      </Link>

      <nav className="mt-10 grid gap-1" aria-label="Dashboard sections">
        {navigation.map(({ key, href, label, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            className={`group flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-(--accent) ${
              key === activeItem
                ? "bg-(--accent-soft) text-(--accent-strong)"
                : "text-(--muted) hover:bg-(--surface-tint) hover:text-foreground"
            }`}
          >
            <Icon size={19} stroke={1.8} aria-hidden={true} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto border-t border-(--line) px-2 pt-5">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-(--surface-tint) text-xs font-semibold text-foreground">
            {initials || "TT"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-foreground">
              {name}
            </span>
            <span className="block truncate text-xs text-(--muted)">{email}</span>
          </span>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
