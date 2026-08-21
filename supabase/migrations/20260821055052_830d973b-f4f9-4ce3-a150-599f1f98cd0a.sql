ALTER TABLE public.shop_settings
  ADD COLUMN IF NOT EXISTS tagline text NOT NULL DEFAULT 'Table-side ordering for our tea shop. Scan, order, and follow your chiya from kitchen to table.',
  ADD COLUMN IF NOT EXISTS hero_image_url text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS time_request_minutes integer,
  ADD COLUMN IF NOT EXISTS time_request_at timestamptz,
  ADD COLUMN IF NOT EXISTS time_response text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;