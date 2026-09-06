import { createFileRoute } from "@tanstack/react-router";

/**
 * Lets a phone's background worker keep its notification registration alive.
 * GET  -> returns the public key needed to re-register.
 * POST -> swaps an expired registration for the fresh one (only for a device we already know).
 */
export const Route = createFileRoute("/api/public/push-device")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({ publicKey: process.env["VAPID_PUBLIC_KEY"] ?? null });
      },
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const { oldEndpoint, endpoint, p256dh, auth } = (body ?? {}) as Record<string, unknown>;
        if (
          typeof oldEndpoint !== "string" ||
          typeof endpoint !== "string" ||
          typeof p256dh !== "string" ||
          typeof auth !== "string" ||
          !endpoint.startsWith("https://")
        ) {
          return new Response("Bad request", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: existing } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id")
          .eq("endpoint", oldEndpoint)
          .maybeSingle();
        if (!existing) return new Response("Unknown device", { status: 404 });

        const { error } = await supabaseAdmin
          .from("push_subscriptions")
          .update({ endpoint, p256dh, auth })
          .eq("id", existing.id);
        if (error) return new Response("Could not update", { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
