import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type {
  AddressDTO,
  CustomerDTO,
  OrderDTO,
  InventoryStatus,
  MenuOptionLevelDTO,
  OptionLevelKind,
  OrderItemDTO,
  OrderStatus,
  PaymentStatus,
} from "@/lib/dashboard/types";
import { orderStatuses } from "@/lib/dashboard/types";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function orderStatus(value: unknown): OrderStatus {
  return orderStatuses.includes(value as OrderStatus) ? (value as OrderStatus) : "pending";
}

function inventoryStatus(value: unknown): InventoryStatus {
  return ["pending", "deducted", "needs_recipe", "insufficient_stock", "failed"].includes(
    String(value),
  )
    ? (value as InventoryStatus)
    : "pending";
}


function paymentStatus(value: unknown): PaymentStatus {
  return ["pending", "paid", "failed", "refunded", "cancelled"].includes(String(value))
    ? (value as PaymentStatus)
    : "pending";
}

function addressDTO(value: unknown): AddressDTO {
  const address = record(value);
  return {
    addressLine1: text(address.address_line_1),
    addressLine2: text(address.address_line_2),
    city: text(address.city),
    state: text(address.state),
    postalCode: text(address.postal_code),
    country: text(address.country) || "US",
  };
}

function orderItemsDTO(value: unknown): OrderItemDTO[] {
  if (!Array.isArray(value)) return [];

  return value.map((entry) => {
    const item = record(entry);
    const toppings = Array.isArray(item.toppings)
      ? item.toppings.map((entry) => {
          const topping = record(entry);
          return {
            id: text(topping.id),
            name: text(topping.name) || "Topping",
            category: topping.category === "cream" ? "cream" as const : "standard" as const,
            price: number(topping.price),
          };
        })
      : [];

    return {
      menuItemId: text(item.menu_item_id),
      name: text(item.name) || "Menu item",
      imageUrl: text(item.image_url),
      size: text(item.size),
      sweetness: text(item.sweetness) || null,
      ice: text(item.ice) || null,
      toppings,
      quantity: number(item.quantity),
      unitPrice: number(item.unit_price),
      lineTotal: number(item.line_total),
    };
  });
}

function orderDTO(row: JsonRecord): OrderDTO {
  const customer = record(row.customer_details);
  return {
    id: text(row.id),
    orderNumber: text(row.order_number),
    userId: text(row.user_id) || null,
    customerName: text(customer.name) || "Customer",
    customerEmail: text(customer.email),
    contactNumber: text(customer.contact_number),
    items: orderItemsDTO(row.items),
    shippingAddress: addressDTO(row.shipping_address),
    total: number(row.total),
    orderStatus: orderStatus(row.order_status),
    paymentStatus: paymentStatus(row.payment_status),
    inventoryStatus: inventoryStatus(row.inventory_status),
    inventoryError: text(row.inventory_error) || null,
    paymentMethod: "square_card",
    squareOrderId: text(row.square_order_id) || null,
    squarePaymentId: text(row.square_payment_id) || null,
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

export const getDashboardContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") redirect("/login");

  return {
    supabase,
    user,
    identity: {
      name:
        profile.full_name?.trim() ||
        (typeof user.user_metadata.full_name === "string" && user.user_metadata.full_name.trim()) ||
        user.email?.split("@")[0] ||
        "ToTea team",
      email: profile.email || user.email || "Signed-in teammate",
    },
  };
});

export async function getOrdersPageData() {
  const { supabase } = await getDashboardContext();
  // Cap payload size; older history can be added later with server pagination.
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, user_id, customer_details, items, shipping_address, total, order_status, payment_status, inventory_status, inventory_error, payment_method, square_order_id, square_payment_id, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(150);

  return {
    orders: (data ?? []).map((row) => orderDTO(row as JsonRecord)),
    error: error?.message,
  };
}

export async function getCustomersPageData() {
  const { supabase } = await getDashboardContext();
  const [profilesResult, ordersResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, email, profile_image_url, contact_number, address_line_1, address_line_2, city, state, postal_code, country, role, created_at, updated_at",
      )
      .eq("role", "customer")
      .order("created_at", { ascending: false }),
    // Aggregates only — full order history loads when a customer is opened.
    supabase
      .from("orders")
      .select("id, user_id, total, payment_status, created_at")
      .order("created_at", { ascending: false }),
  ]);

  type OrderAgg = {
    orderCount: number;
    totalSpent: number;
    lastOrderAt: string | null;
  };
  const aggregates = new Map<string, OrderAgg>();
  for (const row of (ordersResult.data ?? []) as JsonRecord[]) {
    const userId = text(row.user_id);
    if (!userId) continue;
    const existing = aggregates.get(userId) ?? {
      orderCount: 0,
      totalSpent: 0,
      lastOrderAt: null,
    };
    existing.orderCount += 1;
    if (paymentStatus(row.payment_status) === "paid") {
      existing.totalSpent += number(row.total);
    }
    if (!existing.lastOrderAt) {
      existing.lastOrderAt = text(row.created_at) || null;
    }
    aggregates.set(userId, existing);
  }

  const customers: CustomerDTO[] = ((profilesResult.data ?? []) as JsonRecord[]).map((profile) => {
    const stats = aggregates.get(text(profile.id)) ?? {
      orderCount: 0,
      totalSpent: 0,
      lastOrderAt: null,
    };
    return {
      id: text(profile.id),
      fullName: text(profile.full_name) || "Customer",
      email: text(profile.email),
      profileImageUrl: text(profile.profile_image_url) || null,
      contactNumber: text(profile.contact_number),
      address: addressDTO(profile),
      role: text(profile.role) || "customer",
      joinedAt: text(profile.created_at),
      updatedAt: text(profile.updated_at),
      orderCount: stats.orderCount,
      totalSpent: stats.totalSpent,
      lastOrderAt: stats.lastOrderAt,
      orders: [],
    };
  });

  return {
    customers,
    error: profilesResult.error?.message ?? ordersResult.error?.message,
  };
}

