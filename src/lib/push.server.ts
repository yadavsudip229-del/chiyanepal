export async function sendPushToAllStaff(payload: { title: string; body: string; url?: string }) {
  const webpush = await import("web-push");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const vapidPublicKey = process.env["VAPID_PUBLIC_KEY"];
  const vapidPrivateKey = process.env["VAPID_PRIVATE_KEY"];
  if (!vapidPublicKey || !vapidPrivateKey) return;

  webpush.default.setVapidDetails(
    "mailto:owner@chiyaghar.example",
    vapidPublicKey,
    vapidPrivateKey,
  );

  const { data: owners } = await supabaseAdmin.from("staff").select("id").eq("role", "owner");
  const ownerIds = (owners ?? []).map((owner) => owner.id);
  if (ownerIds.length === 0) return;

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("staff_id", ownerIds);
  if (!subs || subs.length === 0) return;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.default.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ ...payload, url: payload.url ?? "/owner" }),
        );
      } catch (err: unknown) {
        const statusCode =
          typeof err === "object" && err !== null && "statusCode" in err
            ? err.statusCode
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }),
  );
}
