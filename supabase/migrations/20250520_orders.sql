-- Migration: Order domain
-- Run order: 1→2→3→4→5→6 (dependencies below)
-- Safe to run multiple times: all statements use IF NOT EXISTS / IF EXISTS

-- ============================================================
-- 1. orders tablosu
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id              UUID NOT NULL REFERENCES rfqs(id) ON DELETE RESTRICT,
  rfq_recipient_id    UUID NOT NULL REFERENCES rfq_recipients(id) ON DELETE RESTRICT,
  quote_id            UUID NOT NULL REFERENCES quotes(id) ON DELETE RESTRICT,
  buyer_id            UUID NOT NULL REFERENCES buyers(id) ON DELETE RESTRICT,
  status              TEXT NOT NULL DEFAULT 'pending_confirmation',
  buyer_note          TEXT,
  confirmation_note   TEXT,
  confirmed_amount    NUMERIC(12, 2),
  expected_delivery   DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ
);

-- Her rfq_recipient için en fazla 1 aktif sipariş
CREATE UNIQUE INDEX IF NOT EXISTS orders_recipient_unique
  ON orders(rfq_recipient_id)
  WHERE status != 'cancelled';

CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_rfq_id   ON orders(rfq_id);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(status);

-- ============================================================
-- 2. order_items tablosu
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rfq_item_id           UUID NOT NULL REFERENCES rfq_items(id) ON DELETE RESTRICT,
  quote_item_id         UUID REFERENCES quote_items(id) ON DELETE SET NULL,
  confirmed_unit_price  NUMERIC(12, 2),
  confirmed_quantity    NUMERIC(10, 3),
  confirmed_brand       TEXT,
  note                  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order  ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_rfq_it ON order_items(rfq_item_id);

-- ============================================================
-- 3. rfq_recipients: awarded_at ekle
-- ============================================================
ALTER TABLE rfq_recipients
  ADD COLUMN IF NOT EXISTS awarded_at TIMESTAMPTZ;

-- ============================================================
-- 4. rfq_recipients: order_id ekle (orders tablosu artık var)
-- ============================================================
ALTER TABLE rfq_recipients
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

-- ============================================================
-- 5. rfqs: awarded_recipient_id ekle
-- ============================================================
ALTER TABLE rfqs
  ADD COLUMN IF NOT EXISTS awarded_recipient_id UUID REFERENCES rfq_recipients(id) ON DELETE SET NULL;

-- ============================================================
-- 6. RLS politikaları
-- ============================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_buyer_select'
  ) THEN
    CREATE POLICY "orders_buyer_select" ON orders
      FOR SELECT USING (buyer_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_buyer_insert'
  ) THEN
    CREATE POLICY "orders_buyer_insert" ON orders
      FOR INSERT WITH CHECK (buyer_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_buyer_update'
  ) THEN
    CREATE POLICY "orders_buyer_update" ON orders
      FOR UPDATE USING (buyer_id = auth.uid());
  END IF;
END $$;

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'order_items_buyer_all'
  ) THEN
    CREATE POLICY "order_items_buyer_all" ON order_items
      FOR ALL USING (
        order_id IN (
          SELECT id FROM orders WHERE buyer_id = auth.uid()
        )
      );
  END IF;
END $$;
