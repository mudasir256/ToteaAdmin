"use client";

import type { ComponentProps } from "react";
import { usePathname } from "next/navigation";

import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";

type ActiveItem = NonNullable<ComponentProps<typeof DashboardSidebar>["activeItem"]>;

function activeItemFromPath(pathname: string): ActiveItem {
  if (pathname.startsWith("/dashboard/orders")) return "orders";
  if (pathname.startsWith("/dashboard/customers")) return "customers";
  if (pathname.startsWith("/dashboard/menu")) return "menu";
  if (pathname.startsWith("/dashboard/categories")) return "categories";
  if (pathname.startsWith("/dashboard/toppings")) return "toppings";
  if (pathname.startsWith("/dashboard/sugar-ice-levels")) return "sugar-ice-levels";
  if (pathname.startsWith("/dashboard/recipes")) return "recipes";
  if (pathname.startsWith("/dashboard/inventory")) return "inventory";
  if (pathname.startsWith("/dashboard/reviews")) return "reviews";
  return "overview";
}

export function DashboardNavShell({
  email,
  name,
}: {
  email: string;
  name: string;
}) {
  const pathname = usePathname();
  return (
    <DashboardSidebar
      email={email}
      name={name}
      activeItem={activeItemFromPath(pathname)}
    />
  );
}
