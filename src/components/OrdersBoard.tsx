import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Bell, BellOff, Clock, Check, BanknoteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type BoardOrder,
  etaRemaining,
  formatSeconds,
  useLiveBoard,
  useOrderAlerts,
} from "@/lib/live-orders";
import { markOrderServed, markPaid, resolveRedFlag, setOrderEta } from "@/lib/orders.functions";
import type { StaffSession } from "@/lib/staff-client";

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

export function OrdersBoard({ session }: { session: StaffSession }) {
  const isOwner = session.role === "owner";
  const { data, isLoading, error } = useLiveBoard();
  const queryClient = useQueryClient();
  const [soundOn, setSoundOn] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [customEta, setCustomEta] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useOrderAlerts(data, soundOn);

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
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const active = (data ?? []).filter((o) => o.status !== "served");
  const served = (data ?? []).filter((o) => o.status === "served");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {active.length} active {active.length === 1 ? "order" : "orders"} · live updating
        </p>
        <Button variant="outline" size="sm" onClick={() => setSoundOn((s) => !s)}>
          {soundOn ? <Bell className="mr-2 size-4" /> : <BellOff className="mr-2 size-4" />}
          Sound {soundOn ? "on" : "off"}
        </Button>
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
                    <Input
                      className="h-8 w-20"
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
                  {order.payment_status !== "paid" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === order.id}
                      onClick={() =>
                        run(
                          order.id,
                          () =>
                            markPaid({
                              data: { token: session.token, orderId: order.id, method: "cash" },
                            }),
                          "Payment recorded",
                        )
                      }
                    >
                      <BanknoteIcon className="mr-1 size-4" /> Paid at counter
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {served.length > 0 && (
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
