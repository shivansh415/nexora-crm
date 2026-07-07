-- ─────────────────────────────────────────────────────────────────────────────
-- 00002_rls_policies.sql
-- Row Level Security — multi-tenant isolation
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE agencies                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces                ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_workspace_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiries                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_configurations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_summaries       ENABLE ROW LEVEL SECURITY;

-- ─── Helper: get agency_id for the current authenticated user ─────────────────

CREATE OR REPLACE FUNCTION auth_user_agency_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT agency_id FROM users WHERE id = auth.uid()
$$;

-- ─── Helper: workspaces the current user has access to ───────────────────────

CREATE OR REPLACE FUNCTION auth_user_workspace_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE AS $$
  SELECT workspace_id FROM user_workspace_memberships WHERE user_id = auth.uid()
$$;

-- ─── Helper: is current user an admin of an agency ───────────────────────────

CREATE OR REPLACE FUNCTION auth_is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT role = 'admin' FROM users WHERE id = auth.uid()
$$;

-- ─── AGENCIES ─────────────────────────────────────────────────────────────────

CREATE POLICY "Agency members can read their agency"
  ON agencies FOR SELECT
  USING (id = auth_user_agency_id());

CREATE POLICY "Agency admins can update their agency"
  ON agencies FOR UPDATE
  USING (id = auth_user_agency_id() AND auth_is_admin());

-- ─── WORKSPACES ───────────────────────────────────────────────────────────────

CREATE POLICY "Users can read workspaces they are members of"
  ON workspaces FOR SELECT
  USING (id IN (SELECT auth_user_workspace_ids()));

CREATE POLICY "Agency admins can insert workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (agency_id = auth_user_agency_id() AND auth_is_admin());

CREATE POLICY "Agency admins can update workspaces"
  ON workspaces FOR UPDATE
  USING (agency_id = auth_user_agency_id() AND auth_is_admin());

CREATE POLICY "Agency admins can delete workspaces"
  ON workspaces FOR DELETE
  USING (agency_id = auth_user_agency_id() AND auth_is_admin());

-- ─── USERS ────────────────────────────────────────────────────────────────────

CREATE POLICY "Users can read users in the same agency"
  ON users FOR SELECT
  USING (agency_id = auth_user_agency_id());

CREATE POLICY "Users can update their own record"
  ON users FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins can update any user in their agency"
  ON users FOR UPDATE
  USING (agency_id = auth_user_agency_id() AND auth_is_admin());

-- ─── USER WORKSPACE MEMBERSHIPS ───────────────────────────────────────────────

CREATE POLICY "Users can see their own memberships"
  ON user_workspace_memberships FOR SELECT
  USING (user_id = auth.uid() OR
         workspace_id IN (SELECT auth_user_workspace_ids()));

CREATE POLICY "Admins can manage memberships in their workspaces"
  ON user_workspace_memberships FOR ALL
  USING (workspace_id IN (SELECT auth_user_workspace_ids()) AND auth_is_admin());

-- ─── CONTACTS ─────────────────────────────────────────────────────────────────

CREATE POLICY "Workspace members can CRUD contacts"
  ON contacts FOR ALL
  USING (workspace_id IN (SELECT auth_user_workspace_ids()));

-- ─── CONVERSATIONS ────────────────────────────────────────────────────────────

CREATE POLICY "Workspace members can CRUD conversations"
  ON conversations FOR ALL
  USING (workspace_id IN (SELECT auth_user_workspace_ids()));

-- ─── MESSAGES ─────────────────────────────────────────────────────────────────

CREATE POLICY "Workspace members can read messages"
  ON messages FOR SELECT
  USING (workspace_id IN (SELECT auth_user_workspace_ids()));

CREATE POLICY "Workspace members can insert messages"
  ON messages FOR INSERT
  WITH CHECK (workspace_id IN (SELECT auth_user_workspace_ids()));

CREATE POLICY "Workspace members can update message status"
  ON messages FOR UPDATE
  USING (workspace_id IN (SELECT auth_user_workspace_ids()));

-- ─── LEADS ────────────────────────────────────────────────────────────────────

CREATE POLICY "Workspace members can CRUD leads"
  ON leads FOR ALL
  USING (workspace_id IN (SELECT auth_user_workspace_ids()));

-- ─── APPOINTMENTS ─────────────────────────────────────────────────────────────

CREATE POLICY "Workspace members can CRUD appointments"
  ON appointments FOR ALL
  USING (workspace_id IN (SELECT auth_user_workspace_ids()));

-- ─── ENQUIRIES ────────────────────────────────────────────────────────────────

CREATE POLICY "Workspace members can CRUD enquiries"
  ON enquiries FOR ALL
  USING (workspace_id IN (SELECT auth_user_workspace_ids()));

-- ─── KNOWLEDGE BASE ───────────────────────────────────────────────────────────

CREATE POLICY "Workspace members can CRUD knowledge base items"
  ON knowledge_base_items FOR ALL
  USING (workspace_id IN (SELECT auth_user_workspace_ids()));

-- ─── AI CONFIGURATIONS ────────────────────────────────────────────────────────

CREATE POLICY "Workspace members can read AI config"
  ON ai_configurations FOR SELECT
  USING (workspace_id IN (SELECT auth_user_workspace_ids()));

CREATE POLICY "Workspace admins can update AI config"
  ON ai_configurations FOR ALL
  USING (workspace_id IN (SELECT auth_user_workspace_ids()) AND auth_is_admin());

-- ─── ANALYTICS ────────────────────────────────────────────────────────────────

CREATE POLICY "Workspace members can read analytics"
  ON analytics_summaries FOR SELECT
  USING (workspace_id IN (SELECT auth_user_workspace_ids()));

CREATE POLICY "Service role can insert/update analytics"
  ON analytics_summaries FOR ALL
  USING (auth.role() = 'service_role');
