-- ─────────────────────────────────────────────────────────────────────────────
-- 00001_initial_schema.sql
-- Run this in Supabase SQL editor or via: supabase db push
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE lead_stage AS ENUM (
  'new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'
);

CREATE TYPE lead_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TYPE message_type AS ENUM (
  'text', 'image', 'video', 'audio', 'document', 'location', 'sticker',
  'template', 'interactive', 'reaction', 'system'
);

CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE message_sender AS ENUM ('contact', 'ai', 'agent');

CREATE TYPE message_status AS ENUM (
  'sending', 'sent', 'delivered', 'read', 'failed'
);

CREATE TYPE conversation_status AS ENUM (
  'active', 'ai_paused', 'human_takeover', 'closed', 'archived'
);

CREATE TYPE appointment_status AS ENUM (
  'scheduled', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'no_show'
);

CREATE TYPE enquiry_status AS ENUM ('new', 'contacted', 'qualified', 'closed');
CREATE TYPE enquiry_source AS ENUM ('whatsapp', 'google_sheets', 'manual', 'website', 'referral');

CREATE TYPE kb_item_type AS ENUM (
  'faq', 'website', 'pdf', 'csv', 'property', 'manual'
);

CREATE TYPE user_role AS ENUM ('admin', 'agent', 'viewer');
CREATE TYPE business_type AS ENUM (
  'real_estate', 'coaching', 'education', 'healthcare', 'other'
);

-- ─── Agencies (top-level tenant) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agencies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  owner_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  plan            TEXT NOT NULL DEFAULT 'starter',
  logo_url        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Workspaces (clients / businesses) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspaces (
  id                            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id                     UUID REFERENCES agencies(id) ON DELETE CASCADE,
  name                          TEXT NOT NULL,
  business_type                 business_type NOT NULL DEFAULT 'other',
  timezone                      TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  whatsapp_phone_number_id      TEXT,
  whatsapp_access_token         TEXT,
  whatsapp_verify_token         TEXT,
  google_calendar_connected     BOOLEAN NOT NULL DEFAULT FALSE,
  google_sheets_connected       BOOLEAN NOT NULL DEFAULT FALSE,
  n8n_webhook_url               TEXT,
  ai_enabled                    BOOLEAN NOT NULL DEFAULT TRUE,
  logo_url                      TEXT,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Users / Team Members ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id       UUID REFERENCES agencies(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  avatar_url      TEXT,
  role            user_role NOT NULL DEFAULT 'agent',
  is_online       BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── User ↔ Workspace membership ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_workspace_memberships (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role            user_role NOT NULL DEFAULT 'agent',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, workspace_id)
);

-- ─── Contacts ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contacts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  phone_number    TEXT NOT NULL,
  email           TEXT,
  avatar_url      TEXT,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  lead_score      INTEGER NOT NULL DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
  source          TEXT NOT NULL DEFAULT 'whatsapp',
  notes           TEXT,
  assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,
  last_seen_at    TIMESTAMPTZ,
  opt_out         BOOLEAN NOT NULL DEFAULT FALSE,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, phone_number)
);

