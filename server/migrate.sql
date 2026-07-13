-- BTT Nexus CRM — Postgres schema (Railway / local)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS crm_kv (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'director',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  industry TEXT,
  city TEXT,
  type TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Существующие БД без этих полей (старый migrate)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE TABLE IF NOT EXISTS pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  first_name TEXT,
  last_name TEXT,
  position TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  stage_id UUID REFERENCES stages(id) ON DELETE SET NULL,
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  lost_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'planned',
  priority TEXT,
  assigned_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  info TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  country TEXT DEFAULT 'Uzbekistan',
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  start_ts TIMESTAMPTZ NOT NULL,
  end_ts TIMESTAMPTZ,
  type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_idempotency (
  idempotency_key TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deals_company ON deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_created ON deals(created_at);
CREATE INDEX IF NOT EXISTS idx_stages_pipeline ON stages(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deal ON tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_calendar_start ON calendar_events(start_ts);

-- Default pipeline + stages (matches typical CRM bootstrap)
INSERT INTO pipelines (id, name, description, is_default)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Основная воронка', '', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO stages (id, pipeline_id, name, order_index, color) VALUES
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Новая', 1, '#3b82f6'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Квалификация', 2, '#f59e0b'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Переговоры', 3, '#8b5cf6'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Закрыта', 4, '#10b981')
ON CONFLICT (id) DO NOTHING;

-- ============= QR / Rattan coils (MVP) =============

ALTER TABLE companies ADD COLUMN IF NOT EXISTS customer_type TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS telegram TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

CREATE SEQUENCE IF NOT EXISTS rattan_coil_code_seq START 1;

CREATE TABLE IF NOT EXISTS rattan_coils (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_code TEXT UNIQUE NOT NULL,
  qr_token TEXT UNIQUE NOT NULL,
  qr_status TEXT NOT NULL DEFAULT 'active',
  qr_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  qr_printed_at TIMESTAMPTZ,
  qr_print_count INT NOT NULL DEFAULT 0,
  first_scanned_at TIMESTAMPTZ,
  last_scanned_at TIMESTAMPTZ,
  scan_count INT NOT NULL DEFAULT 0,
  shipment_id TEXT,
  shipment_item_id TEXT,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  production_log_id TEXT,
  production_event_id TEXT,
  article TEXT NOT NULL,
  sticker_article TEXT,
  profile_name TEXT,
  color_name TEXT,
  weight_kg NUMERIC,
  coil_index INT NOT NULL DEFAULT 1,
  destination_country TEXT,
  produced_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_normalized TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  country TEXT,
  website_user_id TEXT,
  registration_source TEXT,
  first_source TEXT,
  latest_source TEXT,
  source_qr_token TEXT,
  source_dealer_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  assigned_dealer_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  assignment_status TEXT NOT NULL DEFAULT 'unassigned',
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_dealer_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES site_customers(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  assignment_source TEXT,
  assignment_qr_token TEXT,
  customer_country TEXT,
  dealer_country TEXT,
  country_match BOOLEAN,
  status TEXT NOT NULL DEFAULT 'active',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE,
  event_type TEXT NOT NULL,
  qr_token TEXT,
  coil_id UUID REFERENCES rattan_coils(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES site_customers(id) ON DELETE SET NULL,
  dealer_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  website_user_id TEXT,
  session_id TEXT,
  country TEXT,
  phone TEXT,
  product_ref TEXT,
  color_ref TEXT,
  profile_ref TEXT,
  page_url TEXT,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES site_customers(id) ON DELETE SET NULL,
  dealer_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  qr_token TEXT,
  coil_id UUID REFERENCES rattan_coils(id) ON DELETE SET NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  country TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  comment TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES site_customers(id) ON DELETE SET NULL,
  coil_id UUID REFERENCES rattan_coils(id) ON DELETE SET NULL,
  qr_token TEXT,
  dealer_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  rating INT,
  text TEXT,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  article TEXT,
  color_name TEXT,
  profile_name TEXT,
  moderation_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rattan_coils_token ON rattan_coils(qr_token);
CREATE INDEX IF NOT EXISTS idx_rattan_coils_shipment ON rattan_coils(shipment_id);
CREATE INDEX IF NOT EXISTS idx_rattan_coils_company ON rattan_coils(company_id);
CREATE INDEX IF NOT EXISTS idx_rattan_coils_deal ON rattan_coils(deal_id);
CREATE INDEX IF NOT EXISTS idx_rattan_coils_created ON rattan_coils(created_at);
CREATE INDEX IF NOT EXISTS idx_site_customers_phone ON site_customers(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_site_customers_dealer ON site_customers(assigned_dealer_id);
CREATE INDEX IF NOT EXISTS idx_site_events_type ON site_events(event_type);
CREATE INDEX IF NOT EXISTS idx_site_events_qr ON site_events(qr_token);
CREATE INDEX IF NOT EXISTS idx_site_events_customer ON site_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_site_events_created ON site_events(created_at);
CREATE INDEX IF NOT EXISTS idx_site_requests_dealer ON site_requests(dealer_id);
CREATE INDEX IF NOT EXISTS idx_site_reviews_status ON site_reviews(moderation_status);
CREATE INDEX IF NOT EXISTS idx_assignments_customer ON customer_dealer_assignments(customer_id);
