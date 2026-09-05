import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Bell, BellOff, Clock, Check, BanknoteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type BoardOrder,
  type SoundId,
  SOUND_OPTIONS,
  etaRemaining,
  formatSeconds,
  playPreview,
  useLiveBoard,
  useOrderAlerts,
} from "@/lib/live-orders";
import {
  cancelOrderAsStaff,
  markOrderServed,
  resolveRedFlag,
  respondTimeRequest,
  setOrderEta,
} from "@/lib/orders.functions";
import { handleStaffSessionError, type StaffSession } from "@/lib/staff-client";
import { savePushSubscription } from "@/lib/staff.functions";
import { disablePushOnThisDevice } from "@/lib/push-client";

const VAPID_PUBLIC_KEY = "BNASDuCMRo9Bc8iNOmrbeZMdjZ9yl--8hiRHwrR9IMkU5j-qFsX2tnGPgKMNXgzYtqqnrO78uWHFlHEp_5rgGkI";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}


const ETA_PRESETS = [5, 10, 15, 20, 30];

function statusStyle(order: BoardOrder) {
  const flagged = order.red_flags.some((f) => f.status === "open");
  if (flagged)
    return {
      label: "Red flag",
      wrap: "border-status-flag bg-status-flag-soft animate-urgent",
      chip: "bg-status-flag text-primary-foreground",
    };
  if (order.status === "served")
    return {
      label: "Served",
      wrap: "border-status-served bg-status-served-soft",
      chip: "bg-status-served text-primary-foreground",
    };
  if (order.status === "preparing")
    return {
      label: "Preparing",
      wrap: "border-status-prep bg-status-prep-soft",
      chip: "bg-status-prep text-primary-foreground",
    };
  return {
    label: "New order",
    wrap: "border-status-new bg-status-new-soft",
    chip: "bg-status-new text-primary-foreground",
  };
}

