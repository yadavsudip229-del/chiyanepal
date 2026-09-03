import { useEffect, useState } from "react";
import { getDailyOrdersHistory } from "@/lib/orders.functions";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface OrderItem {
  item_name: string;
  quantity: number;
  price_at_order: number;
}

interface Order {
  id: string;
  time: string;
  tableNumber: string | number;
  amount: number;
  status: string;
  items: OrderItem[];
}

interface DailyData {
  date: string;
  displayDate: string;
  orderCount: number;
  totalRevenue: number;
  orders: Order[];
}

export function DailyOrdersHistory({ token }: { token: string }) {
  const [days, setDays] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const result = await getDailyOrdersHistory({ data: { token } });
      setDays(result);
    } catch (error) {
      console.error("Failed to load daily orders history:", error);
      setDays([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000); // auto-refresh every minute
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "received":
        return "bg-yellow-100 text-yellow-800";
      case "preparing":
        return "bg-blue-100 text-blue-800";
      case "served":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="mb-6 rounded-lg border p-4">
        <div className="text-sm text-muted-foreground">Loading order history...</div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h2 className="mb-4 text-xl font-semibold">Order History (10 Days)</h2>
      <Accordion type="single" collapsible className="w-full">
        {days.map((day) => (
          <AccordionItem key={day.date} value={day.date}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex w-full items-center justify-between pr-4">
                <div className="flex flex-col items-start">
                  <div className="font-medium">{day.displayDate}</div>
                  <div className="text-sm text-muted-foreground">{day.orderCount} orders</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">Rs. {day.totalRevenue.toFixed(0)}</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {day.orders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No orders for this day</p>
                ) : (
                  day.orders.map((order) => (
                    <Card key={order.id} className="p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="font-medium">Table {order.tableNumber}</div>
                          <Badge variant="outline">{order.time}</Badge>
                          <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                        </div>
                        <div className="font-semibold">Rs. {order.amount.toFixed(0)}</div>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="ml-4">
                            • {item.item_name} x{item.quantity} @ Rs. {item.price_at_order}
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
