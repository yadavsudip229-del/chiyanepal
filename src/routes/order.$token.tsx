import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Check, ChefHat, Clock, Minus, Pencil, Plus, Receipt, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  placeOrder,
  raiseRedFlag,
  updateOrderItems,
  cancelOrder,
  requestTimeLimit,
} from "@/lib/orders.functions";
import { formatSeconds } from "@/lib/live-orders";
import { getPublicShopSettings, heroSrc } from "@/lib/shop.functions";
import heroImage from "@/assets/chiya-hero.jpg";

export const Route = createFileRoute("/order/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Order at your table — Chiya Ghar" },
      {
        name: "description",
        content: "Scan, browse the Chiya Ghar menu and order chiya, coffee and snacks straight from your table.",
      },
      { property: "og:title", content: "Order at your table — Chiya Ghar" },
      { property: "og:description", content: "Order chiya, coffee and snacks from your table at Chiya Ghar." },
    ],
  }),
  component: CustomerOrderPage,
});

type ActiveOrder = {
  id: string;
  status: string;
  eta_minutes: number | null;
  eta_set_at: string | null;
  total_amount: number;
  created_at: string;
  payment_status: string;
  note: string | null;
  time_request_minutes: number | null;
  time_response: string | null;
  order_items: { id: string; item_name: string; menu_item_id: string | null; quantity: number; price_at_order: number }[];
  red_flags: { id: string; status: string }[];
};

