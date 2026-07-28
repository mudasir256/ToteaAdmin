"use server";

import { revalidatePath } from "next/cache";

import { retryOrderInventory, updateOrderStatus } from "@/lib/dashboard/data";
import { orderStatuses, type OrderStatus } from "@/lib/dashboard/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function updateOrderStatusAction(orderId: string, nextStatus: string) {
  if (!UUID_PATTERN.test(orderId) || !orderStatuses.includes(nextStatus as OrderStatus)) {
    return { success: false, error: "Invalid order update." };
  }

  try {
    await updateOrderStatus(orderId, nextStatus as OrderStatus);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard/customers");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to update the order.",
    };
  }
}

export async function retryOrderInventoryAction(orderId: string) {
  if (!UUID_PATTERN.test(orderId)) {
    return { success: false, error: "Invalid order." };
  }

  try {
    const result = await retryOrderInventory(orderId);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard/inventory");
    return {
      success: true,
      inventoryStatus: result.status,
      message: result.message,
      missing: result.missing,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to check inventory for this order.",
    };
  }
}

