import { createClient } from "@supabase/supabase-js";

import { deno } from "../_shared/runtime.ts";
import { cleanText, isValidUuid } from "../_shared/security.ts";

type RequestedItem = {
  menuItemId: string;
  quantity: number;
  size: string;
  toppingIds?: string[];
};

type CheckoutBody = {
  idempotencyKey: string;
  sourceId: string;
  customerName: string;
  contactNumber: string;
  items: RequestedItem[];
  shippingAddress: {
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  saveContact?: boolean;
};

type MenuRow = {
  id: string;
  name: string;
  image_url: string;
  menu_item_variants: {
    size: string;
    price: number | string;
    sort_order: number;
  }[];
};

type ToppingRow = {
  id: string;
  name: string;
  category: "standard" | "cream";
  price: number | string;
};

const MAX_ITEMS_PER_ORDER = 50;
const MAX_TOPPINGS_PER_ITEM = 12;

function corsHeaders(origin: string | null): Record<string, string> {
  const configuredOrigins = (deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowedOrigin =
    configuredOrigins.length === 0
      ? "*"
      : origin && configuredOrigins.includes(origin)
        ? origin
        : configuredOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(
  status: number,
  body: Record<string, unknown>,
  headers: Record<string, string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function squareBaseUrl() {
  return deno.env.get("SQUARE_ENVIRONMENT") === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

function validateBody(body: CheckoutBody): string | null {
  if (!isValidUuid(body?.idempotencyKey)) {
    return "A valid checkout idempotency key is required.";
  }
  if (!cleanText(body?.sourceId, 512)) return "A valid payment token is required.";
  if (!cleanText(body?.customerName, 160)) return "Customer name is required.";

  const contactNumber = cleanText(body?.contactNumber, 32);
  if (contactNumber.length < 7) return "A valid contact number is required.";

  if (!Array.isArray(body?.items) || body.items.length === 0) {
    return "Your order is empty.";
  }
  if (body.items.length > MAX_ITEMS_PER_ORDER) {
    return "This order contains too many items.";
  }

  const uniqueSelections = new Set<string>();
  for (const item of body.items) {
    if (!isValidUuid(item?.menuItemId)) return "An order item is invalid.";
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 25) {
      return "Item quantities must be between 1 and 25.";
    }
    const size = cleanText(item.size, 60);
    if (!size) return "Choose a size for every item.";
    if (item.toppingIds !== undefined && !Array.isArray(item.toppingIds)) {
      return "Toppings must be a list.";
    }
    const toppingIds = item.toppingIds ?? [];
    if (toppingIds.length > MAX_TOPPINGS_PER_ITEM) {
      return `Choose no more than ${MAX_TOPPINGS_PER_ITEM} toppings per item.`;
    }
    if (toppingIds.some((toppingId) => !isValidUuid(toppingId))) {
      return "An item contains an invalid topping.";
    }
    if (new Set(toppingIds).size !== toppingIds.length) {
      return "The same topping cannot be selected twice.";
    }
    const selectionKey = [
      item.menuItemId,
      size.toLowerCase(),
      [...toppingIds].sort().join(","),
    ].join(":");
    if (uniqueSelections.has(selectionKey)) return "Combine duplicate order items first.";
    uniqueSelections.add(selectionKey);
  }

  const address = body?.shippingAddress;
  if (!address || typeof address !== "object") return "Shipping address is required.";
  if (!cleanText(address.address_line_1, 200)) return "Address line 1 is required.";
  if (!cleanText(address.city, 100)) return "City is required.";
  if (!cleanText(address.state, 100)) return "State is required.";
  if (!cleanText(address.postal_code, 20)) return "Postal code is required.";
  if (cleanText(address.country, 2).toUpperCase() !== "US") {
    return "Country must be the two-letter code US.";
  }

  return null;
}

deno.serve(async (request: Request) => {
  const headers = corsHeaders(request.headers.get("Origin"));
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json(405, { error: "Method not allowed." }, headers);

  try {
    const supabaseUrl = deno.env.get("SUPABASE_URL");
    const anonKey = deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const squareAccessToken = deno.env.get("SQUARE_ACCESS_TOKEN");
    const squareLocationId = deno.env.get("SQUARE_LOCATION_ID");
    const squareVersion = deno.env.get("SQUARE_API_VERSION") ?? "2026-07-15";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json(500, { error: "Checkout database configuration is missing." }, headers);
    }
    if (!squareAccessToken || !squareLocationId) {
      return json(500, { error: "Checkout is temporarily unavailable." }, headers);
    }

    const authorization = request.headers.get("Authorization");
    if (!authorization) return json(401, { error: "Authentication required." }, headers);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return json(401, { error: "Invalid session." }, headers);

    const body = (await request.json()) as CheckoutBody;
    const validationError = validateBody(body);
    if (validationError) return json(400, { error: validationError }, headers);

    const email = cleanText(user.email, 320).toLowerCase();
    if (!email) return json(400, { error: "Your account needs an email address." }, headers);

    const { data: existingOrder } = await admin
      .from("orders")
      .select("id, order_number, total, order_status, payment_status, square_payment_id")
      .eq("idempotency_key", body.idempotencyKey)
      .maybeSingle();

    if (existingOrder) {
      if (existingOrder.payment_status === "paid") {
        return json(
          200,
          { orderId: existingOrder.id, order: existingOrder, reused: true },
          headers,
        );
      }
      return json(
        409,
        { error: "This checkout attempt has already been used. Please try checkout again." },
        headers,
      );
    }

    const menuIds = [...new Set(body.items.map((item) => item.menuItemId))];
    const { data: menuRows, error: menuError } = await admin
      .from("menu_items")
      .select("id, name, image_url, menu_item_variants(size, price, sort_order), menu_categories!inner(is_active)")
      .in("id", menuIds)
      .eq("is_available", true)
      .eq("menu_categories.is_active", true);

    if (menuError || !menuRows || menuRows.length !== menuIds.length) {
      return json(400, { error: "One or more menu items are no longer available." }, headers);
    }

    const menuById = new Map(
      (menuRows as MenuRow[]).map((menuItem) => [menuItem.id, menuItem]),
    );

    const requestedToppingIds = [
      ...new Set(body.items.flatMap((item) => item.toppingIds ?? [])),
    ];
    let toppingRows: ToppingRow[] = [];
    if (requestedToppingIds.length > 0) {
      const { data, error } = await admin
        .from("menu_toppings")
        .select("id, name, category, price")
        .in("id", requestedToppingIds)
        .eq("is_available", true);

      if (error || !data || data.length !== requestedToppingIds.length) {
        return json(
          400,
          { error: "One or more selected toppings are no longer available." },
          headers,
        );
      }
      toppingRows = data as ToppingRow[];
    }
    const toppingById = new Map(
      toppingRows.map((topping) => [topping.id, topping]),
    );

    const orderItems = body.items.map((requested) => {
      const menuItem = menuById.get(requested.menuItemId)!;
      const chosenVariant = menuItem.menu_item_variants.find(
        (variant) =>
          variant.size.toLowerCase() === requested.size.trim().toLowerCase(),
      );
      if (!chosenVariant) throw new Error(`SIZE_NOT_AVAILABLE:${menuItem.name}`);

      const basePrice = Number(chosenVariant.price);
      if (!Number.isFinite(basePrice) || basePrice <= 0) {
        throw new Error("INVALID_MENU_PRICE");
      }

      const toppings = (requested.toppingIds ?? []).map((toppingId) => {
        const topping = toppingById.get(toppingId);
        if (!topping) throw new Error("TOPPING_NOT_AVAILABLE");
        const price = Number(topping.price);
        if (!Number.isFinite(price) || price < 0) {
          throw new Error("INVALID_TOPPING_PRICE");
        }
        return {
          id: topping.id,
          name: topping.name,
          category: topping.category,
          price: Number(price.toFixed(2)),
        };
      });
      const toppingTotal = Number(
        toppings.reduce((sum, topping) => sum + topping.price, 0).toFixed(2),
      );
      const unitPrice = Number((basePrice + toppingTotal).toFixed(2));
      const lineTotal = Number((unitPrice * requested.quantity).toFixed(2));

      return {
        menu_item_id: menuItem.id,
        name: menuItem.name,
        image_url: menuItem.image_url,
        size: chosenVariant.size,
        base_price: Number(basePrice.toFixed(2)),
        toppings,
        topping_total: toppingTotal,
        quantity: requested.quantity,
        unit_price: unitPrice,
        line_total: lineTotal,
      };
    });

    const total = Number(
      orderItems.reduce((sum, item) => sum + item.line_total, 0).toFixed(2),
    );
    const normalizedAddress = {
      address_line_1: cleanText(body.shippingAddress.address_line_1, 200),
      address_line_2: cleanText(body.shippingAddress.address_line_2, 200) || null,
      city: cleanText(body.shippingAddress.city, 100),
      state: cleanText(body.shippingAddress.state, 100),
      postal_code: cleanText(body.shippingAddress.postal_code, 20),
      country: "US",
    };
    const customerDetails = {
      name: cleanText(body.customerName, 160),
      email,
      contact_number: cleanText(body.contactNumber, 32),
    };

    const { data: pendingOrder, error: insertError } = await admin
      .from("orders")
      .insert({
        user_id: user.id,
        customer_details: customerDetails,
        items: orderItems,
        shipping_address: normalizedAddress,
        total,
        idempotency_key: body.idempotencyKey,
      })
      .select("id, order_number")
      .single();

    if (insertError || !pendingOrder) {
      console.error("Order reservation failed", insertError);
      return json(500, { error: "Unable to reserve this order." }, headers);
    }

    const { data: stockReservation, error: stockReservationError } =
      await admin.rpc("reserve_inventory_for_order", {
        p_order_id: pendingOrder.id,
      });

    if (stockReservationError) {
      console.error("Inventory reservation failed", stockReservationError);
      await admin
        .from("orders")
        .update({ order_status: "cancelled", payment_status: "cancelled" })
        .eq("id", pendingOrder.id);
      return json(
        500,
        { error: "Unable to verify inventory. Please try again." },
        headers,
      );
    }

    if (stockReservation?.status !== "reserved") {
      await admin
        .from("orders")
        .update({ order_status: "cancelled", payment_status: "cancelled" })
        .eq("id", pendingOrder.id);
      return json(
        409,
        {
          error:
            stockReservation?.message ??
            "One or more menu items are currently unavailable.",
        },
        headers,
      );
    }

    const squareOrderResponse = await fetch(`${squareBaseUrl()}/v2/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${squareAccessToken}`,
        "Content-Type": "application/json",
        "Square-Version": squareVersion,
      },
      body: JSON.stringify({
        idempotency_key: `${body.idempotencyKey}-order`,
        order: {
          location_id: squareLocationId,
          reference_id: pendingOrder.order_number,
          line_items: orderItems.map((item) => ({
            name: item.name,
            quantity: String(item.quantity),
            base_price_money: {
              amount: Math.round(item.unit_price * 100),
              currency: "USD",
            },
            note: cleanText(
              [
                `Size: ${item.size}`,
                item.toppings.length > 0
                  ? `Toppings: ${item.toppings.map((topping) => topping.name).join(", ")}`
                  : "",
              ]
                .filter(Boolean)
                .join(" | "),
              500,
            ),
          })),
          fulfillments: [
            {
              type: "SHIPMENT",
              state: "PROPOSED",
              shipment_details: {
                recipient: {
                  display_name: customerDetails.name,
                  email_address: email,
                  phone_number: customerDetails.contact_number,
                  address: {
                    address_line_1: normalizedAddress.address_line_1,
                    address_line_2: normalizedAddress.address_line_2 ?? undefined,
                    locality: normalizedAddress.city,
                    administrative_district_level_1: normalizedAddress.state,
                    postal_code: normalizedAddress.postal_code,
                    country: "US",
                  },
                },
              },
            },
          ],
        },
      }),
    });
    const squareOrderJson = await squareOrderResponse.json();
    const squareOrderId = squareOrderJson?.order?.id as string | undefined;
    const squareTotal = Number(squareOrderJson?.order?.total_money?.amount);

    if (!squareOrderResponse.ok || !squareOrderId || !Number.isInteger(squareTotal)) {
      console.error("Square order creation failed", squareOrderJson);
      await admin
        .from("orders")
        .update({ order_status: "cancelled", payment_status: "failed" })
        .eq("id", pendingOrder.id);
      return json(400, { error: "Unable to create the Square order." }, headers);
    }

    await admin.from("orders").update({ square_order_id: squareOrderId }).eq("id", pendingOrder.id);

    const paymentResponse = await fetch(`${squareBaseUrl()}/v2/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${squareAccessToken}`,
        "Content-Type": "application/json",
        "Square-Version": squareVersion,
      },
      body: JSON.stringify({
        idempotency_key: `${body.idempotencyKey}-payment`,
        source_id: cleanText(body.sourceId, 512),
        amount_money: { amount: squareTotal, currency: "USD" },
        location_id: squareLocationId,
        order_id: squareOrderId,
        autocomplete: true,
        buyer_email_address: email,
      }),
    });
    const paymentJson = await paymentResponse.json();
    const payment = paymentJson?.payment;

    if (!paymentResponse.ok || payment?.status !== "COMPLETED" || !payment?.id) {
      console.error("Square payment failed", paymentJson);
      await admin
        .from("orders")
        .update({ order_status: "cancelled", payment_status: "failed" })
        .eq("id", pendingOrder.id);
      return json(
        400,
        {
          error: "Payment was not completed. Check the card details and try again.",
          squareCode: paymentJson?.errors?.[0]?.code ?? null,
        },
        headers,
      );
    }

    if (Number(payment.amount_money?.amount) !== squareTotal) {
      console.error("Square payment amount mismatch", paymentJson);
      return json(
        500,
        { error: "Payment succeeded but the total could not be verified. Contact support." },
        headers,
      );
    }

    const { error: paidUpdateError } = await admin
      .from("orders")
      .update({
        square_payment_id: payment.id,
        payment_status: "paid",
        order_status: "confirmed",
      })
      .eq("id", pendingOrder.id);

    if (paidUpdateError) {
      console.error("Paid order finalization failed", paidUpdateError);
      return json(
        500,
        {
          error: "Payment succeeded, but the order needs support review.",
          squarePaymentId: payment.id,
        },
        headers,
      );
    }

    const { data: inventoryResult, error: inventoryError } = await admin.rpc(
      "deduct_inventory_for_paid_order",
      { p_order_id: pendingOrder.id },
    );
    if (inventoryError) {
      console.error("Paid order inventory deduction failed", inventoryError);
    } else if (
      inventoryResult?.status !== "deducted" &&
      inventoryResult?.status !== "already_deducted"
    ) {
      console.warn("Paid order needs inventory review", inventoryResult);
    }
    if (body.saveContact !== false) {
      const { error: profileError } = await admin
        .from("profiles")
        .update({
          full_name: customerDetails.name,
          contact_number: customerDetails.contact_number,
          ...normalizedAddress,
        })
        .eq("id", user.id);
      if (profileError) console.error("Customer profile update failed", profileError);
    }

    return json(
      200,
      {
        orderId: pendingOrder.id,
        orderNumber: pendingOrder.order_number,
        squareOrderId,
        squarePaymentId: payment.id,
        total,
      },
      headers,
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("SIZE_NOT_AVAILABLE:")) {
      return json(
        400,
        { error: `${error.message.split(":")[1]} is not available in that size.` },
        headers,
      );
    }
    console.error("Unexpected checkout failure", error);
    return json(500, { error: "An unexpected checkout error occurred." }, headers);
  }
});