function CustomerOrderPage() {
  const { token } = Route.useParams();
  const queryClient = useQueryClient();
  const storageKey = `chiya_active_order_${token}`;
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [now, setNow] = useState(() => Date.now());


  useEffect(() => {
    setOrderId(window.localStorage.getItem(storageKey));
  }, [storageKey]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const shopQuery = useQuery({
    queryKey: ["public-shop-settings"],
    queryFn: () => getPublicShopSettings(),
  });

  const tableQuery = useQuery({
    queryKey: ["table", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tables")
        .select("id, table_number")
        .eq("qr_token", token)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const menuQuery = useQuery({
    queryKey: ["menu"],
    queryFn: async () => {
      const [cats, items] = await Promise.all([
        supabase.from("menu_categories").select("id, name, sort_order").order("sort_order"),
        supabase
          .from("menu_items")
          .select("id, category_id, name, description, price, photo_url, is_available")
          .order("sort_order"),
      ]);
      if (cats.error) throw new Error(cats.error.message);
      if (items.error) throw new Error(items.error.message);
      return { categories: cats.data ?? [], items: items.data ?? [] };
    },
  });

  const [tab, setTab] = useState<"menu" | "order">("menu");


  const orderQuery = useQuery({
    queryKey: ["active-order", orderId],
    enabled: !!orderId,
    queryFn: async (): Promise<ActiveOrder | null> => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, status, eta_minutes, eta_set_at, total_amount, created_at, payment_status, note, time_request_minutes, time_response, order_items(id, item_name, menu_item_id, quantity, price_at_order), red_flags(id, status)",
        )
        .eq("id", orderId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as unknown as ActiveOrder | null;
    },
  });

  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        () => queryClient.invalidateQueries({ queryKey: ["active-order", orderId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "red_flags", filter: `order_id=eq.${orderId}` },
        () => queryClient.invalidateQueries({ queryKey: ["active-order", orderId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orderId, queryClient]);

  const items = menuQuery.data?.items ?? [];
  const cartLines = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => ({ item: items.find((i) => i.id === id), quantity: qty }))
        .filter((line) => !!line.item),
    [cart, items],
  );
  const cartTotal = cartLines.reduce((sum, l) => sum + Number(l.item!.price) * l.quantity, 0);

  const setQty = (id: string, delta: number) =>
    setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + delta) }));

  const submit = async () => {
    setSubmitting(true);
    try {
      const result = await placeOrder({
        data: {
          tableToken: token,
          items: cartLines.map((l) => ({ menu_item_id: l.item!.id, quantity: l.quantity })),
          note: note || undefined,
        },
      });
      window.localStorage.setItem(storageKey, result.orderId);
      setOrderId(result.orderId);
      setCart({});
      setNote("");
      toast.success("Order sent to the kitchen");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not place the order");
    } finally {
      setSubmitting(false);
    }
  };

  const startEditing = (o: ActiveOrder) => {
    const next: Record<string, number> = {};
    for (const line of o.order_items) if (line.menu_item_id) next[line.menu_item_id] = line.quantity;
    setCart(next);
    setNote(o.note ?? "");
    setEditing(true);
    window.scrollTo({ top: 0 });
  };

  const saveEdits = async (id: string) => {
    setSubmitting(true);
    try {
      await updateOrderItems({
        data: {
          orderId: id,
          tableToken: token,
          items: cartLines.map((l) => ({ menu_item_id: l.item!.id, quantity: l.quantity })),
          note: note || undefined,
        },
      });
      setEditing(false);
      setCart({});
      setNote("");
      toast.success("Your order was updated");
      void queryClient.invalidateQueries({ queryKey: ["active-order", id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the order");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelMyOrder = async (id: string) => {
    if (!window.confirm("Cancel this order?")) return;
    try {
      await cancelOrder({ data: { orderId: id, tableToken: token } });
      toast.success("Your order was cancelled");
      void queryClient.invalidateQueries({ queryKey: ["active-order", id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel the order");
    }
  };

  const sendTimeRequest = async (id: string, minutes: number) => {
    try {
      await requestTimeLimit({ data: { orderId: id, tableToken: token, minutes } });
      toast.success(`Asked the kitchen if ${minutes} min works`);
      void queryClient.invalidateQueries({ queryKey: ["active-order", id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the request");
    }
  };

  if (tableQuery.isLoading) {
    return <p className="p-8 text-center text-muted-foreground">Loading…</p>;
  }

  if (!tableQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-2xl">This QR code isn't valid</h1>
          <p className="mt-2 text-muted-foreground">Please ask our staff for the correct table code.</p>
        </div>
      </div>
    );
  }

  const order = orderQuery.data;
  const orderActive = order && order.status !== "served" && order.status !== "cancelled";
  const openFlag = order?.red_flags?.some((f) => f.status === "open");
  const remaining =
    order?.eta_set_at && order.eta_minutes
      ? Math.round((new Date(order.eta_set_at).getTime() + order.eta_minutes * 60000 - now) / 1000)
      : null;
  const hasTabs = !!order && !editing;
  const showOrder = hasTabs && tab === "order";
  const showMenu = !hasTabs || tab === "menu";

  return (
    <div className="min-h-screen bg-background pb-40">
      <div className="relative h-40 overflow-hidden">
        <img
          src={heroSrc(shopQuery.data?.hero_image_url, heroImage)}
          alt="Steaming glasses of Nepali milk chiya on a wooden counter"
          width={1600}
          height={900}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 flex flex-col justify-end bg-foreground/45 p-4">
          <h1 className="font-display text-3xl text-background">{shopQuery.data?.shop_name ?? "Chiya Ghar"}</h1>
          <p className="text-sm text-background/85">Table {tableQuery.data.table_number}</p>
        </div>
      </div>

      {hasTabs && (
        <div className="mx-auto mt-4 flex max-w-2xl gap-2 px-4">
          <Button
            className="flex-1"
            variant={tab === "menu" ? "default" : "outline"}
            onClick={() => setTab("menu")}
          >
            Menu
          </Button>
          <Button
            className="flex-1"
            variant={tab === "order" ? "default" : "outline"}
            onClick={() => setTab("order")}
          >
            My order
          </Button>
        </div>
      )}

      {showOrder && (

        <section className="mx-auto max-w-2xl px-4 pt-4">
          <div className="card-surface p-5">
            <h2 className="text-xl">Your order</h2>
            <ol className="mt-4 space-y-3">
              <StatusStep
                active={true}
                done={order.status !== "received"}
                icon={<Receipt className="size-4" />}
                title="Order Received"
                detail={new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              />
              <StatusStep
                active={order.status === "preparing"}
                done={order.status === "served"}
                icon={<ChefHat className="size-4" />}
                title="Preparing"
                detail={
                  order.status === "cancelled"
                    ? "Cancelled"
                    : order.status === "preparing" && remaining !== null
                      ? remaining >= 0
                        ? `ETA ${order.eta_minutes} min · ${formatSeconds(remaining)} left`
                        : `Taking a little longer (${formatSeconds(remaining)})`
                      : order.status === "received"
                        ? "Waiting for the kitchen to confirm an ETA"
                        : "Done"
                }
              />
              <StatusStep
                active={order.status === "served"}
                done={order.status === "served"}
                icon={<Check className="size-4" />}
                title="Served"
                detail={
                  order.status === "cancelled"
                    ? "Order cancelled"
                    : order.status === "served"
                      ? "Enjoy your chiya!"
                      : "Coming to your table"
                }
              />
            </ol>

            <ul className="mt-4 border-t pt-3 text-sm">
              {order.order_items.map((i) => (
                <li key={i.id} className="flex justify-between">
                  <span>
                    {i.quantity}× {i.item_name}
                  </span>
                  <span>Rs. {(Number(i.price_at_order) * i.quantity).toFixed(0)}</span>
                </li>
              ))}
              <li className="mt-2 flex justify-between border-t pt-2 font-semibold">
                <span>Total ({order.payment_status === "paid" ? "paid" : "pay at counter"})</span>
                <span>Rs. {Number(order.total_amount).toFixed(0)}</span>
              </li>
            </ul>

            {order.status === "cancelled" && (
              <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                This order was cancelled.
              </p>
            )}

            {orderActive && (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => startEditing(order)}>
                    <Pencil className="mr-2 size-4" />
                    Edit my order
                  </Button>
                  <Button variant="outline" onClick={() => void cancelMyOrder(order.id)}>
                    <X className="mr-2 size-4" />
                    Cancel order
                  </Button>
                </div>

                <div className="rounded-lg border p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Clock className="size-4" />
                    In a hurry? Tell us how long you can wait
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[5, 10, 15, 20].map((m) => (
                      <Button
                        key={m}
                        size="sm"
                        variant={order.time_request_minutes === m ? "default" : "outline"}
                        onClick={() => void sendTimeRequest(order.id, m)}
                      >
                        {m} min
                      </Button>
                    ))}
                  </div>
                  {order.time_request_minutes && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {order.time_response === "accepted"
                        ? `Yes — we can serve you within ${order.time_request_minutes} min.`
                        : order.time_response === "declined"
                          ? `Sorry, ${order.time_request_minutes} min isn't possible right now.`
                          : `Asked for ${order.time_request_minutes} min — waiting for a reply.`}
                    </p>
                  )}
                </div>
              </div>
            )}

            {orderActive && (
              <Button
                variant="destructive"
                size="lg"
                className="mt-5 w-full"
                disabled={openFlag}
                onClick={async () => {
                  try {
                    await raiseRedFlag({ data: { orderId: order.id, tableToken: token } });
                    toast.success("Staff have been alerted");
                    void queryClient.invalidateQueries({ queryKey: ["active-order", order.id] });
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not alert staff");
                  }
                }}
              >
                <AlertTriangle className="mr-2 size-5" />
                {openFlag ? "Staff alerted — someone is coming" : "Feeling forgotten? Tap here"}
              </Button>
            )}

            {!orderActive && (
              <Button
                variant="outline"
                className="mt-5 w-full"
                onClick={() => {
                  window.localStorage.removeItem(storageKey);
                  setOrderId(null);
                }}
              >
                Order something else
              </Button>
            )}
          </div>
        </section>
      )}

      {showMenu && (
        <section className="mx-auto max-w-2xl px-4 py-4">
          {editing && (
            <div className="card-surface mb-4 flex items-center justify-between p-3">
              <p className="text-sm font-semibold">Editing your order</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setCart({});
                  setNote("");
                }}
              >
                Discard changes
              </Button>
            </div>
          )}
          {menuQuery.data?.categories.map((cat) => {
            const catItems = items.filter((i) => i.category_id === cat.id);
            if (catItems.length === 0) return null;
            return (
              <div key={cat.id} className="mb-6">
                <h2 className="mb-3 text-2xl">{cat.name}</h2>
                <div className="space-y-3">
                  {catItems.map((item) => (
                    <div
                      key={item.id}
                      className={`card-surface flex items-center gap-3 p-3 ${item.is_available ? "" : "opacity-50"}`}
                    >
                      {item.photo_url && (
                        <img
                          src={item.photo_url}
                          alt={item.name}
                          loading="lazy"
                          className="size-16 rounded-lg object-cover"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{item.name}</p>
                        {item.description && (
                          <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                        )}
                        <p className="mt-1 text-sm font-medium">Rs. {Number(item.price).toFixed(0)}</p>
                      </div>
                      {item.is_available ? (
                        <div className="flex items-center gap-2">
                          {(cart[item.id] ?? 0) > 0 && (
                            <>
                              <Button size="icon" variant="outline" onClick={() => setQty(item.id, -1)}>
                                <Minus className="size-4" />
                              </Button>
                              <span className="w-5 text-center font-semibold">{cart[item.id]}</span>
                            </>
                          )}
                          <Button size="icon" onClick={() => setQty(item.id, 1)}>
                            <Plus className="size-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sold out</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {cartLines.length > 0 && (
            <Textarea
              placeholder="Any note for the kitchen? (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-2"
            />
          )}
        </section>
      )}

      {(!order || editing) && cartLines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t bg-card p-4 shadow-lg">
          <div className="mx-auto flex max-w-2xl items-center gap-4">
            <div className="text-sm">
              <p className="font-semibold">
                {cartLines.reduce((n, l) => n + l.quantity, 0)} items · Rs. {cartTotal.toFixed(0)}
              </p>
              <p className="text-xs text-muted-foreground">Pay at counter (cash or card)</p>
            </div>
            <Button
              size="lg"
              className="ml-auto"
              disabled={submitting}
              onClick={() => (editing && order ? void saveEdits(order.id) : void submit())}
            >
              {submitting ? "Sending…" : editing ? "Save changes" : "Place order"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusStep({
  active,
  done,
  icon,
  title,
  detail,
}: {
  active: boolean;
  done: boolean;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  const state = done ? "done" : active ? "active" : "idle";
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
          state === "done"
            ? "bg-status-served text-primary-foreground"
            : state === "active"
              ? "bg-status-prep text-primary-foreground"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {icon}
      </span>
      <div>
        <p className={`font-semibold ${state === "idle" ? "text-muted-foreground" : ""}`}>{title}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </li>
  );
}
