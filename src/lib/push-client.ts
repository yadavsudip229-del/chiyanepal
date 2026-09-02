import { removePushSubscription } from "@/lib/staff.functions";

/** Turns off push on this device and forgets it on the server (used on sign-out). */
export async function disablePushOnThisDevice() {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe().catch(() => {});
    await removePushSubscription({ data: { endpoint } }).catch(() => {});
  } catch {
    /* nothing to clean up */
  }
}
