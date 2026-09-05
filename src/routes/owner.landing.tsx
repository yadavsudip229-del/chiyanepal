import { useEffect, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImageUp, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StaffShell } from "@/components/StaffShell";
import { supabase } from "@/integrations/supabase/client";
import { useStaffSession } from "@/lib/staff-client";
import { saveLanding, uploadHeroImage } from "@/lib/admin.functions";
import { heroSrc } from "@/lib/shop.functions";
import fallbackHero from "@/assets/chiya-hero.jpg";

export const Route = createFileRoute("/owner/landing")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Landing Page Editor — Chiya" },
      { name: "description", content: "Change the shop name, tagline and background photo shown on your public landing page." },
      { property: "og:title", content: "Landing Page Editor — Chiya" },
      { property: "og:description", content: "Edit your shop name, tagline and hero photo." },
    ],
  }),
  component: LandingEditor,
});

function LandingEditor() {
  const { session } = useStaffSession("owner");
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<{ shop_name: string; tagline: string; hero_image_url: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const settings = useQuery({
    queryKey: ["shop-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_settings")
        .select("id, shop_name, tagline, hero_image_url")
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  useEffect(() => {
    if (settings.data && !draft)
      setDraft({
        shop_name: settings.data.shop_name,
        tagline: settings.data.tagline ?? "",
        hero_image_url: settings.data.hero_image_url ?? "",
      });
  }, [settings.data, draft]);

  if (session === undefined) return null;
  if (!session) return <Navigate to="/staff" replace />;

  const onPickFile = async (file: File) => {
    setUploading(true);
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      buffer.forEach((b) => {
        binary += String.fromCharCode(b);
      });
      const { key } = await uploadHeroImage({
        data: { token: session.token, contentType: file.type, base64: btoa(binary) },
      });
      setDraft((d) => (d ? { ...d, hero_image_url: key } : d));
      toast.success("Photo uploaded — remember to save");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!draft || !settings.data) return;
    setSaving(true);
    try {
      await saveLanding({
        data: {
          token: session.token,
          id: settings.data.id,
          shop_name: draft.shop_name,
          tagline: draft.tagline,
          hero_image_url: draft.hero_image_url,
        },
      });
      toast.success("Landing page updated");
      await queryClient.invalidateQueries({ queryKey: ["shop-settings"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <StaffShell session={session} title="Landing page">
      <h1 className="mb-4 text-3xl">Landing page</h1>
      {!draft && <p className="text-sm text-muted-foreground">Loading…</p>}
      {draft && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card-surface space-y-4 p-5">
            <div>
              <label className="text-sm font-medium" htmlFor="shop-name">
                Shop name (big title)
              </label>
              <Input
                id="shop-name"
                value={draft.shop_name}
                onChange={(e) => setDraft({ ...draft, shop_name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="tagline">
                Tagline
              </label>
              <Textarea
                id="tagline"
                rows={3}
                value={draft.tagline}
                onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="hero-url">
                Background photo
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button asChild variant="secondary" disabled={uploading}>
                  <label className="cursor-pointer">
                    <ImageUp className="mr-2 size-4" />
                    {uploading ? "Uploading…" : "Upload photo"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void onPickFile(file);
                      }}
                    />
                  </label>
                </Button>
                {draft.hero_image_url && (
                  <Button variant="outline" onClick={() => setDraft({ ...draft, hero_image_url: "" })}>
                    Use default photo
                  </Button>
                )}
              </div>
              <Input
                id="hero-url"
                className="mt-2"
                placeholder="…or paste an image link (https://…)"
                value={draft.hero_image_url}
                onChange={(e) => setDraft({ ...draft, hero_image_url: e.target.value })}
              />
            </div>
            <Button onClick={save} disabled={saving}>
              <Save className="mr-2 size-4" /> {saving ? "Saving…" : "Save landing page"}
            </Button>
          </div>

          <div className="card-surface overflow-hidden p-0">
            <p className="border-b px-4 py-2 text-sm text-muted-foreground">Live preview</p>
            <div className="relative h-72">
              <img
                src={heroSrc(draft.hero_image_url, fallbackHero)}
                alt="Landing background preview"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-foreground/50 px-6 text-center">
                <p className="font-display text-4xl text-background">{draft.shop_name || "Your shop"}</p>
                <p className="mt-2 max-w-sm text-sm text-background/90">{draft.tagline}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
