-- ─────────────────────────────────────────────────────────────────────────────
-- 00003_indexes_triggers.sql
-- Performance indexes + realtime setup
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Contacts ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_contacts_workspace        ON contacts (workspace_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone            ON contacts (phone_number);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score       ON contacts (workspace_id, lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_tags             ON contacts USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_contacts_last_seen        ON contacts (workspace_id, last_seen_at DESC);

-- ─── Conversations ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_conversations_workspace   ON conversations (workspace_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact     ON conversations (contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status      ON conversations (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg    ON conversations (workspace_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned    ON conversations (assigned_to);

-- ─── Messages ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_messages_conversation     ON messages (conversation_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_workspace        ON messages (workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_wa_id            ON messages (wa_message_id) WHERE wa_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_direction        ON messages (workspace_id, direction, timestamp DESC);

-- ─── Leads ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_leads_workspace           ON leads (workspace_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage               ON leads (workspace_id, stage);
CREATE INDEX IF NOT EXISTS idx_leads_contact             ON leads (contact_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned            ON leads (assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created             ON leads (workspace_id, created_at DESC);

-- ─── Appointments ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_appointments_workspace    ON appointments (workspace_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start        ON appointments (workspace_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_contact      ON appointments (contact_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status       ON appointments (workspace_id, status);

-- ─── Enquiries ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_enquiries_workspace       ON enquiries (workspace_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_status          ON enquiries (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_enquiries_created         ON enquiries (workspace_id, created_at DESC);

-- ─── Knowledge Base ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_kb_workspace_active       ON knowledge_base_items (workspace_id, is_active);
CREATE INDEX IF NOT EXISTS idx_kb_type                   ON knowledge_base_items (workspace_id, type);

-- ─── Analytics ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_analytics_workspace_date  ON analytics_summaries (workspace_id, date DESC);

-- ─── Realtime Subscriptions ───────────────────────────────────────────────────
-- Enable realtime on hot tables for live UI updates

ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;

-- ─── Auto-decrement unread_count on read ─────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_message_read()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'read' AND OLD.status != 'read' AND NEW.direction = 'inbound' THEN
    UPDATE conversations
    SET unread_count = GREATEST(unread_count - 1, 0)
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_message_read
  AFTER UPDATE OF status ON messages
  FOR EACH ROW EXECUTE FUNCTION handle_message_read();

-- ─── Auto-update conversation preview on new message ─────────────────────────

CREATE OR REPLACE FUNCTION handle_new_message()
RETURNS TRIGGER AS $$
DECLARE
  preview TEXT;
BEGIN
  preview := CASE
    WHEN NEW.message_type = 'text'     THEN LEFT(NEW.content, 100)
    WHEN NEW.message_type = 'image'    THEN '📷 Photo'
    WHEN NEW.message_type = 'video'    THEN '📹 Video'
    WHEN NEW.message_type = 'audio'    THEN '🎵 Audio'
    WHEN NEW.message_type = 'document' THEN '📄 Document'
    WHEN NEW.message_type = 'location' THEN '📍 Location'
    ELSE '💬 Message'
  END;

  UPDATE conversations
  SET
    last_message_at      = NEW.timestamp,
    last_message_preview = preview,
    unread_count         = CASE
                             WHEN NEW.direction = 'inbound' THEN unread_count + 1
                             ELSE unread_count
                           END,
    updated_at           = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_new_message_update_conversation
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION handle_new_message();
