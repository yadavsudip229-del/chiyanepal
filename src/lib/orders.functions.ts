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
      .select("id,table_number")
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
    const { sendPushToAllStaff } = await import("./push.server");
    await sendPushToAllStaff({
      title: "New order",
      body: `Table ${table.table_number} placed an order — Rs. ${total}`,
      url: "/owner",
    }).catch(() => {});

    return { orderId: order.id as string, total };
    
  });

export const raiseRedFlag = createServerFn({ method: "POST" })
  .inputValidator((input: { orderId: string; tableToken: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: table } = await supabaseAdmin
      .from("tables")
      .select("id,table_number")
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

    const { sendPushToAllStaff } = await import("./push.server");
    await sendPushToAllStaff({
      title: "Customer needs help",
      body: `Table ${table.table_number} raised a flag`,
      url: "/owner",
    }).catch(() => {});

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

async function loadGuestOrder(orderId: string, tableToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: table } = await supabaseAdmin
    .from("tables")
    .select("id")
    .eq("qr_token", tableToken)
    .maybeSingle();
  if (!table) throw new Error("Unknown table");
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .eq("table_id", table.id)
    .maybeSingle();
  if (!order) throw new Error("Order not found");
  return { supabaseAdmin, order };
}

export const updateOrderItems = createServerFn({ method: "POST" })
  .inputValidator((input: { orderId: string; tableToken: string; items: CartLine[]; note?: string | undefined }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin, order } = await loadGuestOrder(data.orderId, data.tableToken);
    if (order.status === "served" || order.status === "cancelled")
      throw new Error("This order can no longer be changed");

    const lines = (data.items ?? []).filter((l) => l.quantity > 0).slice(0, 50);
    if (lines.length === 0) throw new Error("Keep at least one item, or cancel the order");

    const { data: items } = await supabaseAdmin
      .from("menu_items")
      .select("id, name, price, is_available")
      .in(
        "id",
        lines.map((l) => l.menu_item_id),
      );

    const rows = lines.map((line) => {
      const item = items?.find((i) => i.id === line.menu_item_id);
      if (!item || !item.is_available) throw new Error("An item is no longer available");
      return {
        order_id: order.id,
        menu_item_id: item.id,
        item_name: item.name,
        quantity: Math.min(Math.max(1, Math.round(line.quantity)), 20),
        price_at_order: Number(item.price),
      };
    });
    const total = rows.reduce((sum, r) => sum + r.price_at_order * r.quantity, 0);

    await supabaseAdmin.from("order_items").delete().eq("order_id", order.id);
    const { error: insertError } = await supabaseAdmin.from("order_items").insert(rows);
    if (insertError) throw new Error(insertError.message);

    const { error } = await supabaseAdmin
      .from("orders")
      .update({ total_amount: total, note: data.note?.slice(0, 300) ?? null })
      .eq("id", order.id);
    if (error) throw new Error(error.message);
    return { ok: true, total };
  });

export const cancelOrder = createServerFn({ method: "POST" })
  .inputValidator((input: { orderId: string; tableToken: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin, order } = await loadGuestOrder(data.orderId, data.tableToken);
    if (order.status === "served") throw new Error("This order was already served");
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", order.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("red_flags")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("order_id", order.id)
      .eq("status", "open");
    return { ok: true };
  });

export const requestTimeLimit = createServerFn({ method: "POST" })
  .inputValidator((input: { orderId: string; tableToken: string; minutes: number }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin, order } = await loadGuestOrder(data.orderId, data.tableToken);
    if (order.status === "served" || order.status === "cancelled")
      throw new Error("This order is already finished");
    const minutes = Math.min(Math.max(1, Math.round(data.minutes)), 240);
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ time_request_minutes: minutes, time_request_at: new Date().toISOString(), time_response: null })
      .eq("id", order.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const respondTimeRequest = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; orderId: string; answer: "accepted" | "declined" }) => input)
  .handler(async ({ data }) => {
    const { requireRole } = await import("./staff-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    requireRole(data.token, ["owner", "waiter"]);
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ time_response: data.answer })
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getDailySummary = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const { requireRole } = await import("./staff-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    requireRole(data.token, ["owner", "waiter"]);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data: rows, error } = await supabaseAdmin
      .from("orders")
      .select("total_amount, cancelled_at")
      .gte("created_at", start.toISOString());
    if (error) throw new Error(error.message);
    const valid = (rows ?? []).filter((r) => !r.cancelled_at);
    return {
      orderCount: valid.length,
      totalRevenue: valid.reduce((sum, r) => sum + Number(r.total_amount ?? 0), 0),
    };
  });

export const getDailyOrdersHistory = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const { requireRole } = await import("./staff-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    requireRole(data.token, ["owner", "waiter"]);

    // Fetch orders for the past 3 days
    const days = [];
    for (let i = 0; i < 3; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const { data: orders, error } = await supabaseAdmin
        .from("orders")
        .select(
          "id, created_at, total_amount, status, tables(table_number), order_items(item_name, quantity, price_at_order)",
        )
        .gte("created_at", date.toISOString())
        .lt("created_at", nextDate.toISOString())
        .is("cancelled_at", null)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      const totalRevenue = (orders ?? []).reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0);

      days.push({
        date: date.toISOString().split("T")[0],
        displayDate: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        orderCount: orders?.length ?? 0,
        totalRevenue,
        orders: (orders ?? []).map((o) => ({
          id: o.id,
          time: new Date(o.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          tableNumber: (o.tables as any)?.table_number ?? "N/A",
          amount: Number(o.total_amount ?? 0),
          status: o.status,
          items: (o.order_items as any) ?? [],
        })),
      });
    }

    return days;
  });
