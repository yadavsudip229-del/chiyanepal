import { createServerFn } from "@tanstack/react-start";

export const staffLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { pin: string }) => input)
  .handler(async ({ data }) => {
    const { hashPin, issueToken } = await import("./staff-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const pin = String(data.pin ?? "").trim();
    if (pin.length < 4) throw new Error("PIN must be at least 4 digits");

    const { data: staff, error } = await supabaseAdmin
      .from("staff")
      .select("id, name, role")
      .eq("pin_hash", hashPin(pin))
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!staff) throw new Error("Incorrect PIN");

    return {
      token: issueToken({ sid: staff.id, role: staff.role as "owner" | "waiter", name: staff.name }),
      role: staff.role as "owner" | "waiter",
      name: staff.name,
    };
  });

export const changePin = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; targetRole: "owner" | "waiter"; newPin: string }) => input)
  .handler(async ({ data }) => {
    const { hashPin, requireRole } = await import("./staff-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    requireRole(data.token, ["owner"]);
    if (!/^\d{4,8}$/.test(data.newPin)) throw new Error("PIN must be 4-8 digits");
    const { error } = await supabaseAdmin
      .from("staff")
      .update({ pin_hash: hashPin(data.newPin) })
      .eq("role", data.targetRole);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
