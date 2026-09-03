import { createFileRoute, Navigate } from "@tanstack/react-router";
import { DailyOrdersHistory } from "@/components/DailyOrdersHistory";
import { StaffShell } from "@/components/StaffShell";
import { useStaffSession } from "@/lib/staff-client";

export const Route = createFileRoute("/owner/order-history")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Order History — Chiya Ghar" },
      { name: "description", content: "View order history and daily revenue reports." },
      { property: "og:title", content: "Order History — Chiya Ghar" },
      { property: "og:description", content: "Order history and daily revenue." },
    ],
  }),
  component: OrderHistoryPage,
});

function OrderHistoryPage() {
  const { session } = useStaffSession("owner");
  if (session === undefined) return null;
  if (!session) return <Navigate to="/staff" replace />;
  return (
    <StaffShell session={session} title="Order history">
      <h1 className="mb-4 text-3xl">Order History</h1>
      <DailyOrdersHistory token={session.token} />
    </StaffShell>
  );
}
