import { createClient } from "@supabase/supabase-js";

import { deno } from "../_shared/runtime.ts";
import { timingSafeEqual } from "../_shared/security.ts";

type SquarePayment = {
  id?: string;
  order_id?: string;
  status?: string;
};

type SquareEvent = {
  event_id?: string;
  type?: string;
  data?: { object?: { payment?: SquarePayment } };
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function hasValidSignature(
  rawBody: string,
  signature: string | null,
  notificationUrl: string,
  signatureKey: string,
): Promise<boolean> {
  if (!signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signatureKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(notificationUrl + rawBody),
  );
  const expected = btoa(
    String.fromCharCode(...new Uint8Array(digest)),
  );

  return timingSafeEqual(expected, signature);
}

deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed." });

  try {
    const signatureKey = deno.env.get("SQUARE_WEBHOOK_SIGNATURE_KEY");
    const notificationUrl = deno.env.get("SQUARE_WEBHOOK_NOTIFICATION_URL");
    const supabaseUrl = deno.env.get("SUPABASE_URL");
    const serviceRoleKey = deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!signatureKey || !notificationUrl || !supabaseUrl || !serviceRoleKey) {
      return json(500, { error: "Webhook configuration is incomplete." });
    }

    const rawBody = await request.text();
    if (
      !(await hasValidSignature(
        rawBody,
        request.headers.get("x-square-hmacsha256-signature"),
        notificationUrl,
        signatureKey,
      ))
    ) {
      return json(403, { error: "Invalid webhook signature." });
    }

    const event = JSON.parse(rawBody) as SquareEvent;
    if (!event.event_id) return json(400, { error: "Missing event ID." });

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: eventError } = await admin.from("webhook_events").insert({
      provider: "square",
      event_id: event.event_id,
      event_type: event.type ?? null,
      payload: event,
    });

    if (eventError?.code === "23505") return json(200, { ok: true, duplicate: true });
    if (eventError) {
      console.error("Unable to record Square webhook", eventError);
      return json(500, { error: "Unable to record webhook." });
    }

    const payment = event.data?.object?.payment;
    if (!payment?.id && !payment?.order_id) {
      await admin
        .from("webhook_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("provider", "square")
        .eq("event_id", event.event_id);
      return json(200, { ok: true, ignored: true });
    }

    let orderQuery = admin
      .from("orders")
      .select("id, order_status, payment_status")
      .limit(1);
    orderQuery = payment.id
      ? orderQuery.eq("square_payment_id", payment.id)
      : orderQuery.eq("square_order_id", payment.order_id!);

    let { data: order, error: lookupError } = await orderQuery.maybeSingle();

    if (!order && !lookupError && payment.id && payment.order_id) {
      const fallback = await admin
        .from("orders")
        .select("id, order_status, payment_status")
        .eq("square_order_id", payment.order_id)
        .maybeSingle();
      order = fallback.data;
      lookupError = fallback.error;
    }

    if (lookupError) {
      console.error("Square order lookup failed", lookupError);
      return json(500, { error: "Order lookup failed." });
    }

    if (!order) return json(200, { ok: true, unmatched: true });

    const patch: Record<string, string> = {};
    if (payment.status === "COMPLETED") {
      patch.payment_status = "paid";
      if (order.order_status === "pending") patch.order_status = "confirmed";
    } else if (payment.status === "FAILED") {
      patch.payment_status = "failed";
      if (!["completed", "refunded"].includes(order.order_status)) {
        patch.order_status = "cancelled";
      }
    } else if (payment.status === "CANCELED") {
      patch.payment_status = "cancelled";
      if (!["completed", "refunded"].includes(order.order_status)) {
        patch.order_status = "cancelled";
      }
    } else if (payment.status === "PENDING") {
      patch.payment_status = "pending";
    }

    if (Object.keys(patch).length > 0) {
      const { error: updateError } = await admin.from("orders").update(patch).eq("id", order.id);
      if (updateError) {
        console.error("Square order update failed", updateError);
        return json(500, { error: "Order update failed." });
      }
    }

    if (payment.status === "COMPLETED") {
      const { data: inventoryResult, error: inventoryError } = await admin.rpc(
        "deduct_inventory_for_paid_order",
        { p_order_id: order.id },
      );

      if (inventoryError) {
        console.error("Square inventory deduction failed", inventoryError);
        return json(500, { error: "Inventory deduction failed." });
      }

      if (inventoryResult?.status !== "deducted" && inventoryResult?.status !== "already_deducted") {
        console.warn("Square payment needs inventory review", inventoryResult);
      }
    }
    await admin
      .from("webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("provider", "square")
      .eq("event_id", event.event_id);

    return json(200, { ok: true });
  } catch (error) {
    console.error("Square webhook failed", error);
    return json(500, { error: "Webhook processing failed." });
  }
});
