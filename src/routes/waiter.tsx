import { createFileRoute, Navigate } from "@tanstack/react-router";
import { OrdersBoard } from "@/components/OrdersBoard";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/lib/staff-client";

export const Route = createFileRoute("/waiter")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Waiter Dashboard — Chiya" },
      { name: "description", content: "Live order list for waiters: mark orders served and resolve customer alerts." },
      { property: "og:title", content: "Waiter Dashboard — Chiya" },
      { property: "og:description", content: "Live order list for Chiya waiters." },
    ],
  }),
  component: WaiterDashboard,
});

function WaiterDashboard() {
  const { session } = useStaffSession("waiter");
  if (session === undefined) return null;
  if (!session) return <Navigate to="/staff" replace />;

  return (
    <StaffShell session={session} title="Waiter dashboard">
      <h1 className="mb-1 text-3xl">Live orders</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        You can mark orders served and resolve red flags. ETAs are set by the owner.
      </p>
      <OrdersBoard session={session} hideServed />
    </StaffShell>
  );
}
