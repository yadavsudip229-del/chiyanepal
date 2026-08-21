import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hero-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = new URL(request.url).searchParams.get("k");
        if (!key || key.includes("..")) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("branding").download(key);
        if (error || !data) return new Response("Not found", { status: 404 });
        return new Response(await data.arrayBuffer(), {
          headers: {
            "Content-Type": data.type || "image/jpeg",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
