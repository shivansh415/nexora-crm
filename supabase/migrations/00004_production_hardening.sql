-- ============================================================================
-- 00004_production_hardening.sql
-- Adds race-safe / queue-safe idempotency support for high concurrency
-- (≈100 simultaneous AI chats) and faster 24h-window lookups.
--
-- Safe to run multiple times (IF NOT EXISTS guards).
-- ============================================================================

-- ── Race-safe outbound dedup used by the n8n "Send Guard" node ───────────────
-- The n8n workflow inserts each inbound message id here right before sending the
-- AI reply. The PRIMARY KEY makes the claim atomic across concurrent executions
-- AND across n8n worker processes (queue mode) — something the old in-memory
-- static-data cache could not guarantee. If the insert conflicts, the reply was
-- already sent by another execution, so the duplicate is skipped.
CREATE TABLE IF NOT EXISTS processed_messages (
  message_id  TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only the service role (used by n8n + the CRM server) should touch this table.
ALTER TABLE processed_messages ENABLE ROW LEVEL SECURITY;

-- Housekeeping index so an occasional cleanup of old rows stays fast.
CREATE INDEX IF NOT EXISTS idx_processed_messages_created_at
  ON processed_messages (created_at);

-- ── Faster 24h-window lookups (last inbound per conversation) ────────────────
CREATE INDEX IF NOT EXISTS idx_messages_conv_dir_ts
  ON messages (conversation_id, direction, timestamp DESC);

-- ── Optional: purge processed_messages older than 3 days ─────────────────────
-- Real duplicate webhooks arrive within seconds/minutes, so 3 days is ample.
-- If you have pg_cron enabled you can schedule this; otherwise it's harmless to
-- leave the table growing slowly (a few hundred rows/day).
-- SELECT cron.schedule('purge-processed-messages', '0 3 * * *',
--   $$ DELETE FROM processed_messages WHERE created_at < now() - interval '3 days' $$);
