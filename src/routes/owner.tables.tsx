import { useEffect, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Plus, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StaffShell } from "@/components/StaffShell";
import { supabase } from "@/integrations/supabase/client";
import { useStaffSession } from "@/lib/staff-client";
import { addTable, deleteTable, saveShopSettings } from "@/lib/admin.functions";

export const Route = createFileRoute("/owner/tables")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Tables & QR Codes — Chiya" },
      { name: "description", content: "Create tables and print WiFi and menu QR codes for each Chiya table." },
      { property: "og:title", content: "Tables & QR Codes — Chiya" },
      { property: "og:description", content: "Print WiFi and menu QR codes for each table." },
    ],
  }),
  component: TablesPage,
});

function wifiPayload(ssid: string, password: string, encryption: string) {
  const esc = (v: string) => v.replace(/([\\;,:"])/g, "\\$1");
  return `WIFI:T:${encryption};S:${esc(ssid)};P:${esc(password)};;`;
}

function QrTile({ value, caption }: { value: string; caption: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    void QRCode.toDataURL(value, { width: 320, margin: 1 }).then(setSrc);
  }, [value]);
  return (
    <div className="text-center">
      {src && <img src={src} alt={caption} width={160} height={160} className="mx-auto size-40 rounded-lg border bg-white p-1" />}
      <p className="mt-1 text-xs font-medium">{caption}</p>
    </div>
  );
}

function TablesPage() {
  const { session } = useStaffSession("owner");
  const queryClient = useQueryClient();
  const [newTable, setNewTable] = useState("");
  type SettingsDraft = { shop_name: string; wifi_ssid: string; wifi_password: string; wifi_encryption: string };
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const data = useQuery({
    queryKey: ["tables-admin"],
    queryFn: async () => {
      const [tables, settings] = await Promise.all([
        supabase.from("tables").select("*").order("table_number"),
        supabase.from("shop_settings").select("*").limit(1).maybeSingle(),
      ]);
      if (tables.error) throw new Error(tables.error.message);
      if (settings.error) throw new Error(settings.error.message);
      return { tables: tables.data ?? [], settings: settings.data };
    },
  });

  if (session === undefined) return null;
  if (!session) return <Navigate to="/staff" replace />;

  const settings = data.data?.settings;
  const draft: SettingsDraft = settingsDraft ?? {
    shop_name: settings?.shop_name ?? "",
    wifi_ssid: settings?.wifi_ssid ?? "",
    wifi_password: settings?.wifi_password ?? "",
    wifi_encryption: settings?.wifi_encryption ?? "WPA",
  };

  const guard = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      toast.success(message);
      await queryClient.invalidateQueries({ queryKey: ["tables-admin"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <StaffShell session={session} title="Tables & QR codes">
      <div className="print:hidden">
        <h1 className="mb-4 text-3xl">Tables & QR codes</h1>

        <section className="card-surface mb-6 p-4">
          <h2 className="text-xl">Shop & WiFi</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Shop name"
              value={draft.shop_name}
              onChange={(e) => setSettingsDraft({ ...draft, shop_name: e.target.value })}
            />
            <Input
              placeholder="WiFi network (SSID)"
              value={draft.wifi_ssid}
              onChange={(e) => setSettingsDraft({ ...draft, wifi_ssid: e.target.value })}
            />
            <Input
              placeholder="WiFi password"
              value={draft.wifi_password}
              onChange={(e) => setSettingsDraft({ ...draft, wifi_password: e.target.value })}
            />
            <Input
              placeholder="Encryption (WPA / WEP / nopass)"
              value={draft.wifi_encryption}
              onChange={(e) => setSettingsDraft({ ...draft, wifi_encryption: e.target.value })}
            />
          </div>
          <Button
            className="mt-3"
            disabled={!settings}
            onClick={() =>
              guard(
                () =>
                  saveShopSettings({
                    data: {
                      token: session.token,
                      id: settings!.id,
                      shop_name: draft.shop_name,
                      wifi_ssid: draft.wifi_ssid,
                      wifi_password: draft.wifi_password,
                      wifi_encryption: draft.wifi_encryption,
                    },
                  }),
                "Settings saved",
              )
            }
          >
            Save settings
          </Button>
        </section>

        <section className="card-surface mb-6 flex flex-wrap items-end gap-3 p-4">
          <div className="flex-1">
            <label className="text-sm font-medium" htmlFor="new-table">
              New table number
            </label>
            <Input
              id="new-table"
              className="mt-1"
              placeholder="e.g. 7"
              value={newTable}
              onChange={(e) => setNewTable(e.target.value)}
            />
          </div>
          <Button
            disabled={!newTable.trim()}
            onClick={() =>
              guard(async () => {
                await addTable({ data: { token: session.token, table_number: newTable } });
                setNewTable("");
              }, "Table added")
            }
          >
            <Plus className="mr-1 size-4" /> Add table
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-1 size-4" /> Print all QR cards
          </Button>
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.data?.tables.map((table) => (
          <div key={table.id} className="card-surface break-inside-avoid p-4 text-center">
            <div className="flex items-center justify-between print:justify-center">
              <h2 className="text-2xl">Table {table.table_number}</h2>
              <Button
                size="sm"
                variant="ghost"
                className="print:hidden"
                onClick={() => {
                  if (window.confirm(`Delete table ${table.table_number}?`))
                    void guard(() => deleteTable({ data: { token: session.token, id: table.id } }), "Table deleted");
                }}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{draft.shop_name}</p>
            <div className="mt-3 flex justify-center gap-4">
              <QrTile
                value={wifiPayload(draft.wifi_ssid, draft.wifi_password, draft.wifi_encryption)}
                caption="Scan for WiFi"
              />
              <QrTile value={`${origin}/order/${table.qr_token}`} caption="Scan to order" />
            </div>
            <p className="mt-2 break-all text-[10px] text-muted-foreground print:hidden">
              {origin}/order/{table.qr_token}
            </p>
          </div>
        ))}
      </div>
    </StaffShell>
  );
}
