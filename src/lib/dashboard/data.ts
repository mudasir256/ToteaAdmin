import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type {
  AddressDTO,
  CustomerDTO,
  OrderDTO,
  InventoryStatus,
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
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, user_id, customer_details, items, shipping_address, total, order_status, payment_status, inventory_status, inventory_error, payment_method, square_order_id, square_payment_id, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

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
        "id, full_name, email, profile_image_url, contact_number, address_line_1, address_line_2, city, state, postal_code, country, created_at",
      )
      .eq("role", "customer")
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("id, order_number, user_id, total, order_status, payment_status, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const orderRows = (ordersResult.data ?? []) as JsonRecord[];
  const customers: CustomerDTO[] = ((profilesResult.data ?? []) as JsonRecord[]).map((profile) => {
    const customerOrders = orderRows.filter((order) => order.user_id === profile.id);
    return {
      id: text(profile.id),
      fullName: text(profile.full_name) || "Customer",
      email: text(profile.email),
      profileImageUrl: text(profile.profile_image_url) || null,
      contactNumber: text(profile.contact_number),
      address: addressDTO(profile),
      joinedAt: text(profile.created_at),
      orderCount: customerOrders.length,
      totalSpent: customerOrders
        .filter((order) => order.payment_status === "paid")
        .reduce((sum, order) => sum + number(order.total), 0),
      lastOrderAt: customerOrders[0] ? text(customerOrders[0].created_at) : null,
      recentOrders: customerOrders.slice(0, 5).map((order) => ({
        id: text(order.id),
        orderNumber: text(order.order_number),
        total: number(order.total),
        orderStatus: orderStatus(order.order_status),
        paymentStatus: paymentStatus(order.payment_status),
        createdAt: text(order.created_at),
      })),
    };
  });

  return {
    customers,
    error: profilesResult.error?.message ?? ordersResult.error?.message,
  };
}

export async function getDashboardOverview() {
  const { supabase } = await getDashboardContext();
  const [ordersResult, customerCountResult, inventoryResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, customer_details, items, total, order_status, payment_status, inventory_status, inventory_error, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer"),
    supabase
      .from("inventory_items")
      .select("current_quantity, minimum_quantity, is_active")
      .eq("is_active", true),
  ]);

  const orders = ((ordersResult.data ?? []) as JsonRecord[]).map((row) => orderDTO(row));
  const inventory = (inventoryResult.data ?? []) as Array<{
    current_quantity: number | string;
    minimum_quantity: number | string;
  }>;
  const stockAttention = inventory.filter((item) => {
    const current = number(item.current_quantity);
    const minimum = number(item.minimum_quantity);
    return current === 0 || (minimum > 0 && current <= minimum);
  }).length;

  return {
    orders,
    recentOrders: orders.slice(0, 6),
    customerCount: customerCountResult.count ?? 0,
    openOrderCount: orders.filter((order) =>
      ["pending", "confirmed", "processing", "ready"].includes(order.orderStatus),
    ).length,
    paidTotal: orders
      .filter((order) => order.paymentStatus === "paid")
      .reduce((sum, order) => sum + order.total, 0),
    stockAttention,
    error:
      ordersResult.error?.message ??
      customerCountResult.error?.message ??
      inventoryResult.error?.message,
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

