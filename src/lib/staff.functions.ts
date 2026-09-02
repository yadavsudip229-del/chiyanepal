import { createServerFn } from "@tanstack/react-start";

const DEFAULT_PIN = "1234";

export const staffLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { pin: string }) => input)
  .handler(async ({ data }) => {
    const { hashPin, issueToken } = await import("./staff-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const pin = String(data.pin ?? "").trim();
    if (pin.length < 4) throw new Error("PIN must be at least 4 digits");

    // Several owners / waiters may share the same role PIN, so take the first match.
    const { data: rows, error } = await supabaseAdmin
      .from("staff")
      .select("id, name, role")
      .eq("pin_hash", hashPin(pin))
      .limit(1);

    if (error) throw new Error(error.message);
    const staff = rows?.[0];
    if (!staff) throw new Error("Incorrect PIN");

    return {
      token: issueToken({ sid: staff.id, role: staff.role as "owner" | "waiter", name: staff.name }),
      role: staff.role as "owner" | "waiter",
      name: staff.name,
      mustChangePin: pin === DEFAULT_PIN,
    };
  });

/** Owner-only: shows whether each role is still on the default 1234 PIN. */
export const getPinStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const { hashPin, requireRole } = await import("./staff-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    requireRole(data.token, ["owner"]);

    const { data: rows, error } = await supabaseAdmin.from("staff").select("role, pin_hash");
    if (error) throw new Error(error.message);
    const def = hashPin(DEFAULT_PIN);
    const forRole = (role: "owner" | "waiter") => {
      const list = (rows ?? []).filter((r) => r.role === role);
      return {
        accounts: list.length,
        isDefault: list.length > 0 && list.every((r) => r.pin_hash === def),
      };
    };
    return { owner: forRole("owner"), waiter: forRole("waiter") };
  });

/** Owner-only: sets a new 6-digit PIN for every account of the given role. */
export const changePin = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; targetRole: "owner" | "waiter"; newPin: string }) => input)
  .handler(async ({ data }) => {
    const { hashPin, requireRole } = await import("./staff-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    requireRole(data.token, ["owner"]);
    if (!/^\d{6}$/.test(data.newPin)) throw new Error("PIN must be exactly 6 digits");
    if (data.newPin === "123456") throw new Error("Please choose a less obvious PIN");
    const { error } = await supabaseAdmin
      .from("staff")
      .update({ pin_hash: hashPin(data.newPin) })
      .eq("role", data.targetRole);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Owner-only: resets a role back to the starter PIN 1234. */
export const resetPin = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; targetRole: "owner" | "waiter" }) => input)
  .handler(async ({ data }) => {
    const { hashPin, requireRole } = await import("./staff-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    requireRole(data.token, ["owner"]);
    const { error } = await supabaseAdmin
      .from("staff")
      .update({ pin_hash: hashPin(DEFAULT_PIN) })
      .eq("role", data.targetRole);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
/** Saves this device's push notification subscription for the signed-in staff member and role. */
export const savePushSubscription = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; endpoint: string; p256dh: string; auth: string }) => input)
  .handler(async ({ data }) => {
    const { requireRole } = await import("./staff-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const claims = requireRole(data.token, ["owner", "waiter"]);
    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(
        {
          staff_id: claims.sid,
          role: claims.role,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
        },
        { onConflict: "endpoint" }
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Removes this device's push subscription (used on sign-out or when alerts are turned off). */
export const removePushSubscription = createServerFn({ method: "POST" })
  .inputValidator((input: { endpoint: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    return { ok: true };
  });
