import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { staffLogin } from "@/lib/staff.functions";
import { getStaffSession, setStaffSession } from "@/lib/staff-client";

export const Route = createFileRoute("/staff")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Staff Sign In — Chiya" },
      { name: "description", content: "Owner and waiter PIN sign-in for the Chiya table ordering system." },
      { property: "og:title", content: "Staff Sign In — Chiya" },
      { property: "og:description", content: "Owner and waiter PIN sign-in for Chiya." },
    ],
  }),
  component: StaffLoginPage,
});

function StaffLoginPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  // Already signed in on this device (e.g. reopened from the home-screen app)?
  // Skip the PIN screen and go straight to the right dashboard. The session is
  // only cleared when the user taps "Sign out" manually.
  useEffect(() => {
    const existing = getStaffSession();
    if (existing) {
      void navigate({ to: existing.role === "owner" ? "/owner" : "/waiter", replace: true });
    }
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const session = await staffLogin({ data: { pin } });
      setStaffSession({ token: session.token, role: session.role, name: session.name });
      toast.success(`Welcome, ${session.name}`);
      if (session.mustChangePin) {
        toast.warning("You're still on the starter PIN 1234 — set a 6-digit PIN.");
        if (session.role === "owner") {
          void navigate({ to: "/owner/staff", replace: true });
          return;
        }
      }
      void navigate({ to: session.role === "owner" ? "/owner" : "/waiter", replace: true });

    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="card-surface w-full max-w-sm p-8">
        <h1 className="text-3xl">Chiya</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter your staff PIN to continue.</p>
        <Input
          className="mt-6 h-14 text-center text-2xl tracking-[0.5em]"
          type="password"
          inputMode="numeric"
          autoFocus
          maxLength={8}
          placeholder="••••"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
        <Button type="submit" className="mt-4 w-full" size="lg" disabled={loading || pin.length < 4}>
          {loading ? "Checking…" : "Sign in"}
        </Button>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Owner and waiter each have their own PIN.
        </p>
      </form>
    </div>
  );
}
