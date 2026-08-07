"use server";

import { getCustomerOrders } from "@/lib/dashboard/data";

export async function loadCustomerOrdersAction(customerId: string) {
  try {
    const orders = await getCustomerOrders(customerId);
    return { success: true as const, orders };
  } catch (error) {
    return {
      success: false as const,
      orders: [],
      error: error instanceof Error ? error.message : "Unable to load customer orders.",
    };
  }
}
