import { useEffect, useState } from "react";
import { getDailySummary } from "@/lib/orders.functions";
import { handleStaffSessionError } from "@/lib/staff-client";

export function DailySummary({ token }: { token: string }) {
  const [summary, setSummary] = useState<{ orderCount: number; totalRevenue: number } | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const result = await getDailySummary({ data: { token } });
      setSummary(result);
    } catch (error) {
      handleStaffSessionError(error);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000); // auto-refresh every minute
    return () => clearInterval(interval);
  }, [token]);

  return (
    <div className="mb-6 flex gap-6 rounded-lg border p-4">
      <div>
        <div className="text-sm text-muted-foreground">Today's orders</div>
        <div className="text-2xl font-semibold">{loading ? "…" : summary?.orderCount ?? 0}</div>
      </div>
      <div>
        <div className="text-sm text-muted-foreground">Today's revenue</div>
        <div className="text-2xl font-semibold">
          {loading ? "…" : `Rs. ${(summary?.totalRevenue ?? 0).toFixed(0)}`}
        </div>
      </div>
    </div>
  );
}
