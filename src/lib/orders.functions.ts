import { createServerFn } from "@tanstack/react-start";

type CartLine = { menu_item_id: string; quantity: number };

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((input: { tableToken: string; items: CartLine[]; note?: string | undefined }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const lines = (data.items ?? []).filter((l) => l.quantity > 0).slice(0, 50);
    if (lines.length === 0) throw new Error("Your cart is empty");

    const { data: table, error: tableError } = await supabaseAdmin
      .from("tables")
      .select("id")
      .eq("qr_token", data.tableToken)
      .maybeSingle();
    if (tableError) throw new Error(tableError.message);
    if (!table) throw new Error("Unknown table");

    const { data: items, error: itemsError } = await supabaseAdmin
      .from("menu_items")
      .select("id, name, price, is_available")
      .in(
        "id",
        lines.map((l) => l.menu_item_id),
      );
    if (itemsError) throw new Error(itemsError.message);

    const rows = lines.map((line) => {
      const item = items?.find((i) => i.id === line.menu_item_id);
      if (!item || !item.is_available) throw new Error("An item is no longer available");
      return {
        menu_item_id: item.id,
        item_name: item.name,
        quantity: Math.min(Math.max(1, Math.round(line.quantity)), 20),
        price_at_order: Number(item.price),
      };
    });

    const total = rows.reduce((sum, r) => sum + r.price_at_order * r.quantity, 0);

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        table_id: table.id,
        status: "received",
        payment_method: "counter",
        payment_status: "pending",
        total_amount: total,
        note: data.note?.slice(0, 300) ?? null,
      })
      .select("id")
      .single();
    if (orderError) throw new Error(orderError.message);

    const { error: linesError } = await supabaseAdmin
      .from("order_items")
      .insert(rows.map((r) => ({ ...r, order_id: order.id })));
    if (linesError) throw new Error(linesError.message);

    return { orderId: order.id as string, total };
  });

export const raiseRedFlag = createServerFn({ method: "POST" })
  .inputValidator((input: { orderId: string; tableToken: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: table } = await supabaseAdmin
      .from("tables")
      .select("id")
      .eq("qr_token", data.tableToken)
      .maybeSingle();
    if (!table) throw new Error("Unknown table");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status")
      .eq("id", data.orderId)
      .eq("table_id", table.id)
      .maybeSingle();
    if (!order) throw new Error("Order not found");

    const { data: existing } = await supabaseAdmin
      .from("red_flags")
      .select("id")
      .eq("order_id", order.id)
      .eq("status", "open")
      .maybeSingle();
    if (existing) return { ok: true, alreadyOpen: true };

    const { error } = await supabaseAdmin
      .from("red_flags")
      .insert({ order_id: order.id, table_id: table.id, status: "open" });
    if (error) throw new Error(error.message);
    return { ok: true, alreadyOpen: false };
  });

export const setOrderEta = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; orderId: string; minutes: number }) => input)
  .handler(async ({ data }) => {
    const { requireRole } = await import("./staff-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    requireRole(data.token, ["owner"]);
    const minutes = Math.min(Math.max(1, Math.round(data.minutes)), 240);
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: "preparing", eta_minutes: minutes, eta_set_at: new Date().toISOString() })
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markOrderServed = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; orderId: string }) => input)
  .handler(async ({ data }) => {
    const { requireRole } = await import("./staff-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    requireRole(data.token, ["owner", "waiter"]);
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: "served", served_at: new Date().toISOString(), payment_status: "pending" })
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("red_flags")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("order_id", data.orderId)
      .eq("status", "open");
    return { ok: true };
  });

export const markPaid = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; orderId: string; method: "cash" | "card" }) => input)
  .handler(async ({ data }) => {
    const { requireRole } = await import("./staff-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    requireRole(data.token, ["owner", "waiter"]);
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ payment_status: "paid", payment_method: data.method })
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resolveRedFlag = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; flagId: string }) => input)
  .handler(async ({ data }) => {
    const { requireRole } = await import("./staff-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    requireRole(data.token, ["owner", "waiter"]);
    const { error } = await supabaseAdmin
      .from("red_flags")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", data.flagId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