export function OrdersBoard({ session, hideServed }: { session: StaffSession; hideServed?: boolean }) {
  const isOwner = session.role === "owner";
  const { data, isLoading, error } = useLiveBoard();
  const queryClient = useQueryClient();
  const [soundOn, setSoundOn] = useState(true);
  const [soundId, setSoundId] = useState<SoundId>("chime");
  const [notifyOn, setNotifyOn] = useState(false);
  const [alertsLoaded, setAlertsLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [customEta, setCustomEta] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("chiya-alerts");
    if (saved) {
      try {
        const p = JSON.parse(saved) as { soundOn?: boolean; soundId?: SoundId; notifyOn?: boolean };
        if (typeof p.soundOn === "boolean") setSoundOn(p.soundOn);
        if (p.soundId) setSoundId(p.soundId);
        if (typeof p.notifyOn === "boolean") setNotifyOn(p.notifyOn);
      } catch {
        /* ignore */
      }
    }
    setAlertsLoaded(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("chiya-alerts", JSON.stringify({ soundOn, soundId, notifyOn }));
  }, [soundOn, soundId, notifyOn]);

  // Keep this device's push registration tied to the role that is signed in right now.
  useEffect(() => {
    if (!alertsLoaded) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    void (async () => {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return;
      if (!notifyOn) {
        await disablePushOnThisDevice();
        return;
      }
      const raw = subscription.toJSON();
      await savePushSubscription({
        data: {
          token: session.token,
          endpoint: raw.endpoint!,
          p256dh: raw.keys!["p256dh"]!,
          auth: raw.keys!["auth"]!,
        },
      }).catch(() => {});
    })();
  }, [alertsLoaded, notifyOn, session.token]);

  useOrderAlerts(data, soundOn, soundId, notifyOn);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["board"] });


  const run = async (key: string, fn: () => Promise<unknown>, message: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(message);
      await refresh();
    } catch (err) {
      handleStaffSessionError(err);
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const ONE_HOUR_MS = 60 * 60 * 1000;
  const isStale = (o: BoardOrder) => now - new Date(o.created_at).getTime() > ONE_HOUR_MS;
  const active = (data ?? [])
    .filter((o) => o.status !== "served" && o.status !== "cancelled" && !isStale(o))
    // Oldest order stays first; new orders queue up after it.
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  // Orders untouched for over an hour leave the active grid automatically.
  const autoArchived = (data ?? [])
    .filter((o) => o.status !== "served" && o.status !== "cancelled" && isStale(o))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const served = (data ?? []).filter((o) => o.status === "served");
  const cancelled = (data ?? []).filter((o) => o.status === "cancelled");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {active.length} active {active.length === 1 ? "order" : "orders"} · live updating
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSoundOn((s) => !s)}>
            {soundOn ? <Bell className="mr-2 size-4" /> : <BellOff className="mr-2 size-4" />}
            Sound {soundOn ? "on" : "off"}
          </Button>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={soundId}
            onChange={(e) => {
              const id = e.target.value as SoundId;
              setSoundId(id);
              playPreview(id);
            }}
          >
            {SOUND_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => playPreview(soundId)}>
            Test
          </Button>
          <Button
            variant={notifyOn ? "default" : "outline"}
            size="sm"
                      onClick={async () => {
              if (notifyOn) {
                setNotifyOn(false);
                return;
              }
              if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) {
                toast.error("Notifications are not supported on this device");
                return;
              }
              const perm =
                Notification.permission === "granted"
                  ? "granted"
                  : await Notification.requestPermission();
              if (perm !== "granted") {
                toast.error("Notification permission was blocked");
                return;
              }
              try {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                });
                const raw = subscription.toJSON();
                await savePushSubscription({
                  data: {
                    token: session.token,
                    endpoint: raw.endpoint!,
                    p256dh: raw.keys!["p256dh"]!,
                    auth: raw.keys!["auth"]!,
                  },
                });
                setNotifyOn(true);
                toast.success("Notifications on — you'll get alerts even when the app is closed");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not enable notifications");
              }
            }}
          >
            Notifications {notifyOn ? "on" : "off"}
          </Button>
        </div>
      </div>


      {isLoading && <p className="text-sm text-muted-foreground">Loading orders…</p>}
      {error && <p className="text-sm text-destructive">Could not load orders.</p>}
      {!isLoading && active.length === 0 && (
        <div className="card-surface p-10 text-center text-muted-foreground">
          No active orders right now.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {active.map((order) => {
          const style = statusStyle(order);
          const openFlag = order.red_flags.find((f) => f.status === "open");
          const remaining = etaRemaining(order, now);
          return (
            <div key={order.id} className={`rounded-2xl border-2 p-4 ${style.wrap}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-2xl">Table {order.tables?.table_number ?? "?"}</h3>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · Rs. {Number(order.total_amount).toFixed(0)} · {order.payment_status}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style.chip}`}>
                  {style.label}
                </span>
              </div>

              {openFlag && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-status-flag px-3 py-2 text-sm font-medium text-primary-foreground">
                  <AlertTriangle className="size-4" />
                  Customer is waiting since{" "}
                  {new Date(openFlag.raised_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              )}

              <ul className="mt-3 space-y-1 text-sm">
                {order.order_items.map((item) => (
                  <li key={item.id} className="flex justify-between">
                    <span>
                      {item.quantity}× {item.item_name}
                    </span>
                    <span className="text-muted-foreground">
                      Rs. {(Number(item.price_at_order) * item.quantity).toFixed(0)}
                    </span>
                  </li>
                ))}
              </ul>

              {order.note && <p className="mt-2 text-sm italic text-muted-foreground">“{order.note}”</p>}

              {order.time_request_minutes !== null && (
                <div className="mt-3 rounded-lg border border-dashed p-3 text-sm">
                  <p className="font-medium">
                    Guest can only wait {order.time_request_minutes} min — can you make it?
                  </p>
                  {order.time_response ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      You answered: {order.time_response === "accepted" ? "Yes, we can" : "Sorry, we cannot"}
                    </p>
                  ) : (
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        disabled={busy === order.id}
                        onClick={() =>
                          run(
                            order.id,
                            () =>
                              respondTimeRequest({
                                data: { token: session.token, orderId: order.id, answer: "accepted" },
                              }),
                            "Told the guest yes",
                          )
                        }
                      >
                        Yes, we can
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === order.id}
                        onClick={() =>
                          run(
                            order.id,
                            () =>
                              respondTimeRequest({
                                data: { token: session.token, orderId: order.id, answer: "declined" },
                              }),
                            "Told the guest no",
                          )
                        }
                      >
                        No, too soon
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {order.status === "preparing" && remaining !== null && (
                <p className="mt-3 flex items-center gap-2 text-sm font-semibold">
                  <Clock className="size-4" />
                  {remaining >= 0 ? `${formatSeconds(remaining)} left` : `${formatSeconds(remaining)} overdue`}
                  <span className="font-normal text-muted-foreground">(ETA {order.eta_minutes} min)</span>
                </p>
              )}

              <div className="mt-4 space-y-2">
                {isOwner && (
                  <div className="flex flex-wrap items-center gap-2">
                    {ETA_PRESETS.map((m) => (
                      <Button
                        key={m}
                        size="sm"
                        variant="secondary"
                        disabled={busy === order.id}
                        onClick={() =>
                          run(
                            order.id,
                            () =>
                              setOrderEta({
                                data: { token: session.token, orderId: order.id, minutes: m },
                              }),
                            `ETA set to ${m} min`,
                          )
                        }
                      >
                        {m}m
                      </Button>
                    ))}
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        aria-label="Decrease minutes"
                        onClick={() =>
                          setCustomEta((c) => {
                            const current = Number(c[order.id] ?? order.eta_minutes ?? 10) || 10;
                            return { ...c, [order.id]: String(Math.max(1, current - 5)) };
                          })
                        }
                      >
                        −
                      </Button>
                      <Input
                        className="h-8 w-16 text-center"
                        inputMode="numeric"
                        placeholder="min"
                        value={customEta[order.id] ?? ""}
                        onChange={(e) => setCustomEta((c) => ({ ...c, [order.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          const minutes = Number(customEta[order.id]);
                          if (!minutes) return;
                          void run(
                            order.id,
                            () =>
                              setOrderEta({ data: { token: session.token, orderId: order.id, minutes } }),
                            `ETA set to ${minutes} min`,
                          );
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        aria-label="Increase minutes"
                        onClick={() =>
                          setCustomEta((c) => {
                            const current = Number(c[order.id] ?? order.eta_minutes ?? 0) || 0;
                            return { ...c, [order.id]: String(Math.min(240, current + 5)) };
                          })
                        }
                      >
                        +
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy === order.id || !Number(customEta[order.id])}
                        onClick={() => {
                          const minutes = Number(customEta[order.id]);
                          if (!minutes) return;
                          void run(
                            order.id,
                            () =>
                              setOrderEta({ data: { token: session.token, orderId: order.id, minutes } }),
                            `ETA set to ${minutes} min`,
                          );
                        }}
                      >
                        Set
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={busy === order.id}
                    onClick={() =>
                      run(
                        order.id,
                        () => markOrderServed({ data: { token: session.token, orderId: order.id } }),
                        "Marked as served",
                      )
                    }
                  >
                    <Check className="mr-1 size-4" /> Mark served
                  </Button>
                  {openFlag && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === order.id}
                      onClick={() =>
                        run(
                          order.id,
                          () => resolveRedFlag({ data: { token: session.token, flagId: openFlag.id } }),
                          "Red flag resolved",
                        )
                      }
                    >
                      Resolve flag
                    </Button>
                  )}
                 <Button
  variant="destructive"
  size="sm"
  onClick={async () => {
    if (!confirm("Cancel this order? This can't be undone.")) return;
    try {
      await cancelOrderAsStaff({ data: { token: session.token, orderId: order.id } });
      toast.success("Order cancelled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel order");
    }
  }}
>
  Cancel order
</Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {cancelled.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg">Cancelled by guests</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cancelled.slice(0, 6).map((order) => (
              <div key={order.id} className="rounded-xl border p-3 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  Table {order.tables?.table_number ?? "?"}
                </span>{" "}
                · cancelled ·{" "}
                {order.order_items.map((i) => `${i.quantity}× ${i.item_name}`).join(", ")}
              </div>
            ))}
          </div>
        </div>
      )}

      {!hideServed && autoArchived.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg">Auto-archived (over 1 hour)</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {autoArchived.slice(0, 12).map((order) => (
              <div
                key={order.id}
                className="rounded-xl border border-muted-foreground/30 bg-muted p-3 text-sm opacity-80"
              >
                <div className="flex justify-between">
                  <span className="font-semibold">Table {order.tables?.table_number ?? "?"}</span>
                  <span>Rs. {Number(order.total_amount).toFixed(0)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {order.order_items.map((i) => `${i.quantity}× ${i.item_name}`).join(", ")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Moved here automatically after 1 hour · Payment: {order.payment_status}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

          {isOwner && !hideServed && served.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg">Served today</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {served.slice(0, 12).map((order) => (
              <div
                key={order.id}
                className="rounded-xl border border-status-served bg-status-served-soft p-3 text-sm"
              >
                <div className="flex justify-between">
                  <span className="font-semibold">Table {order.tables?.table_number ?? "?"}</span>
                  <span>Rs. {Number(order.total_amount).toFixed(0)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {order.order_items.map((i) => `${i.quantity}× ${i.item_name}`).join(", ")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Payment: {order.payment_status}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
