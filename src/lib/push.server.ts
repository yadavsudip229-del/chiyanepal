export async function sendPushToAllStaff(payload: { title: string; body: string; url?: string }) {
  const webpush = await import("web-push");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const vapidPublicKey = process.env["VAPID_PUBLIC_KEY"];
  const vapidPrivateKey = process.env["VAPID_PRIVATE_KEY"];
  if (!vapidPublicKey || !vapidPrivateKey) return;

  webpush.default.setVapidDetails("mailto:owner@chiyaghar.example", vapidPublicKey, vapidPrivateKey);

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, role");
  if (!subs || subs.length === 0) return;

  await Promise.all(
    subs.map(async (sub) => {
      // Each device only gets alerts for the role it is currently signed in as.
      const url = sub.role === "waiter" ? "/waiter" : (payload.url ?? "/owner");
      try {
        await webpush.default.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ ...payload, url })
        );
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    })
  );
}
