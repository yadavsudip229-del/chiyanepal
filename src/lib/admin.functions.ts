import { createServerFn } from "@tanstack/react-start";

export const saveCategory = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; id?: string; name: string; sort_order?: number }) => input)
  .handler(async ({ data }) => {
    const { requireRole } = await import("./staff-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    requireRole(data.token, ["owner"]);
    const payload = { name: data.name.trim().slice(0, 60), sort_order: data.sort_order ?? 0 };
    if (!payload.name) throw new Error("Name is required");
    const query = data.id
      ? supabaseAdmin.from("menu_categories").update(payload).eq("id", data.id)
      : supabaseAdmin.from("menu_categories").insert(payload);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; id: string }) => input)
  .handler(async ({ data }) => {
    const { requireRole } = await import("./staff-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    requireRole(data.token, ["owner"]);
    const { error } = await supabaseAdmin.from("menu_categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveMenuItem = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      token: string;
      id?: string;
      category_id: string;
      name: string;
      description?: string;
      price: number;
      photo_url?: string;
      is_available: boolean;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { requireRole } = await import("./staff-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    requireRole(data.token, ["owner"]);
    const payload = {
      category_id: data.category_id,
      name: data.name.trim().slice(0, 80),
      description: data.description?.trim().slice(0, 200) || null,
      price: Math.max(0, Number(data.price) || 0),
      photo_url: data.photo_url?.trim() || null,
      is_available: data.is_available,
    };
    if (!payload.name) throw new Error("Name is required");
    if (!payload.category_id) throw new Error("Pick a category");
    const query = data.id
      ? supabaseAdmin.from("menu_items").update(payload).eq("id", data.id)
      : supabaseAdmin.from("menu_items").insert(payload);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMenuItem = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; id: string }) => input)
  .handler(async ({ data }) => {
    const { requireRole } = await import("./staff-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    requireRole(data.token, ["owner"]);
    const { error } = await supabaseAdmin.from("menu_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addTable = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; table_number: string }) => input)
  .handler(async ({ data }) => {
    const { requireRole } = await import("./staff-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    requireRole(data.token, ["owner"]);
    const number = data.table_number.trim().slice(0, 20);
    if (!number) throw new Error("Table number is required");
    const { error } = await supabaseAdmin.from("tables").insert({ table_number: number });
    if (error) throw new Error(error.message.includes("duplicate") ? "That table already exists" : error.message);
    return { ok: true };
  });

export const deleteTable = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; id: string }) => input)
  .handler(async ({ data }) => {
    const { requireRole } = await import("./staff-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    requireRole(data.token, ["owner"]);
    const { error } = await supabaseAdmin.from("tables").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveShopSettings = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      token: string;
      id: string;
      shop_name: string;
      wifi_ssid: string;
      wifi_password: string;
      wifi_encryption: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { requireRole } = await import("./staff-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    requireRole(data.token, ["owner"]);
    const { error } = await supabaseAdmin
      .from("shop_settings")
      .update({
        shop_name: data.shop_name.trim().slice(0, 60),
        wifi_ssid: data.wifi_ssid.trim().slice(0, 60),
        wifi_password: data.wifi_password.trim().slice(0, 60),
        wifi_encryption: data.wifi_encryption,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
