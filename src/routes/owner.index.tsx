import { createFileRoute, Navigate } from "@tanstack/react-router";
import { OrdersBoard } from "@/components/OrdersBoard";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/lib/staff-client";

export const Route = createFileRoute("/owner/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Owner Dashboard — Chiya Ghar" },
      { name: "description", content: "Live table order board with ETA controls and red-flag alerts." },
      { property: "og:title", content: "Owner Dashboard — Chiya Ghar" },
      { property: "og:description", content: "Live table order board for Chiya Ghar." },
    ],
  }),
  component: OwnerDashboard,
});

function OwnerDashboard() {
  const { session } = useStaffSession("owner");
  if (session === undefined) return null;
  if (!session) return <Navigate to="/staff" replace />;

  return (
    <StaffShell session={session} title="Owner dashboard">
      <h1 className="mb-4 text-3xl">Live orders</h1>
      <OrdersBoard session={session} />
    </StaffShell>
  );
}
