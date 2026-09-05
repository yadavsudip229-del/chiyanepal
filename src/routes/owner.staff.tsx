import { useEffect, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { StaffShell } from "@/components/StaffShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStaffSession } from "@/lib/staff-client";
import { changePin, getPinStatus, resetPin } from "@/lib/staff.functions";

export const Route = createFileRoute("/owner/staff")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Staff PINs — Chiya" },
      { name: "description", content: "Set or reset the shared owner and waiter PINs for Chiya staff sign-in." },
      { property: "og:title", content: "Staff PINs — Chiya" },
      { property: "og:description", content: "Manage owner and waiter sign-in PINs." },
    ],
  }),
  component: StaffPinsPage,
});

type RoleStatus = { accounts: number; isDefault: boolean };

function StaffPinsPage() {
  const { session } = useStaffSession("owner");
  const [status, setStatus] = useState<{ owner: RoleStatus; waiter: RoleStatus } | null>(null);

  const refresh = async (token: string) => {
    try {
      setStatus(await getPinStatus({ data: { token } }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load PIN status");
    }
  };

  useEffect(() => {
    if (session) void refresh(session.token);
  }, [session]);

  if (session === undefined) return null;
  if (!session) return <Navigate to="/staff" replace />;

  return (
    <StaffShell session={session} title="Staff PINs">
      <h1 className="mb-1 text-3xl">Staff PINs</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Each role shares one PIN, so several owners or waiters can be signed in at the same time on
        different devices. Changing a PIN applies to everyone in that role instantly. New PINs must be
        6 digits; the starter PIN is 1234.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <PinCard
          role="owner"
          label="Owner PIN"
          token={session.token}
          status={status?.owner}
          onDone={() => void refresh(session.token)}
        />
        <PinCard
          role="waiter"
          label="Waiter PIN"
          token={session.token}
          status={status?.waiter}
          onDone={() => void refresh(session.token)}
        />
      </div>
    </StaffShell>
  );
}

function PinCard({
  role,
  label,
  token,
  status,
  onDone,
}: {
  role: "owner" | "waiter";
  label: string;
  token: string;
  status?: RoleStatus | undefined;
  onDone: () => void;
}) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (pin !== confirm) {
      toast.error("The two PINs do not match");
      return;
    }
    setBusy(true);
    try {
      await changePin({ data: { token, targetRole: role, newPin: pin } });
      toast.success(`${label} updated`);
      setPin("");
      setConfirm("");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update PIN");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!window.confirm(`Reset the ${role} PIN back to 1234?`)) return;
    setBusy(true);
    try {
      await resetPin({ data: { token, targetRole: role } });
      toast.success(`${label} reset to 1234`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset PIN");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-surface p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl">{label}</h2>
        <span className="text-xs text-muted-foreground">
          {status ? `${status.accounts} account${status.accounts === 1 ? "" : "s"}` : "…"}
        </span>
      </div>
      {status?.isDefault && (
        <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Still using the starter PIN 1234 — please set a 6-digit PIN.
        </p>
      )}

      <label className="mt-4 block text-sm">New 6-digit PIN</label>
      <Input
        className="mt-1 tracking-[0.4em]"
        type="password"
        inputMode="numeric"
        maxLength={6}
        placeholder="••••••"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
      />
      <label className="mt-3 block text-sm">Confirm PIN</label>
      <Input
        className="mt-1 tracking-[0.4em]"
        type="password"
        inputMode="numeric"
        maxLength={6}
        placeholder="••••••"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
      />

      <div className="mt-4 flex gap-2">
        <Button onClick={() => void save()} disabled={busy || pin.length !== 6 || confirm.length !== 6}>
          Save PIN
        </Button>
        <Button variant="outline" onClick={() => void reset()} disabled={busy}>
          Reset to 1234
        </Button>
      </div>
    </div>
  );
}
