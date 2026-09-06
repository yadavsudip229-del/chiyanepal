export async function sendPushToAllStaff(payload: { title: string; body: string; url?: string }) {
  const webpush = await import("web-push");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const vapidPublicKey = process.env["VAPID_PUBLIC_KEY"];
  const vapidPrivateKey = process.env["VAPID_PRIVATE_KEY"];
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error("[push] VAPID keys missing — no notifications sent");
    return;
  }

  webpush.default.setVapidDetails(
    "mailto:owner@chiyaghar.example",
    vapidPublicKey,
    vapidPrivateKey,
  );

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, role");
  if (!subs || subs.length === 0) return;

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.default.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            ...payload,
            url: sub.role === "waiter" ? "/waiter" : (payload.url ?? "/owner"),
          }),
          {
            // Keep the alert queued for an hour if the phone is offline/asleep,
            // and ask the push service to deliver it immediately rather than batching it.
            TTL: 3600,
            urgency: "high",
            headers: { Urgency: "high" },
          },
        );
      } catch (err: unknown) {
        const statusCode =
          typeof err === "object" && err !== null && "statusCode" in err
            ? (err as { statusCode?: number }).statusCode
            : undefined;
        console.error(`[push] send failed (${statusCode ?? "unknown"}) for ${sub.endpoint.slice(0, 40)}…`);
        // 404/410 = device forgot us. 401/403 = key mismatch, the row can never work again.
        if (statusCode === 404 || statusCode === 410 || statusCode === 401 || statusCode === 403) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
        }
        throw err;
      }
    }),
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed) console.error(`[push] ${failed}/${subs.length} notifications failed`);
}
