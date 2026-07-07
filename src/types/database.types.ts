// AUTO-GENERATED DATABASE TYPES — Matches Supabase schema from PROJECT_SPEC.md
// When using real Supabase, replace with: npx supabase gen types typescript --linked

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ─── Core Enums ───────────────────────────────────────────────────────────────

export type AgencyPlan = 'starter' | 'pro' | 'enterprise'
export type WorkspaceMemberRole = 'admin' | 'agent' | 'viewer'
export type ConversationStatus = 'open' | 'human_takeover' | 'resolved' | 'ai_paused'
export type AiMode = 'enabled' | 'paused' | 'disabled'
export type MessageDirection = 'inbound' | 'outbound'
export type MessageSenderType = 'customer' | 'ai' | 'agent'
export type MessageContentType = 'text' | 'image' | 'document' | 'audio' | 'video' | 'template'
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed'
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost'
export type LeadSource = 'whatsapp' | 'google_sheets' | 'manual' | 'referral'
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'cancelled' | 'rescheduled' | 'completed' | 'no_show'
export type BookedBy = 'ai' | 'agent' | 'customer'
export type KbItemType = 'faq' | 'website' | 'pdf' | 'csv' | 'property' | 'manual'
export type ContactSource = 'whatsapp' | 'manual' | 'google_sheets' | 'csv'
export type EnquirySource = 'whatsapp' | 'google_sheets' | 'manual'
export type EnquiryStatus = 'new' | 'contacted' | 'qualified' | 'closed'
export type ActivityType = 'status_change' | 'note_added' | 'message_sent' | 'appointment_booked' | 'ai_action'
export type AnalyticsEventType =
  | 'message_received'
  | 'message_sent'
  | 'lead_created'
  | 'appointment_booked'
  | 'human_takeover'
  | 'ai_resumed'

// ─── Table Types ──────────────────────────────────────────────────────────────

export interface Agency {
  id: string
  name: string
  owner_user_id: string
  plan: AgencyPlan
  plan_expires_at: string | null
  logo_url: string | null
  custom_domain: string | null
  settings: Json
  created_at: string
  updated_at: string
}

export interface Workspace {
  id: string
  agency_id: string
  name: string
  business_type: string
  whatsapp_phone_number_id: string | null
  whatsapp_access_token: string | null
  whatsapp_verify_token: string | null
  n8n_webhook_url: string | null
  google_calendar_connected: boolean
  google_sheets_connected: boolean
  google_sheet_id: string | null
  is_active: boolean
  ai_enabled: boolean
  timezone: string
  settings: Json
  created_at: string
  updated_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceMemberRole
  invited_by: string | null
  accepted_at: string | null
  created_at: string
}

export interface Contact {
  id: string
  workspace_id: string
  whatsapp_id: string
  phone_number: string
  name: string
  email: string | null
  avatar_url: string | null
  tags: string[]
  notes: string | null
  lead_score: number
  source: ContactSource
  custom_fields: Json
  is_blocked: boolean
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  workspace_id: string
  contact_id: string
  status: ConversationStatus
  assigned_agent_id: string | null
  is_pinned: boolean
  is_archived: boolean
  unread_count: number
  last_message_at: string | null
  last_message_preview: string | null
  ai_mode: AiMode
  label: string | null
  metadata: Json
  created_at: string
  updated_at: string
  // Joined
  contact?: Contact
}

export interface Message {
  id: string
  workspace_id: string
  conversation_id: string
  contact_id: string
  direction: MessageDirection
  sender_type: MessageSenderType
  sender_id: string | null
  content: string
  content_type: MessageContentType
  media_url: string | null
  whatsapp_message_id: string | null
  status: MessageStatus
  is_deleted: boolean
  metadata: Json
  sent_at: string
  created_at: string
}

export interface Lead {
  id: string
  workspace_id: string
  contact_id: string
  conversation_id: string | null
  title: string
  status: LeadStatus
  pipeline_stage: string
  pipeline_order: number
  value: number | null
  currency: string
  source: LeadSource
  assigned_to: string | null
  tags: string[]
  notes: string | null
  google_sheets_row_id: string | null
  qualification_data: Json
  lost_reason: string | null
  expected_close_date: string | null
  created_at: string
  updated_at: string
  // Joined
  contact?: Contact
}

export interface LeadActivity {
  id: string
  workspace_id: string
  lead_id: string
  user_id: string | null
  activity_type: ActivityType
  description: string
  previous_value: Json | null
  new_value: Json | null
  created_at: string
}

