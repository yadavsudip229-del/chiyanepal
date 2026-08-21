import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearStaffSession, type StaffSession } from "@/lib/staff-client";

export function StaffShell({
  session,
  title,
  children,
}: {
  session: StaffSession;
  title: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const isOwner = session.role === "owner";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <div className="mr-auto">
            <p className="font-display text-xl leading-tight">Chiya Ghar</p>
            <p className="text-xs text-muted-foreground">
              {title} · signed in as {session.name}
            </p>
          </div>
          {isOwner && (
            <nav className="flex gap-1 text-sm">
              <Link to="/owner" className="rounded-md px-3 py-1.5 hover:bg-secondary" activeOptions={{ exact: true }} activeProps={{ className: "bg-secondary font-semibold" }}>
                Orders
              </Link>
              <Link to="/owner/menu" className="rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-secondary font-semibold" }}>
                Menu
              </Link>
              <Link to="/owner/landing" className="rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-secondary font-semibold" }}>
                Landing
              </Link>
              <Link to="/owner/tables" className="rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-secondary font-semibold" }}>
                Tables & QR
              </Link>
            </nav>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearStaffSession();
              void navigate({ to: "/staff", replace: true });
            }}
          >
            <LogOut className="mr-2 size-4" /> Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
