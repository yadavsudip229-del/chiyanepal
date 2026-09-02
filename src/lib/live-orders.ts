import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BoardOrderItem = {
  id: string;
  item_name: string;
  quantity: number;
  price_at_order: number;
};

export type BoardFlag = {
  id: string;
  status: string;
  raised_at: string;
  resolved_at: string | null;
};

export type BoardOrder = {
  id: string;
  table_id: string;
  status: string;
  eta_minutes: number | null;
  eta_set_at: string | null;
  payment_method: string;
  payment_status: string;
  total_amount: number;
  note: string | null;
  time_request_minutes: number | null;
  time_request_at: string | null;
  time_response: string | null;
  cancelled_at: string | null;
  created_at: string;
  served_at: string | null;
  tables: { table_number: string } | null;
  order_items: BoardOrderItem[];
  red_flags: BoardFlag[];
};

async function fetchBoard(): Promise<BoardOrder[]> {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, table_id, status, eta_minutes, eta_set_at, payment_method, payment_status, total_amount, note, time_request_minutes, time_request_at, time_response, cancelled_at, created_at, served_at, tables(table_number), order_items(id, item_name, quantity, price_at_order), red_flags(id, status, raised_at, resolved_at)",
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as BoardOrder[];
}

export function useLiveBoard() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["board"], queryFn: fetchBoard, refetchInterval: 30000 });

  useEffect(() => {
    const channel = supabase
      .channel("chiya-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["board"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
        queryClient.invalidateQueries({ queryKey: ["board"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "red_flags" }, () => {
        queryClient.invalidateQueries({ queryKey: ["board"] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

function beep(pattern: number[]) {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    pattern.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + index * 0.22;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.22);
    });
    setTimeout(() => void ctx.close(), pattern.length * 260 + 400);
  } catch {
    /* audio unavailable */
  }
}

export const SOUND_OPTIONS = [
  { id: "chime", label: "Chime", order: [660, 990], flag: [880, 880, 880] },
  { id: "bell", label: "Bell", order: [880, 1320], flag: [1320, 1320, 1320] },
  { id: "ding", label: "Ding", order: [1200], flag: [1200, 1200, 1200] },
  { id: "soft", label: "Soft", order: [440, 550], flag: [550, 660, 550] },
] as const;

export type SoundId = (typeof SOUND_OPTIONS)[number]["id"];

export function playPreview(soundId: SoundId) {
  const preset = SOUND_OPTIONS.find((s) => s.id === soundId) ?? SOUND_OPTIONS[0];
  beep([...preset.order]);
}

function notify(title: string, body: string) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    new Notification(title, { body, icon: "/icon-192.png", badge: "/icon-192.png" });
  } catch {
    /* notifications unavailable */
  }
}

/** Plays a chime when a new order arrives and an urgent tone for new red flags. */
export function useOrderAlerts(
  orders: BoardOrder[] | undefined,
  enabled: boolean,
  soundId: SoundId = "chime",
  notifyEnabled = false,
) {
  const seenOrders = useRef<Set<string> | null>(null);
  const seenFlags = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!orders) return;
    const orderIds = new Set(orders.filter((o) => o.status === "received").map((o) => o.id));
    const flagIds = new Set(
      orders.flatMap((o) => o.red_flags.filter((f) => f.status === "open").map((f) => f.id)),
    );

    if (seenOrders.current === null) {
      seenOrders.current = orderIds;
      seenFlags.current = flagIds;
      return;
    }

    const newOrder = [...orderIds].some((id) => !seenOrders.current?.has(id));
    const newFlag = [...flagIds].some((id) => !seenFlags.current?.has(id));
    const preset = SOUND_OPTIONS.find((s) => s.id === soundId) ?? SOUND_OPTIONS[0];

    if (enabled) {
      if (newFlag) beep([...preset.flag]);
      else if (newOrder) beep([...preset.order]);
    }
    if (notifyEnabled) {
      if (newFlag) notify("Customer needs help", "A table tapped the bell.");
      else if (newOrder) notify("New order", "A new order just came in.");
    }

    seenOrders.current = orderIds;
    seenFlags.current = flagIds;
  }, [orders, enabled, soundId, notifyEnabled]);
}


export function etaRemaining(order: BoardOrder, now: number) {
  if (!order.eta_set_at || !order.eta_minutes) return null;
  const end = new Date(order.eta_set_at).getTime() + order.eta_minutes * 60000;
  return Math.round((end - now) / 1000);
}

export function formatSeconds(total: number) {
  const sign = total < 0 ? "-" : "";
  const abs = Math.abs(total);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${String(s).padStart(2, "0")}`;
}
