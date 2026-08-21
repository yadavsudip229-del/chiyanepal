import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type PublicShopSettings = {
  shop_name: string;
  tagline: string;
  hero_image_url: string | null;
  updated_at: string;
};

export const getPublicShopSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicShopSettings | null> => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabasePublic = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data } = await supabasePublic
      .from("shop_settings")
      .select("shop_name, tagline, hero_image_url, updated_at")
      .limit(1)
      .maybeSingle();
    return (data as PublicShopSettings | null) ?? null;
  },
);

export function heroSrc(url: string | null | undefined, fallback: string) {
  if (!url) return fallback;
  if (/^https?:\/\//i.test(url)) return url;
  return `/api/public/hero-image?k=${encodeURIComponent(url)}`;
}
