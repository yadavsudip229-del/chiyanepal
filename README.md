# Chiya Ghar Order

Build a QR-code table ordering web app for my tea shop (Nepal) called "Chiya Ghar".

Three views:

1. CUSTOMER (no login) — opens via a link like /order/{table_token}.

   Shows the menu (categories + items with price and photo), lets them

   add items to a cart, and submit an order for that table. After

   submitting, show a live status screen: "Order Received" → "Preparing

   (ETA: X min)" → "Served" — this should update live without refreshing

   (use Supabase Realtime). Always show a red "Feeling forgotten? Tap

   here" button while the order is active — tapping it creates a

   red-flag alert for staff.

2. OWNER DASHBOARD — simple keypass login (not full email auth). Shows

   a live grid of all tables/orders, color-coded by status (new order =

   blue + sound alert, preparing = yellow with ETA countdown, served =

   green, red-flagged = red + urgent alert). Owner can tap a new order,

   see the items, and set an ETA (quick buttons: 5/10/15/20/30 min or

   custom). Separate "Menu Manager" page to add/edit/delete categories

   and items (name, price, photo, available toggle). Separate page to

   add tables and generate/print two QR codes per table: one WiFi QR

   (WIFI:T:WPA;S:ssid;P:password;; format) and one Menu QR (link to

   /order/{table_token}).

3. WAITER DASHBOARD — own simple PIN login. Sees the same live

   orders/ETA/red-flags as the owner but read-only except: can mark an

   order "Served" and mark a red flag "Resolved." No access to menu

   editing.

Use Supabase for the database and Realtime updates. Database needs:

shop_settings, staff (role: owner/waiter, pin_hash), tables

(table_number, qr_token), menu_categories, menu_items, orders (status,

eta_minutes, payment_method, payment_status, total_amount), order_items

(quantity, price_at_order), red_flags (status, raised_at, resolved_at).

Payment: for now, only "Pay at Counter" (cash/card) — mark

payment_status as pending. I'll add Khalti/eSewa online payment later.

Language: English only.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://chiyanepal.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f33207c4-f46e-4bcf-8f65-500e3578f20e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