export interface Appointment {
  id: string
  workspace_id: string
  contact_id: string
  lead_id: string | null
  conversation_id: string | null
  title: string
  description: string | null
  start_time: string
  end_time: string
  status: AppointmentStatus
  booked_by: BookedBy
  google_calendar_event_id: string | null
  google_sheets_row_id: string | null
  assigned_agent_id: string | null
  location: string | null
  meeting_link: string | null
  reminder_sent: boolean
  notes: string | null
  metadata: Json
  created_at: string
  updated_at: string
  // Joined
  contact?: Contact
}

export interface AiConfiguration {
  id: string
  workspace_id: string
  model: string
  system_prompt: string
  temperature: number
  max_tokens: number
  welcome_message: string
  fallback_message: string
  human_handoff_message: string
  ai_resume_message: string
  business_hours_enabled: boolean
  business_hours: Json
  outside_hours_message: string
  knowledge_base_enabled: boolean
  appointment_booking_enabled: boolean
  lead_qualification_enabled: boolean
  language: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface KnowledgeBaseItem {
  id: string
  workspace_id: string
  type: KbItemType
  title: string
  content: string
  source_url: string | null
  file_path: string | null
  is_active: boolean
  token_count: number | null
  synced_at: string | null
  metadata: Json
  created_at: string
  updated_at: string
}

export interface Enquiry {
  id: string
  workspace_id: string
  lead_id: string | null
  contact_id: string | null
  conversation_id: string | null
  name: string
  phone_number: string
  email: string | null
  source: EnquirySource
  appointment_date: string | null
  status: EnquiryStatus
  assigned_agent_id: string | null
  notes: string | null
  google_sheets_row_ref: string | null
  synced_at: string | null
  created_at: string
  updated_at: string
}

export interface AnalyticsEvent {
  id: string
  workspace_id: string
  event_type: AnalyticsEventType
  actor_type: 'ai' | 'agent' | 'customer' | 'system'
  actor_id: string | null
  entity_type: 'conversation' | 'lead' | 'appointment'
  entity_id: string
  metadata: Json
  occurred_at: string
}

export interface AnalyticsDailySummary {
  id: string
  workspace_id: string
  date: string
  total_messages_in: number
  total_messages_out: number
  ai_messages_out: number
  agent_messages_out: number
  new_leads: number
  new_appointments: number
  appointments_cancelled: number
  human_takeovers: number
  avg_response_time_seconds: number
  active_conversations: number
}

export interface WebhookLog {
  id: string
  workspace_id: string | null
  source: 'whatsapp' | 'n8n'
  event_type: string
  payload: Json
  processed: boolean
  processing_error: string | null
  received_at: string
}

// ─── Supabase Database Shape ───────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      agencies: { Row: Agency; Insert: Partial<Agency>; Update: Partial<Agency> }
      workspaces: { Row: Workspace; Insert: Partial<Workspace>; Update: Partial<Workspace> }
      workspace_members: { Row: WorkspaceMember; Insert: Partial<WorkspaceMember>; Update: Partial<WorkspaceMember> }
      // Actual DB table name from SQL migration
      user_workspace_memberships: { Row: WorkspaceMember; Insert: Partial<WorkspaceMember>; Update: Partial<WorkspaceMember> }
      contacts: { Row: Contact; Insert: Partial<Contact>; Update: Partial<Contact> }
      conversations: { Row: Conversation; Insert: Partial<Conversation>; Update: Partial<Conversation> }
      messages: { Row: Message; Insert: Partial<Message>; Update: Partial<Message> }
      leads: { Row: Lead; Insert: Partial<Lead>; Update: Partial<Lead> }
      lead_activities: { Row: LeadActivity; Insert: Partial<LeadActivity>; Update: Partial<LeadActivity> }
      appointments: { Row: Appointment; Insert: Partial<Appointment>; Update: Partial<Appointment> }
      ai_configurations: { Row: AiConfiguration; Insert: Partial<AiConfiguration>; Update: Partial<AiConfiguration> }
      knowledge_base_items: { Row: KnowledgeBaseItem; Insert: Partial<KnowledgeBaseItem>; Update: Partial<KnowledgeBaseItem> }
      enquiries: { Row: Enquiry; Insert: Partial<Enquiry>; Update: Partial<Enquiry> }
      analytics_events: { Row: AnalyticsEvent; Insert: Partial<AnalyticsEvent>; Update: Partial<AnalyticsEvent> }
      analytics_daily_summaries: { Row: AnalyticsDailySummary; Insert: Partial<AnalyticsDailySummary>; Update: Partial<AnalyticsDailySummary> }
      webhook_logs: { Row: WebhookLog; Insert: Partial<WebhookLog>; Update: Partial<WebhookLog> }
    }
  }
}