export async function getCustomerOrders(customerId: string) {
  const { supabase } = await getDashboardContext();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, user_id, customer_details, items, shipping_address, total, order_status, payment_status, inventory_status, inventory_error, created_at, updated_at",
    )
    .eq("user_id", customerId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return ((data ?? []) as JsonRecord[]).map((row) => orderDTO(row));
}

export async function getDashboardOverview() {
  const { supabase } = await getDashboardContext();

  const [recentOrdersResult, statsResult, inventoryResult, menuResult] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, customer_details, items, total, order_status, payment_status, inventory_status, inventory_error, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.rpc("admin_dashboard_stats"),
    supabase
      .from("inventory_items")
      .select("name, current_quantity, minimum_quantity, unit")
      .eq("is_active", true),
    supabase
      .from("menu_items")
      .select("name")
      .eq("is_available", false)
      .order("sort_order", { ascending: true }),
  ]);

  const recentOrders = ((recentOrdersResult.data ?? []) as JsonRecord[]).map((row) =>
    orderDTO(row),
  );
  const lowStockItems = (
    (inventoryResult.data ?? []) as Array<{
      name: string;
      current_quantity: number | string;
      minimum_quantity: number | string;
      unit: string;
    }>
  )
    .filter((item) => {
      const current = number(item.current_quantity);
      const minimum = number(item.minimum_quantity);
      return current === 0 || (minimum > 0 && current <= minimum);
    })
    .map((item) => ({
      name: item.name,
      quantity: number(item.current_quantity),
      unit: item.unit,
    }));

  const stats = record(statsResult.data);
  const statsError =
    statsResult.error && !statsResult.error.message.includes("Could not find the function")
      ? statsResult.error.message
      : undefined;

  return {
    orders: recentOrders,
    recentOrders,
    ordersTodayCount: number(stats.orders_today_count),
    revenueToday: number(stats.revenue_today),
    customerCount: number(stats.customer_count),
    openOrderCount: number(stats.open_order_count),
    paidTotal: number(stats.paid_total),
    soldOutItems: ((menuResult.data ?? []) as Array<{ name: string }>).map((item) => item.name),
    lowStockItems,
    stockAttention: lowStockItems.length,
    error:
      recentOrdersResult.error?.message ??
      statsError ??
      inventoryResult.error?.message ??
      menuResult.error?.message,
  };
}

function optionLevelKind(value: unknown): OptionLevelKind {
  return value === "ice" ? "ice" : "sugar";
}

function optionLevelDTO(row: JsonRecord): MenuOptionLevelDTO {
  return {
    id: text(row.id),
    kind: optionLevelKind(row.kind),
    name: text(row.name),
    sortOrder: number(row.sort_order),
    isDefault: Boolean(row.is_default),
    isActive: row.is_active !== false,
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

export async function getOptionLevelsPageData() {
  const { supabase } = await getDashboardContext();
  const { data, error } = await supabase
    .from("menu_option_levels")
    .select("id, kind, name, sort_order, is_default, is_active, created_at, updated_at")
    .order("sort_order", { ascending: true });

  const levels = ((data ?? []) as JsonRecord[]).map(optionLevelDTO);

  return {
    sugarLevels: levels.filter((level) => level.kind === "sugar"),
    iceLevels: levels.filter((level) => level.kind === "ice"),
    levels,
    error: error?.message,
  };
}

export async function getPublicOptionLevels() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_option_levels")
    .select("id, kind, name, sort_order, is_default, is_active, created_at, updated_at")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  const levels = ((data ?? []) as JsonRecord[]).map(optionLevelDTO);
  return {
    sugar: levels.filter((level) => level.kind === "sugar"),
    ice: levels.filter((level) => level.kind === "ice"),
  };
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const { supabase } = await getDashboardContext();
  const { error } = await supabase
    .from("orders")
    .update({ order_status: status })
    .eq("id", orderId);

  if (error) throw new Error(error.message);
}

export async function retryOrderInventory(orderId: string) {
  const { supabase } = await getDashboardContext();
  const { data, error } = await supabase.rpc("deduct_inventory_for_paid_order", {
    p_order_id: orderId,
  });

  if (error) throw new Error(error.message);

  const result = record(data);
  const status =
    result.status === "already_deducted" ? "deducted" : inventoryStatus(result.status);
  return {
    status,
    message:
      text(result.message) ||
      (result.status === "already_deducted"
        ? "Inventory was already deducted for this order."
        : "Inventory check finished."),
    missing: Array.isArray(result.missing) ? result.missing.map(String) : [],
  };
}