-- ─── Conversations ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id            UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id              UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  wa_conversation_id      TEXT,
  status                  conversation_status NOT NULL DEFAULT 'active',
  assigned_to             UUID REFERENCES users(id) ON DELETE SET NULL,
  ai_paused               BOOLEAN NOT NULL DEFAULT FALSE,
  ai_paused_until         TIMESTAMPTZ,
  ai_paused_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  last_message_at         TIMESTAMPTZ,
  last_message_preview    TEXT,
  unread_count            INTEGER NOT NULL DEFAULT 0,
  tags                    TEXT[] NOT NULL DEFAULT '{}',
  metadata                JSONB NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Messages ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  wa_message_id       TEXT UNIQUE,
  direction           message_direction NOT NULL,
  sender_type         message_sender NOT NULL,
  sender_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  message_type        message_type NOT NULL DEFAULT 'text',
  content             TEXT,
  media_url           TEXT,
  media_mime_type     TEXT,
  status              message_status NOT NULL DEFAULT 'sent',
  is_ai_generated     BOOLEAN NOT NULL DEFAULT FALSE,
  ai_confidence       NUMERIC(4,3),
  metadata            JSONB NOT NULL DEFAULT '{}',
  timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Leads ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leads (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id          UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id     UUID REFERENCES conversations(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  stage               lead_stage NOT NULL DEFAULT 'new',
  priority            lead_priority NOT NULL DEFAULT 'medium',
  deal_value          NUMERIC(15, 2),
  currency            TEXT NOT NULL DEFAULT 'INR',
  requirements        TEXT,
  budget_min          NUMERIC(15, 2),
  budget_max          NUMERIC(15, 2),
  location_pref       TEXT,
  assigned_to         UUID REFERENCES users(id) ON DELETE SET NULL,
  expected_close_date DATE,
  notes               TEXT,
  tags                TEXT[] NOT NULL DEFAULT '{}',
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Appointments ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS appointments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id          UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  lead_id             UUID REFERENCES leads(id) ON DELETE SET NULL,
  conversation_id     UUID REFERENCES conversations(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  start_time          TIMESTAMPTZ NOT NULL,
  end_time            TIMESTAMPTZ NOT NULL,
  location            TEXT,
  notes               TEXT,
  status              appointment_status NOT NULL DEFAULT 'scheduled',
  booked_by           TEXT NOT NULL DEFAULT 'ai', -- 'ai' | 'agent' | 'customer'
  google_event_id     TEXT,
  reminder_sent       BOOLEAN NOT NULL DEFAULT FALSE,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Enquiries ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS enquiries (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id          UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id     UUID REFERENCES conversations(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  phone_number        TEXT NOT NULL,
  email               TEXT,
  source              enquiry_source NOT NULL DEFAULT 'whatsapp',
  appointment_date    TIMESTAMPTZ,
  status              enquiry_status NOT NULL DEFAULT 'new',
  notes               TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Knowledge Base ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_base_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type            kb_item_type NOT NULL DEFAULT 'faq',
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  source_url      TEXT,
  file_path       TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  token_count     INTEGER,
  synced_at       TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── AI Configurations ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_configurations (
  id                            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id                  UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  model                         TEXT NOT NULL DEFAULT 'gpt-4o',
  temperature                   NUMERIC(3,2) NOT NULL DEFAULT 0.7,
  max_tokens                    INTEGER NOT NULL DEFAULT 1000,
  system_prompt                 TEXT NOT NULL DEFAULT '',
  welcome_message               TEXT,
  fallback_message              TEXT,
  human_handoff_message         TEXT,
  ai_resume_message             TEXT,
  outside_hours_message         TEXT,
  language                      TEXT NOT NULL DEFAULT 'en',
  business_hours_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
  business_hours                JSONB NOT NULL DEFAULT '{}',
  knowledge_base_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  appointment_booking_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  lead_qualification_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Analytics Summaries (daily rollup) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS analytics_summaries (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id            UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  date                    DATE NOT NULL,
  total_messages_in       INTEGER NOT NULL DEFAULT 0,
  total_messages_out      INTEGER NOT NULL DEFAULT 0,
  ai_messages_out         INTEGER NOT NULL DEFAULT 0,
  agent_messages_out      INTEGER NOT NULL DEFAULT 0,
  new_leads               INTEGER NOT NULL DEFAULT 0,
  new_appointments        INTEGER NOT NULL DEFAULT 0,
  human_takeovers         INTEGER NOT NULL DEFAULT 0,
  new_contacts            INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, date)
);

-- ─── Updated_at triggers ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'agencies', 'workspaces', 'users', 'contacts', 'conversations',
    'leads', 'appointments', 'enquiries', 'knowledge_base_items', 'ai_configurations'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;
