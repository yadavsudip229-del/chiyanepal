
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.shop_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_name text NOT NULL DEFAULT 'Chiya Ghar',
  wifi_ssid text NOT NULL DEFAULT 'ChiyaGhar',
  wifi_password text NOT NULL DEFAULT 'chiya123',
  wifi_encryption text NOT NULL DEFAULT 'WPA',
  currency text NOT NULL DEFAULT 'Rs.',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE public.staff_role AS ENUM ('owner','waiter');

CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role public.staff_role NOT NULL,
  pin_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number text NOT NULL UNIQUE,
  qr_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(9),'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  photo_url text,
  is_available boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'received',
  eta_minutes int,
  eta_set_at timestamptz,
  payment_method text NOT NULL DEFAULT 'counter',
  payment_status text NOT NULL DEFAULT 'pending',
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  served_at timestamptz
);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  price_at_order numeric(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE public.red_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open',
  raised_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

GRANT SELECT ON public.shop_settings TO anon, authenticated;
GRANT SELECT ON public.tables TO anon, authenticated;
GRANT SELECT ON public.menu_categories TO anon, authenticated;
GRANT SELECT ON public.menu_items TO anon, authenticated;
GRANT SELECT ON public.orders TO anon, authenticated;
GRANT SELECT ON public.order_items TO anon, authenticated;
GRANT SELECT ON public.red_flags TO anon, authenticated;
GRANT ALL ON public.shop_settings TO service_role;
GRANT ALL ON public.staff TO service_role;
GRANT ALL ON public.tables TO service_role;
GRANT ALL ON public.menu_categories TO service_role;
GRANT ALL ON public.menu_items TO service_role;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.order_items TO service_role;
GRANT ALL ON public.red_flags TO service_role;

ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.red_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read shop settings" ON public.shop_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read tables" ON public.tables FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read categories" ON public.menu_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read items" ON public.menu_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read orders" ON public.orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read order items" ON public.order_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read red flags" ON public.red_flags FOR SELECT TO anon, authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.red_flags;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.red_flags REPLICA IDENTITY FULL;

INSERT INTO public.shop_settings (shop_name, wifi_ssid, wifi_password) VALUES ('Chiya Ghar', 'ChiyaGhar_WiFi', 'chiya1234');

INSERT INTO public.staff (name, role, pin_hash) VALUES
  ('Owner', 'owner', encode(digest('1234','sha256'),'hex')),
  ('Waiter', 'waiter', encode(digest('5678','sha256'),'hex'));

INSERT INTO public.tables (table_number) VALUES ('1'),('2'),('3'),('4'),('5'),('6');

INSERT INTO public.menu_categories (id, name, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111111','Chiya & Tea', 1),
  ('22222222-2222-2222-2222-222222222222','Coffee', 2),
  ('33333333-3333-3333-3333-333333333333','Snacks', 3);

INSERT INTO public.menu_items (category_id, name, description, price, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111111','Milk Chiya','Classic Nepali milk tea with cardamom', 40, 1),
  ('11111111-1111-1111-1111-111111111111','Black Tea','Strong kalo chiya with lemon', 30, 2),
  ('11111111-1111-1111-1111-111111111111','Masala Chiya','Spiced tea with ginger and cloves', 60, 3),
  ('22222222-2222-2222-2222-222222222222','Hot Coffee','Freshly brewed hot coffee', 90, 1),
  ('22222222-2222-2222-2222-222222222222','Cold Coffee','Iced coffee with cream', 150, 2),
  ('33333333-3333-3333-3333-333333333333','Veg Momo','Steamed dumplings with achar', 130, 1),
  ('33333333-3333-3333-3333-333333333333','Samosa','Crispy potato samosa (2 pcs)', 70, 2),
  ('33333333-3333-3333-3333-333333333333','Sel Roti','Traditional rice doughnut', 50, 3);
