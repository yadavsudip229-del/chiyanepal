import { createFileRoute, Link } from "@tanstack/react-router";
import { QrCode, Timer, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/chiya-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chiya Ghar — QR Table Ordering for Our Tea Shop" },
      {
        name: "description",
        content:
          "Chiya Ghar table ordering: guests scan the QR at their table, order chiya and snacks, and watch their order status live.",
      },
      { property: "og:title", content: "Chiya Ghar — QR Table Ordering" },
      {
        property: "og:description",
        content: "Scan, order and track your chiya live. Staff dashboards for owner and waiters.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <section className="relative">
        <img
          src={heroImage}
          alt="Glasses of steaming Nepali milk chiya on a wooden tea shop counter"
          width={1600}
          height={900}
          className="h-[60vh] w-full object-cover"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-foreground/50 px-6 text-center">
          <h1 className="font-display text-5xl text-background sm:text-6xl">Chiya Ghar</h1>
          <p className="mt-3 max-w-lg text-background/90">
            Table-side ordering for our tea shop. Guests scan the QR code on their table, order, and follow
            their chiya from kitchen to table.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/staff">Staff sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 py-14 sm:grid-cols-3">
        <Feature icon={<QrCode className="size-5" />} title="Scan & order">
          Each table has a WiFi QR and a menu QR. No app, no login for guests.
        </Feature>
        <Feature icon={<Timer className="size-5" />} title="Live ETA">
          The owner sets a preparation time and guests see a live countdown.
        </Feature>
        <Feature icon={<Bell className="size-5" />} title="Never forgotten">
          A red-flag button alerts staff instantly if a table has been waiting too long.
        </Feature>
      </section>
    </div>
  );
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card-surface p-5">
      <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        {icon}
      </span>
      <h2 className="mt-3 text-xl">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
