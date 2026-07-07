# PROJECT_SPEC.md
## SaaS CRM Platform for AI WhatsApp Automation Agencies
### Master Engineering Specification — v1.0.0

---

> **Document Status:** Living Document — Source of Truth for All Development  
> **Audience:** Engineering, Product, Design, DevOps  
> **Methodology:** Vibe Coding / Claude Code 
> **Last Updated:** 2025  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Technical Stack](#3-technical-stack)
4. [Multi-Tenancy Architecture](#4-multi-tenancy-architecture)
5. [Database Design](#5-database-design)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Security Architecture](#7-security-architecture)
8. [Feature Modules — Detailed Planning](#8-feature-modules--detailed-planning)
   - 8.1 Dashboard
   - 8.2 Live Chat (WhatsApp-Inspired)
   - 8.3 Human Takeover
   - 8.4 Lead CRM & Pipeline
   - 8.5 Contacts
   - 8.6 Appointments & Calendar
   - 8.7 AI Settings
   - 8.8 Knowledge Base
   - 8.9 Analytics
   - 8.10 Enquiries
   - 8.11 Settings
9. [UI/UX Design System](#9-uiux-design-system)
10. [Mobile-First Design Specification](#10-mobile-first-design-specification)
11. [Google Sheets Integration](#11-google-sheets-integration)
12. [n8n Automation Architecture](#12-n8n-automation-architecture)
13. [WhatsApp Cloud API Integration](#13-whatsapp-cloud-api-integration)
14. [Folder Structure](#14-folder-structure)
15. [Environment Variables](#15-environment-variables)
16. [Development Roadmap](#16-development-roadmap)
17. [Acceptance Criteria](#17-acceptance-criteria)
18. [Future Features & Placeholders](#18-future-features--placeholders)

---

## 1. Executive Summary

### 1.1 Product Vision

This platform is a **multi-tenant SaaS CRM** purpose-built for agencies that resell AI-powered WhatsApp automation to businesses. The core insight is that agencies need a single control center to manage tens or hundreds of client workspaces — each with independent AI configuration, conversation history, leads, appointments, and contacts — without any data bleeding between clients.

The platform is not a WhatsApp bot builder. It is a **professional business CRM** whose primary communication channel happens to be WhatsApp. The system positions itself at the intersection of three categories:
- A WhatsApp Business Manager (familiar UX)
- A CRM / Lead Pipeline (structured data layer)
- An AI Automation Platform (n8n + OpenAI backend)

### 1.2 Target Users

| User Role | Description | Primary Needs |
|-----------|-------------|---------------|
| Agency Owner | Runs the SaaS agency, manages all clients | Client onboarding, billing oversight, global settings |
| Client Admin | Business owner using the CRM | Chat monitoring, lead overview, appointments |
| Client Agent | Staff member handling human takeover | Live chat, manual replies, lead updates |
| (Future) Team Member | Agency staff assigned to specific clients | Scoped access per assignment |

### 1.3 Core Value Proposition

1. **Zero learning curve** — Chat UI mirrors WhatsApp familiarity
2. **Agency-first** — Manage all clients from one workspace switcher
3. **AI-transparent** — Business owners see exactly what the AI is doing
4. **Instant takeover** — One click to pause AI and start manual reply
5. **Unified data** — Google Sheets + Supabase sync, no silos

### 1.4 Business Verticals Supported (MVP)

- Real Estate
- Clinics / Healthcare
- Education / Coaching
- Manufacturing / B2B
- Restaurants / F&B
- General Service Businesses

Each vertical has different lead qualification criteria, appointment workflows, and knowledge base structures. The system must be generic enough to serve all, with vertical-specific presets available in AI Settings.

---

## 2. System Architecture

### 2.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        EXTERNAL LAYER                           │
│                                                                 │
│   WhatsApp End User (Customer)                                  │
│          │                                                      │
│          ▼                                                      │
│   WhatsApp Cloud API (Meta Business Platform)                   │
│          │                                                      │
│          ▼                                                      │
│   Webhook (HTTPS POST to n8n endpoint)                         │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AUTOMATION LAYER                           │
│                                                                 │
│   n8n (Self-hosted or n8n Cloud)                               │
│   ├── Webhook Receiver Node                                    │
│   ├── Message Router (AI vs Human mode check)                  │
│   ├── OpenAI Node (GPT-4o / GPT-3.5)                          │
│   ├── Google Calendar Node                                     │
│   ├── Google Sheets Node                                       │
│   └── Supabase Node (read/write)                               │
│          │                                                      │
│          ▼                                                      │
│   OpenAI API                                                   │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                │
│                                                                 │
│   Supabase                                                      │
│   ├── PostgreSQL Database (primary store)                      │
│   ├── Realtime (WebSocket subscriptions)                       │
│   ├── Storage (files, future attachments)                      │
│   ├── Auth (JWT, RLS policies)                                  │
│   └── Edge Functions (webhook processor, auth hooks)           │
│                                                                 │
│   Google Sheets (optional secondary store)                     │
│   └── Synced via n8n pipelines                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                           │
│                                                                 │
│   Next.js 15 Application (App Router)                          │
│   ├── Agency Dashboard (workspace switcher)                    │
│   ├── Client Workspace                                         │
│   │   ├── Live Chat (WhatsApp UI)                             │
│   │   ├── Leads / Pipeline                                     │
│   │   ├── Contacts                                             │
│   │   ├── Appointments                                         │
│   │   ├── Analytics                                            │
│   │   ├── AI Settings                                          │
│   │   ├── Knowledge Base                                       │
│   │   └── Settings                                             │
│   └── Supabase Realtime Subscriptions                          │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Architectural Principles

**Separation of Concerns**
- The dashboard NEVER directly triggers AI logic. All AI is orchestrated by n8n.
- The dashboard reads and writes to Supabase. n8n reads and writes to Supabase. They share the data layer without coupling.
- This means n8n workflows can be updated independently of the frontend.

**Event-Driven Communication**
- Supabase Realtime provides push updates to the dashboard when n8n writes new messages, lead status changes, or appointment updates.
- No polling. All live updates via WebSocket.

**Multi-Tenant Isolation**
- Every database query is scoped to `workspace_id`.
- Row Level Security (RLS) policies enforce tenant isolation at the database level.
- No application-level code can bypass RLS.

**AI Abstraction**
- AI prompt, model, temperature, and behavior are stored in Supabase per workspace.
- n8n reads this configuration before calling OpenAI.
- Changing AI behavior requires only a Supabase update, not a code deployment.

**Stateless API**
- No server-side sessions. All auth via Supabase JWT tokens passed in headers.
- Next.js API routes act as thin proxies when needed. All business logic in Supabase functions or n8n.

---

## 3. Technical Stack

### 3.1 Frontend

| Technology | Version | Purpose | Rationale |
|-----------|---------|---------|-----------|
| Next.js | 15.x | App framework | App Router, RSC, excellent DX, Vercel-optimized |
| TypeScript | 5.x | Type safety | Mandatory for enterprise maintainability |
| Tailwind CSS | 3.x | Styling | Utility-first, consistent with design tokens |
| shadcn/ui | Latest | Component library | Headless, accessible, fully customizable |
| React Query (TanStack) | 5.x | Server state | Caching, background sync, optimistic updates |
| React Hook Form | 7.x | Forms | Performance, minimal re-renders |
| Zod | 3.x | Validation | Runtime + compile-time type safety |
| Framer Motion | 11.x | Animations | Subtle, purposeful micro-interactions only |
| Lucide React | Latest | Icons | Consistent, lightweight icon set |
| date-fns | 3.x | Date utilities | Localization, formatting |
| Sonner | Latest | Toast notifications | Lightweight, beautiful toasts |

### 3.2 Backend / Infrastructure

| Technology | Purpose | Notes |
|-----------|---------|-------|
| Supabase | Database, Auth, Realtime, Storage | Self-hostable, PostgreSQL |
| PostgreSQL 15+ | Primary database | Via Supabase |
| Supabase Realtime | WebSocket push | Chat, lead updates |
| Supabase Storage | File storage | Future attachments |
| Supabase Edge Functions | Server-side logic | Webhook processing, auth hooks |

### 3.3 Automation & AI

| Technology | Purpose | Notes |
|-----------|---------|-------|
| n8n | Workflow automation | Self-hosted recommended |
| WhatsApp Cloud API | WhatsApp messaging | Official Meta API |
| OpenAI API | AI responses | GPT-4o default |
| Google Calendar API | Appointment booking | OAuth 2.0 |
| Google Sheets API | Lead/appointment sync | OAuth 2.0 |

### 3.4 DevOps & Tooling

| Technology | Purpose |
|-----------|---------|
| Vercel | Frontend hosting (recommended) |
| Supabase Cloud or Self-hosted | Backend |
| GitHub Actions | CI/CD pipeline |
| ESLint + Prettier | Code quality |
| Husky | Pre-commit hooks |
| Vitest | Unit testing |
| Playwright | E2E testing |

---

## 4. Multi-Tenancy Architecture

### 4.1 Tenancy Model

This platform uses a **shared database, row-level multi-tenancy** model.

```
Agency (Top-Level Tenant)
└── Workspaces (One per Client)
    ├── WhatsApp Business Account
    ├── AI Configuration
    ├── Conversations
    ├── Leads
    ├── Contacts
    ├── Appointments
    └── Knowledge Base
```

**Why shared database:**
- Simpler operations (single Supabase instance)
- Cost-effective at scale
- RLS provides equivalent security to separate databases
- Single backup / restore strategy
- Cross-client analytics possible for agency owner (future)

**Why not separate databases per tenant:**
- Operational overhead at 50+ clients
- Schema migrations across hundreds of databases
- Not necessary given RLS strength in PostgreSQL

### 4.2 Workspace Isolation Strategy

Every table that holds client data has a `workspace_id` (UUID, foreign key). RLS policies enforce:

```
Rule: Users can only SELECT/INSERT/UPDATE/DELETE rows
where workspace_id IN (their permitted workspaces)
```

Agency owners have access to all workspaces they own. Client admins and agents only access their single workspace.

### 4.3 Workspace Switcher (Agency UX)

The agency owner sees a **workspace switcher** in the top-left of the sidebar. This is a dropdown that lists all client workspaces. Switching workspace changes the entire dashboard context. The current `workspace_id` is stored in the URL path: `/workspace/[workspaceId]/dashboard`.

This means:
- Each workspace URL is shareable/bookmarkable
- Browser back/forward works correctly
- Multiple workspaces can be open in separate tabs

---

## 5. Database Design

### 5.1 Overview & Design Philosophy

All tables follow these conventions:
- `id`: UUID, primary key, default `gen_random_uuid()`
- `created_at`: TIMESTAMPTZ, default `now()`
- `updated_at`: TIMESTAMPTZ, auto-updated via trigger
- Soft deletes where appropriate: `deleted_at` TIMESTAMPTZ nullable
- All tenant-scoped tables have `workspace_id` UUID NOT NULL with FK + index

---

### 5.2 Table Definitions

#### `agencies`
Top-level organization record for each agency using the platform.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | TEXT | Agency name |
| owner_user_id | UUID | FK → auth.users |
| plan | TEXT | 'starter' / 'pro' / 'enterprise' |
| plan_expires_at | TIMESTAMPTZ | Nullable |
| logo_url | TEXT | Nullable |
| custom_domain | TEXT | Nullable (future white-label) |
| settings | JSONB | Global agency settings |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes:** `owner_user_id`, `custom_domain`

---

#### `workspaces`
One record per client managed by the agency. This is the core tenancy unit.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| agency_id | UUID | FK → agencies |
| name | TEXT | Client business name |
| business_type | TEXT | 'real_estate' / 'clinic' / 'education' / etc. |
| whatsapp_phone_number_id | TEXT | Meta API phone number ID |
| whatsapp_access_token | TEXT | Encrypted |
| whatsapp_verify_token | TEXT | Webhook verify token |
| n8n_webhook_url | TEXT | Per-workspace n8n endpoint |
| google_calendar_connected | BOOLEAN | |
| google_sheets_connected | BOOLEAN | |
| google_sheet_id | TEXT | Nullable |
| is_active | BOOLEAN | Soft disable without deletion |
| ai_enabled | BOOLEAN | Global AI on/off |
| timezone | TEXT | e.g. 'Asia/Kolkata' |
| settings | JSONB | Workspace-level overrides |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes:** `agency_id`, `whatsapp_phone_number_id`  
**Relationships:** One agency → many workspaces

---

#### `workspace_members`
Links users to workspaces with a specific role.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| workspace_id | UUID | FK → workspaces |
| user_id | UUID | FK → auth.users |
| role | TEXT | 'admin' / 'agent' / 'viewer' |
| invited_by | UUID | FK → auth.users, nullable |
| accepted_at | TIMESTAMPTZ | Nullable until invite accepted |
| created_at | TIMESTAMPTZ | |

**Indexes:** `workspace_id`, `user_id`, composite `(workspace_id, user_id)` UNIQUE  
**Purpose:** Enables future team member invitations

---

#### `contacts`
Every person who has ever messaged the client's WhatsApp number.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| workspace_id | UUID | FK → workspaces |
| whatsapp_id | TEXT | WhatsApp phone number (no +, e.g. 919876543210) |
| phone_number | TEXT | Formatted display number |
| name | TEXT | From WhatsApp profile or manually entered |
| email | TEXT | Nullable, manually entered |
| avatar_url | TEXT | Nullable |
| tags | TEXT[] | Array of string tags |
| notes | TEXT | Nullable |
| lead_score | INTEGER | 0–100, computed or manual |
| source | TEXT | 'whatsapp' / 'manual' / 'google_sheets' / 'csv' |
| custom_fields | JSONB | Vertical-specific data |
| is_blocked | BOOLEAN | Block contact from all interactions |
| last_seen_at | TIMESTAMPTZ | Last message timestamp |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes:** `workspace_id`, `whatsapp_id`, `(workspace_id, whatsapp_id)` UNIQUE, `tags` GIN index, `lead_score`  
**Scalability:** `custom_fields` JSONB allows any vertical-specific data without schema changes

---

#### `conversations`
Represents a single conversation thread between the client business and a contact.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| workspace_id | UUID | FK → workspaces |
| contact_id | UUID | FK → contacts |
| status | TEXT | 'open' / 'human_takeover' / 'resolved' / 'ai_paused' |
| assigned_agent_id | UUID | FK → auth.users, nullable |
| is_pinned | BOOLEAN | Pinned to top of list |
| is_archived | BOOLEAN | Archived conversations |
| unread_count | INTEGER | Messages unseen by agent |
| last_message_at | TIMESTAMPTZ | For sorting |
| last_message_preview | TEXT | Preview text in conversation list |
| ai_mode | TEXT | 'enabled' / 'paused' / 'disabled' |
| label | TEXT | Nullable (future: custom labels) |
| metadata | JSONB | Any extra data from n8n |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes:** `workspace_id`, `contact_id`, `status`, `last_message_at` DESC, `assigned_agent_id`, `is_pinned`, `is_archived`  
**Critical:** `last_message_at` index is essential for fast conversation list rendering

---

#### `messages`
Individual messages within a conversation. This is the highest-volume table.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| workspace_id | UUID | FK → workspaces |
| conversation_id | UUID | FK → conversations |
| contact_id | UUID | FK → contacts |
| direction | TEXT | 'inbound' / 'outbound' |
| sender_type | TEXT | 'customer' / 'ai' / 'agent' |
| sender_id | UUID | FK → auth.users if agent, nullable |
| content | TEXT | Message text |
| content_type | TEXT | 'text' / 'image' / 'document' / 'audio' / 'video' / 'template' |
| media_url | TEXT | Nullable, future attachments |
| whatsapp_message_id | TEXT | Meta's message ID (for status updates) |
| status | TEXT | 'sent' / 'delivered' / 'read' / 'failed' |
| is_deleted | BOOLEAN | Soft delete |
| metadata | JSONB | n8n context, AI token usage, etc. |
| sent_at | TIMESTAMPTZ | Actual send time |
| created_at | TIMESTAMPTZ | |

**Indexes:** `conversation_id`, `workspace_id`, `sent_at` DESC, `whatsapp_message_id`, `direction`  
**Partitioning Note:** At scale (>10M messages), consider range partitioning by `created_at` month. Design with this in mind by never doing full table scans — always filter by `workspace_id` and `conversation_id` first.  
**Realtime:** This table should have Supabase Realtime enabled for the `INSERT` event.

---

#### `leads`
Structured lead records, linked to contacts and conversations.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| workspace_id | UUID | FK → workspaces |
| contact_id | UUID | FK → contacts |
| conversation_id | UUID | FK → conversations, nullable |
| title | TEXT | Short description e.g. "3BHK Flat — Bandra" |
| status | TEXT | 'new' / 'contacted' / 'qualified' / 'proposal' / 'won' / 'lost' |
| pipeline_stage | TEXT | Custom stage name |
| pipeline_order | INTEGER | Sort order within stage |
| value | NUMERIC | Estimated deal value, nullable |
| currency | TEXT | Default 'INR' |
| source | TEXT | 'whatsapp' / 'google_sheets' / 'manual' / 'referral' |
| assigned_to | UUID | FK → auth.users, nullable |
| tags | TEXT[] | |
| notes | TEXT | |
| google_sheets_row_id | TEXT | Nullable, for bidirectional sync |
| qualification_data | JSONB | AI-extracted qualification answers |
| lost_reason | TEXT | Nullable |
| expected_close_date | DATE | Nullable |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes:** `workspace_id`, `status`, `assigned_to`, `contact_id`, `pipeline_stage`, `source`, `tags` GIN

---

#### `lead_activities`
Timeline of all activity on a lead — status changes, notes, calls, etc.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| workspace_id | UUID | FK → workspaces |
| lead_id | UUID | FK → leads |
| user_id | UUID | FK → auth.users, nullable (system events have no user) |
| activity_type | TEXT | 'status_change' / 'note_added' / 'message_sent' / 'appointment_booked' / 'ai_action' |
| description | TEXT | Human-readable description |
| previous_value | JSONB | For status changes, the before state |
| new_value | JSONB | The after state |
| created_at | TIMESTAMPTZ | |

**Indexes:** `lead_id`, `workspace_id`, `created_at` DESC

---

#### `appointments`
Appointments booked through the AI or manually by agents.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| workspace_id | UUID | FK → workspaces |
| contact_id | UUID | FK → contacts |
| lead_id | UUID | FK → leads, nullable |
| conversation_id | UUID | FK → conversations, nullable |
| title | TEXT | |
| description | TEXT | Nullable |
| start_time | TIMESTAMPTZ | |
| end_time | TIMESTAMPTZ | |
| status | TEXT | 'scheduled' / 'confirmed' / 'cancelled' / 'rescheduled' / 'completed' / 'no_show' |
| booked_by | TEXT | 'ai' / 'agent' / 'customer' |
| google_calendar_event_id | TEXT | Nullable |
| google_sheets_row_id | TEXT | Nullable |
| assigned_agent_id | UUID | FK → auth.users, nullable |
| location | TEXT | Nullable |
| meeting_link | TEXT | Nullable (Google Meet, Zoom) |
| reminder_sent | BOOLEAN | |
| notes | TEXT | |
| metadata | JSONB | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes:** `workspace_id`, `contact_id`, `start_time`, `status`, `assigned_agent_id`

---

#### `ai_configurations`
Per-workspace AI behavior settings.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| workspace_id | UUID | FK → workspaces, UNIQUE |
| model | TEXT | 'gpt-4o' / 'gpt-3.5-turbo' / etc. |
| system_prompt | TEXT | The AI persona and instructions |
| temperature | NUMERIC | 0.0 – 2.0 |
| max_tokens | INTEGER | Response length cap |
| welcome_message | TEXT | First message sent to new contacts |
| fallback_message | TEXT | When AI cannot respond |
| human_handoff_message | TEXT | Message when switching to human |
| ai_resume_message | TEXT | Message when resuming AI |
| business_hours_enabled | BOOLEAN | |
| business_hours | JSONB | { mon: {start, end}, tue: ... } |
| outside_hours_message | TEXT | |
| knowledge_base_enabled | BOOLEAN | |
| appointment_booking_enabled | BOOLEAN | |
| lead_qualification_enabled | BOOLEAN | |
| language | TEXT | 'en' / 'hi' / 'ar' etc. |
| updated_by | UUID | FK → auth.users |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes:** `workspace_id` UNIQUE  
**Note:** Sensitive prompt data — future encryption at rest recommended

---

#### `knowledge_base_items`
Individual knowledge chunks used for AI context.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| workspace_id | UUID | FK → workspaces |
| type | TEXT | 'faq' / 'website' / 'pdf' / 'csv' / 'property' / 'manual' |
| title | TEXT | |
| content | TEXT | The actual text content |
| source_url | TEXT | Nullable for website sync |
| file_path | TEXT | Nullable for PDF/CSV in Supabase Storage |
| is_active | BOOLEAN | Include in AI context |
| embedding | vector(1536) | Future RAG — pgvector extension |
| token_count | INTEGER | For context window management |
| synced_at | TIMESTAMPTZ | Last sync time for web content |
| metadata | JSONB | Category, tags, etc. |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes:** `workspace_id`, `type`, `is_active`, future: `embedding` vector index (HNSW/IVFFlat)  
**RAG Readiness:** The `embedding` column (disabled until pgvector activated) and `token_count` make this table ready for semantic search without schema migration.

---

#### `enquiries`
Unified view of all leads/enquiries regardless of source. Can be a materialized view or a standalone table synced from leads, WhatsApp, and Google Sheets.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| workspace_id | UUID | FK → workspaces |
| lead_id | UUID | FK → leads, nullable |
| contact_id | UUID | FK → contacts, nullable |
| conversation_id | UUID | FK → conversations, nullable |
| name | TEXT | |
| phone_number | TEXT | |
| email | TEXT | Nullable |
| source | TEXT | 'whatsapp' / 'google_sheets' / 'manual' |
| appointment_date | TIMESTAMPTZ | Nullable |
| status | TEXT | 'new' / 'contacted' / 'qualified' / 'closed' |
| assigned_agent_id | UUID | FK → auth.users, nullable |
| notes | TEXT | |
| google_sheets_row_ref | TEXT | Nullable |
| synced_at | TIMESTAMPTZ | Last sync from Google Sheets |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Unique Constraint:** `(workspace_id, phone_number, source)` to prevent duplicate entries from multiple sync sources.  
**Deduplication Logic:** On upsert, check by `phone_number` + `workspace_id` first. If lead exists, update instead of insert.

---

#### `analytics_events`
Raw event log for analytics computation.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| workspace_id | UUID | FK → workspaces |
| event_type | TEXT | 'message_received' / 'message_sent' / 'lead_created' / 'appointment_booked' / 'human_takeover' / 'ai_resumed' |
| actor_type | TEXT | 'ai' / 'agent' / 'customer' / 'system' |
| actor_id | UUID | Nullable |
| entity_type | TEXT | 'conversation' / 'lead' / 'appointment' |
| entity_id | UUID | |
| metadata | JSONB | Event-specific data |
| occurred_at | TIMESTAMPTZ | |

**Indexes:** `workspace_id`, `event_type`, `occurred_at` DESC, `(workspace_id, event_type, occurred_at)`  
**Scalability:** Partition by `occurred_at` month. Aggregate into `analytics_daily_summaries` via scheduled function.

---

#### `analytics_daily_summaries`
Pre-aggregated daily stats for fast dashboard loading.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| workspace_id | UUID | FK → workspaces |
| date | DATE | |
| total_messages_in | INTEGER | |
| total_messages_out | INTEGER | |
| ai_messages_out | INTEGER | |
| agent_messages_out | INTEGER | |
| new_leads | INTEGER | |
| new_appointments | INTEGER | |
| appointments_cancelled | INTEGER | |
| human_takeovers | INTEGER | |
| avg_response_time_seconds | NUMERIC | |
| active_conversations | INTEGER | |

**Unique Constraint:** `(workspace_id, date)`  
**Updated:** Via scheduled Supabase Edge Function (daily at midnight)

---

#### `webhook_logs`
Audit log of all incoming webhook events.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| workspace_id | UUID | FK → workspaces, nullable |
| source | TEXT | 'whatsapp' / 'n8n' |
| event_type | TEXT | |
| payload | JSONB | Raw payload (sanitized) |
| processed | BOOLEAN | |
| processing_error | TEXT | Nullable |
| received_at | TIMESTAMPTZ | |

**Retention:** Purge records older than 30 days via scheduled function.

---

### 5.3 Database Relationships Summary

```
agencies (1) ──── (N) workspaces
workspaces (1) ──── (1) ai_configurations
workspaces (1) ──── (N) workspace_members
workspaces (1) ──── (N) contacts
workspaces (1) ──── (N) conversations
workspaces (1) ──── (N) leads
workspaces (1) ──── (N) appointments
workspaces (1) ──── (N) knowledge_base_items
workspaces (1) ──── (N) enquiries
workspaces (1) ──── (N) analytics_events
contacts (1) ──── (N) conversations
contacts (1) ──── (N) leads
contacts (1) ──── (N) appointments
conversations (1) ──── (N) messages
leads (1) ──── (N) lead_activities
leads (1) ──── (N) appointments
```

### 5.4 Row Level Security (RLS) Strategy

**All tenant-scoped tables get these policies:**

```
Policy 1: SELECT — user must be member of the workspace
Policy 2: INSERT — user must be member of the workspace
Policy 3: UPDATE — user must be member AND role allows
Policy 4: DELETE — only admin role members
```

Agency owners bypass workspace-level RLS by checking `agencies.owner_user_id = auth.uid()` and `workspaces.agency_id = agencies.id`.

---

## 6. Authentication & Authorization

### 6.1 Authentication Stack

**Provider:** Supabase Auth  
**Method:** Email + Password (MVP), future: Google OAuth, Magic Link

**JWT Structure:**
- Standard Supabase JWT with custom claims injected via Auth Hook
- Custom claims: `agency_id`, `workspace_ids[]`, `role`
- Token expiry: 1 hour access token, 7-day refresh token

**Auth Hook (Supabase Edge Function):**
- Fires on login
- Queries `workspace_members` and `agencies` to build custom JWT claims
- Injected claims enable RLS policies to run without extra queries

### 6.2 Role Definitions

| Role | Scope | Permissions |
|------|-------|-------------|
| `agency_owner` | Agency-wide | CRUD on all workspaces, billing, onboard clients |
| `client_admin` | Single workspace | All features except billing and agency settings |
| `client_agent` | Single workspace | Chat, lead notes, contacts. No AI settings. No analytics. |
| `viewer` (future) | Single workspace | Read-only access |

### 6.3 Role Enforcement

**Frontend:** Role is read from JWT custom claims stored in Supabase session. UI elements (buttons, nav items, forms) are conditionally rendered based on role.

**Backend:** Every Supabase RLS policy double-checks role, independent of frontend. Frontend role-hiding is UX convenience only — RLS is the security layer.

**API Routes:** Next.js API routes (if any) validate the Supabase session token via `createServerClient` before processing any request.

### 6.4 Session Management

- Sessions stored in HTTP-only cookies (Next.js middleware handles refresh)
- Middleware redirects unauthenticated users to `/login`
- After login, redirect to `/workspace/[default_workspace_id]/dashboard`
- Agency owners without workspaces land on `/agency/setup`

---

## 7. Security Architecture

### 7.1 Authentication Security

- Passwords hashed by Supabase Auth (bcrypt)
- Rate limiting on login endpoint (Supabase built-in)
- Brute force protection via exponential backoff
- Email verification required before access
- No password stored in application database

### 7.2 API Security

**WhatsApp Webhook Validation:**
- Every incoming webhook is verified using the `X-Hub-Signature-256` header
- Supabase Edge Function validates HMAC-SHA256 signature against `WHATSAPP_APP_SECRET`
- Requests without valid signature return 403 immediately
- Verification happens before any database write

**n8n to Supabase:**
- n8n uses Supabase service role key stored in n8n credentials vault
- Never expose service role key to frontend
- n8n should only access tables it needs (principle of least privilege)

**Next.js API Routes:**
- All routes require valid Supabase session
- Role checked against the requested resource
- No credentials stored in Next.js code — only in environment variables

### 7.3 Data Security

**At-Rest Encryption:**
- WhatsApp access tokens stored encrypted in workspaces table (AES-256)
- Supabase Storage objects server-side encrypted
- API keys never stored plain text — use Supabase Vault for secrets

**In-Transit:**
- All connections HTTPS/TLS 1.3
- Supabase Realtime uses WSS
- Webhook endpoints only accept HTTPS

**RLS Policies:**
- Every data table has explicit RLS policies
- Default deny — no access unless explicitly granted
- Policies tested with multiple user scenarios during development

### 7.4 Secrets Management

```
Application Secrets:
├── Supabase: Vault for storing workspace-level secrets (WhatsApp tokens)
├── n8n: Built-in credentials vault
├── Next.js: Environment variables (never committed to git)
└── CI/CD: GitHub Secrets for deployment credentials

Never in Code:
├── API Keys
├── Tokens
├── Passwords
└── Service Role Keys
```

### 7.5 Webhook Security

**WhatsApp Webhook Verify:**
```
1. Meta sends GET with hub.mode, hub.challenge, hub.verify_token
2. Supabase Edge Function checks hub.verify_token against workspace verify_token
3. Returns hub.challenge to Meta
4. HTTPS only — Meta rejects HTTP endpoints
```

**Webhook Event Processing:**
```
1. Validate X-Hub-Signature-256 (HMAC)
2. Log raw event to webhook_logs
3. Parse event type
4. Route to appropriate handler
5. Write processed data to Supabase
6. Return 200 immediately (async processing)
```

### 7.6 Future Security Considerations

- Two-Factor Authentication (TOTP)
- Audit logs for all admin actions
- IP allowlisting for agency dashboard
- SOC 2 compliance roadmap
- GDPR data export / right-to-deletion workflows

---

## 8. Feature Modules — Detailed Planning

---

### 8.1 Dashboard

**Purpose:** Central home page after login. Shows the most important KPIs at a glance. Should be immediately useful — not decorative.

#### Layout
```
┌─────────────────────────────────────────────────────┐
│  Sidebar (fixed)  │  Main Content Area              │
│  ─────────────    │  ───────────────────────────    │
│  Logo + Switcher  │  Header: "Good morning, [Name]" │
│  ─────────────    │  Date + Workspace Name          │
│  Nav items        │                                 │
│  ─────────────    │  [Stat Cards Row]               │
│  User profile     │  [Conversations Panel]          │
│                   │  [Leads Summary + Activity]     │
└─────────────────────────────────────────────────────┘
```

#### Stat Cards (Top Row)
Four cards in a responsive 4-column grid (2-column on tablet, 1-column on mobile):

1. **Total Conversations Today** — count + delta vs yesterday (green/red arrow)
2. **Active Leads** — open leads count + new today
3. **Appointments This Week** — count + next upcoming
4. **AI Response Rate** — % of messages answered by AI today

Each card:
- Subtle border, white background
- Icon (Lucide) in muted color
- Large number (28px bold)
- Subtext with trend indicator
- Click navigates to relevant section

#### Recent Conversations Panel
- Last 5 conversations
- Shows: contact name, last message preview, time, unread badge
- "View all chats →" link
- Real-time updates via Supabase Realtime

#### Active Leads Summary
- Kanban column headers with count badges
- Top 3 leads per stage
- "View pipeline →" link

#### Recent Activity Feed
- Timeline of last 10 events (message received, lead status changed, appointment booked)
- Actor type icon (AI robot / agent person / customer)
- Timestamp (relative: "2 min ago")

#### States
- **Loading:** Skeleton cards for all 4 stat cards + skeleton rows in panels
- **Empty (new workspace):** Onboarding checklist: Connect WhatsApp → Configure AI → Add Knowledge Base → Test
- **Error:** Toast notification, retry button on failed cards

---

### 8.2 Live Chat (WhatsApp-Inspired)

**Philosophy:** This is the soul of the product. It must feel like WhatsApp Business for a business owner, not like a generic chat tool.

#### Overall Layout

**Desktop (≥1024px):**
```
┌──────────────────┬────────────────────────────────────────┐
│  Conversation    │         Chat Window                    │
│  List (320px)    │                                        │
│  ─────────────   │   ┌─────────────────────────────────┐  │
│  [Search bar]    │   │  Contact Name         [Actions]  │  │
│  [Filter tabs]   │   │  Status • Phone Number           │  │
│  ─────────────   │   └─────────────────────────────────┘  │
│  [Conversation   │                                        │
│  items...]       │   [Message bubbles area - scroll]      │
│                  │                                        │
│                  │   ┌─────────────────────────────────┐  │
│                  │   │ [Takeover bar if AI paused]      │  │
│                  │   │ Type a message... [Send] [+]     │  │
│                  │   └─────────────────────────────────┘  │
└──────────────────┴────────────────────────────────────────┘
```

**Mobile (< 768px):**
```
Screen 1: Conversation List (full screen)
Screen 2: Chat Window (full screen, slide in from right)
```

#### Conversation List Component

**Header:**
- "Chats" title (bold, 18px)
- Filter icon (opens filter drawer)
- New conversation button (manual, future)

**Search Bar:**
- Full-width input
- Searches: contact name, phone number, last message content
- Real-time filtering (debounced 300ms)
- Shows "No results" empty state with suggestion to check spelling

**Filter Tabs (horizontal scroll on mobile):**
- All / Open / Human Takeover / AI Active / Resolved / Unread

**Conversation Item:**
```
┌─────────────────────────────────────────────────────┐
│ [Avatar/Initials]  [Contact Name]          [Time]   │
│                    [Last message preview] [Unread#] │
│                    [AI badge or Agent badge]         │
└─────────────────────────────────────────────────────┘
```
- Avatar: Contact initials circle (color-coded by name hash) or photo if available
- Unread count: Green pill badge (matches WhatsApp exactly)
- AI Badge: Small "AI" indicator when conversation is AI-controlled
- Human Badge: Small person icon when agent has taken over
- Selected state: Background color change
- Pinned conversations: Pin icon, appear at top
- Right-swipe action (future): Resolve, Archive
- Long-press (mobile): Context menu — Pin, Archive, Block

**Realtime:**
- New message → conversation item moves to top, unread count increments
- Conversation status change → badge updates in real-time
- Typing indicator in conversation list (future: "typing...")

#### Chat Window

**Header:**
```
┌─────────────────────────────────────────────────────┐
│ [←] [Avatar] Contact Name              [⋮ menu]    │
│              +91 98765 43210  • Online/Last seen    │
│              [AI Active ✓] or [Human Mode 🧑]       │
└─────────────────────────────────────────────────────┘
```
- Back arrow (mobile only) returns to conversation list
- Contact name is clickable → opens contact sidebar
- Phone number with click-to-call on mobile
- Online/last seen indicator
- AI mode badge with visual status
- Three-dot menu: View Contact, Add Note, Assign Agent, Archive, Block

**Message Area:**
- Scroll container with auto-scroll to bottom on new messages
- Manual scroll disables auto-scroll, "New message ↓" banner appears
- Date separators (Today, Yesterday, Dec 25, 2024)
- Message grouping: consecutive messages from same sender grouped without avatar repeat

**Inbound Message Bubble (customer — left aligned):**
```
┌──────────────────────────────────┐
│ Message text here that can wrap  │
│ across multiple lines            │
│                          3:42 PM │
└──────────────────────────────────┘
```
- Background: #F0F2F5 (WhatsApp grey)
- Border radius: 0px top-left, 8px others (first in group)
- Timestamp: right-aligned inside bubble, muted color

**Outbound Message Bubble (AI or Agent — right aligned):**
```
                ┌──────────────────────────────────┐
                │ Message text here                │
                │              3:42 PM ✓✓         │
                └──────────────────────────────────┘
```
- AI message: Background #D9FDD3 (WhatsApp green) with "AI" micro-label
- Agent message: Background #E1F3FB (blue tint) with agent initials micro-label
- Delivery status: ✓ sent, ✓✓ delivered, ✓✓ (blue) read
- The AI vs Agent distinction is critical for business owners

**Typing Indicator:**
- Three animated dots in inbound bubble style
- Shows when n8n is processing (n8n can write a 'typing' status to Supabase)

**Message Input Area:**
```
┌──────────────────────────────────────────┐
│ [+] [Type a message...         ] [Send]  │
│ AI: Active | [Pause AI] [Assign]         │
└──────────────────────────────────────────┘
```
- Input: Textarea, auto-grows up to 5 lines, then scrolls
- Send: Disabled when empty, button OR enter (shift+enter for newline)
- When AI is active: Send button enabled, shows "Sending as AI override" warning
- When Human Takeover active: Normal send, no AI involved
- [+] button: Future (images, documents, templates)
- Sticky at bottom, never hidden by keyboard on mobile

**Context Panel (Right sidebar, desktop only ≥1280px):**
- Contact info (name, phone, email)
- Lead status dropdown (inline edit)
- Tags (add/remove inline)
- Notes (expandable textarea, auto-save)
- Appointment button ("Book Appointment")
- Conversation history summary

---

### 8.3 Human Takeover

**This is a mission-critical feature. A missed human takeover means a lost lead.**

#### States

| State | Description | UI Indicator |
|-------|-------------|--------------|
| AI Active | AI is handling the conversation | Green "AI" badge, green dot |
| AI Paused | AI paused, waiting for agent | Orange "Paused" badge |
| Human Takeover | Agent actively responding | Blue "Agent" badge, agent initials |
| Resolved | Conversation closed | Grey "Resolved" badge |

#### Human Takeover Flow

**Trigger 1: Agent Manually Takes Over**
1. Agent clicks "Take Over" button in chat header
2. Confirmation modal: "Are you sure? AI will stop responding."
3. On confirm: `conversations.ai_mode = 'paused'`, `conversations.status = 'human_takeover'`, `conversations.assigned_agent_id = current_user`
4. n8n reads `ai_mode` before every response — sees 'paused', skips AI, does nothing
5. Input area becomes fully active for agent
6. Optional: System message sent to customer: "You are now connected to a human agent."
7. All other agents see "Agent: [Name] is handling this" badge

**Trigger 2: AI Escalates**
- n8n can set `ai_mode = 'paused'` and `status = 'human_takeover'` when it determines it cannot help
- Defined in AI prompt: "If unable to answer after 2 attempts, escalate to human"
- Dashboard agent gets notification (browser notification + in-app badge)

**Resume AI Flow**
1. Agent clicks "Resume AI" button
2. Confirmation: "AI will resume. Make sure customer is informed."
3. Sets `ai_mode = 'enabled'`, `status = 'open'`, `assigned_agent_id = null`
4. n8n picks up next incoming message with AI
5. AI resume message sent to customer (configurable)

#### Human Takeover UI Elements

**Takeover Banner (in Chat Window when status = 'human_takeover'):**
```
┌─────────────────────────────────────────────────────┐
│ 🧑 Human Mode Active — You are handling this chat  │
│ [Resume AI]              Assigned: You              │
└─────────────────────────────────────────────────────┘
```
Color: Blue background, white text. Sticky below chat header.

**AI Paused Banner:**
```
┌─────────────────────────────────────────────────────┐
│ ⏸ AI Paused — Waiting for agent response           │
│ [Take Over]  [Resume AI]     Unassigned             │
└─────────────────────────────────────────────────────┘
```
Color: Orange/amber background.

**Conversation List Visual:**
- Human takeover conversations: Orange left border in conversation list
- AI paused: Amber dot
- Unread + Human takeover: Both indicators visible

**Notifications (future but planned):**
- Browser push notification when new message arrives in human takeover conversation
- In-app notification bell (unread count badge on Chats nav item)
- `unread_count` column on conversations table drives this

#### Agent Online Status (future planned)
- `workspace_members.is_online` BOOLEAN
- Set to true when agent loads dashboard, false on logout/idle timeout
- Shown in conversation header: "Agent: Priya (Online)"

---

### 8.4 Lead CRM & Pipeline

#### Pipeline Board (Kanban View)

**Default Stages (customizable per workspace):**
1. New Lead
2. Contacted
3. Qualified
4. Proposal Sent
5. Won
6. Lost (separate collapsed column)

**Layout:**
```
[+New Lead]                                    [Table View] [Board View]
──────────────────────────────────────────────────────────────────────
New(12) │ Contacted(8) │ Qualified(5) │ Proposal(3) │ Won(7)  │ Lost
─────── │ ──────────── │ ──────────── │ ─────────── │ ─────── │ ────
[Card]  │ [Card]       │ [Card]       │ [Card]       │ [Card]  │
[Card]  │ [Card]       │              │              │         │
[+]     │ [+]          │ [+]          │ [+]          │         │
```

**Lead Card:**
```
┌───────────────────────────────────┐
│ [Source icon]  Rajesh Kumar       │
│ +91 98765 43210                   │
│ "3BHK in Bandra"                  │
│ ─────────────────────────────     │
│ 🏷️ Hot Lead  📅 Dec 30            │
│ 👤 Assigned: Priya   💰 ₹45L      │
└───────────────────────────────────┘
```
- Drag-and-drop between stages (uses `pipeline_order`)
- Click opens Lead Detail Drawer (right panel)
- Color-coded left border by priority/tag

**Filters & Sort:**
- Search by name, phone
- Filter by: Stage, Assigned Agent, Tag, Source, Date Range, Value Range
- Sort by: Created date, Value, Last activity

**Lead Detail Drawer / Page:**
```
┌─────────────────────────────────────────────────────┐
│ [←Back]  Rajesh Kumar          [Edit] [Delete]      │
│ ─────────────────────────────────────────────────── │
│ Status: [Qualified ▼]          Source: WhatsApp     │
│ Assigned: [Priya ▼]            Value: [₹45L]        │
│ Close Date: [Jan 15 ▼]                              │
│ Tags: [Hot] [+Add Tag]                              │
│ ─────────────────────────────────────────────────── │
│ NOTES                                               │
│ [Textarea — auto-save]                              │
│ ─────────────────────────────────────────────────── │
│ QUALIFICATION DATA                                  │
│ Budget: ₹40L–₹50L                                  │
│ Location: Bandra / Andheri                         │
│ BHK: 3                                              │
│ ─────────────────────────────────────────────────── │
│ ACTIVITY TIMELINE                                   │
│ [Timeline entries]                                  │
│ ─────────────────────────────────────────────────── │
│ CONVERSATION                                        │
│ [Link to conversation]                              │
│ [Last 3 messages preview]                           │
└─────────────────────────────────────────────────────┘
```

**Activity Timeline:**
- Chronological list of all events
- Icons: message bubble, status change, note, appointment, AI action
- "Added a note: [note text]" / "Status changed from New → Qualified by Priya"
- Relative timestamps with full date on hover

**Table View:**
Responsive table with:
- Checkbox for bulk actions
- Columns: Name, Phone, Status, Source, Assigned, Value, Last Activity, Actions
- Sortable columns
- Bulk actions: Change Status, Assign Agent, Export, Delete
- On mobile: Converts to cards automatically

---

### 8.5 Contacts

**Different from Leads:** Contacts are all people who have ever interacted. Leads are structured deal opportunities linked to contacts.

#### Contact List

**Header:**
- Search bar (name, phone, email)
- Filter: Tags, Source, Last Seen, Lead Score
- Sort: Name, Created, Last Seen, Lead Score
- [Import CSV] button
- [+New Contact] button

**Contact Item (table row / mobile card):**
- Avatar + Name
- Phone number (with flag for country)
- Email (if available)
- Tags (pill badges, max 3 visible + "+N more")
- Lead score bar (0–100 visualized)
- Last seen timestamp
- Source icon (WhatsApp / Manual / CSV)
- Actions: View, Add Note, Start Conversation, Delete

**Contact Detail Page `/workspace/[id]/contacts/[contactId]`:**
```
┌──────────────────────────────────────────────────────┐
│ [Avatar Large]  Rajesh Kumar                [Edit]  │
│                 +91 98765 43210                      │
│                 rajesh@email.com                     │
│ ─────────────────────────────────────────────────── │
│ Lead Score: [====────────] 42/100                   │
│ ─────────────────────────────────────────────────── │
│ Tags: [Investor] [Hot] [Mumbai] [+Add]              │
│ ─────────────────────────────────────────────────── │
│ NOTES                     LEADS                     │
│ [Textarea, auto-save]     [Lead cards]              │
│ ─────────────────────────────────────────────────── │
│ CONVERSATION HISTORY      APPOINTMENTS              │
│ [Recent messages]         [Upcoming + past]         │
│ ─────────────────────────────────────────────────── │
│ CUSTOM FIELDS (from qualification data)             │
│ Budget: ₹40–₹50L                                   │
└──────────────────────────────────────────────────────┘
```

---

### 8.6 Appointments & Calendar

#### Appointments List View

**Tabs:**
- Upcoming / Today / Past / Cancelled

**Appointment Card:**
```
┌──────────────────────────────────────────────────────┐
│ Dec 30, 2024 — 11:00 AM                [Confirmed ✓]│
│ Site Visit — Rajesh Kumar                            │
│ 📞 +91 98765 43210                                   │
│ 👤 Agent: Priya Singh                               │
│ 📍 BKC Office                                        │
│ [View Details] [Reschedule] [Cancel]                 │
└──────────────────────────────────────────────────────┘
```

**Appointment Status Colors:**
- Scheduled: Blue
- Confirmed: Green
- Rescheduled: Orange
- Cancelled: Red
- Completed: Grey
- No Show: Red/strikethrough

#### New Appointment Modal

**Fields:**
- Contact (search dropdown, required)
- Title (required)
- Date & Time (date picker + time picker)
- Duration (15 / 30 / 45 / 60 / 90 / 120 min)
- Assigned Agent
- Location / Meeting Link
- Notes
- Send confirmation to customer (toggle)

**Availability Check:**
- When date/time selected, check Google Calendar via edge function
- Show blocked slots in red, available in green
- Warning if slot conflicts

#### Calendar View

**Week/Day view** (not full calendar builder — reuse a lightweight calendar component)
- Shows appointments as colored blocks
- Click block → appointment detail
- Drag to reschedule (future)

#### Google Calendar Sync

**Setup flow:**
1. Settings → Integrations → Connect Google Calendar
2. OAuth 2.0 popup
3. Select which calendar to sync to
4. All new appointments auto-create Google Calendar event
5. Cancellations/rescheduling propagate to Google Calendar
6. `google_calendar_event_id` stored for bidirectional reference

---

### 8.7 AI Settings

**This is where agency staff configures the AI brain for each client. It must be powerful but not intimidating.**

#### Page Layout

```
┌──────────────────────────────────────────────────────┐
│  AI Settings — [Client Name]                        │
│  ─────────────────────────────────────────────────  │
│  AI Status: [ENABLED ●] Toggle                      │
│  ─────────────────────────────────────────────────  │
│  TABS: [System Prompt] [Behavior] [Messages] [Hours]│
└──────────────────────────────────────────────────────┘
```

#### Tab: System Prompt

- Large monospace textarea (code editor feel)
- Character counter (with warning at 80% of token limit)
- [Preview in Playground] button (future: test AI response)
- Variable hints: `{{business_name}}`, `{{contact_name}}`
- Template presets dropdown: Real Estate / Clinic / Education / Restaurant
- Auto-save indicator

#### Tab: Behavior

| Setting | Control | Notes |
|---------|---------|-------|
| AI Model | Dropdown | GPT-4o / GPT-3.5-turbo / GPT-4-turbo |
| Temperature | Slider (0–2) | Label: Precise ←→ Creative |
| Max Response Length | Slider (100–1000 tokens) | |
| Language | Dropdown | English / Hindi / Arabic / etc. |
| Lead Qualification | Toggle | Collects name, budget, requirements |
| Appointment Booking | Toggle | Requires Google Calendar |
| Knowledge Base | Toggle | Use KB in responses |
| Fallback Escalation | Toggle | Auto-escalate if AI fails twice |

#### Tab: Messages

- Welcome Message (sent to new contacts)
- Fallback Message (when AI cannot answer)
- Human Handoff Message (when escalating)
- AI Resume Message (when resuming after agent)
- Outside Hours Message

Each field: Textarea with character count, emoji picker (future), variable hints.

#### Tab: Business Hours

- Day-by-day toggles (Mon–Sun)
- For each enabled day: start time + end time picker
- Timezone selector
- "Outside hours" behavior: Reply with message / Don't reply / Always reply

#### Save & Sync

- Changes saved to `ai_configurations` table
- n8n reads from Supabase on each message — no deployment needed
- Toast: "AI settings updated. Changes take effect immediately."

---

### 8.8 Knowledge Base

**Purpose:** Feed the AI with business-specific information to answer customer questions accurately.

#### Page Layout

```
┌──────────────────────────────────────────────────────┐
│  Knowledge Base                     [+ Add New]      │
│  ─────────────────────────────────────────────────  │
│  TABS: [All] [FAQs] [Website] [Documents] [CSV]     │
│  ─────────────────────────────────────────────────  │
│  Search Knowledge Base...                           │
│  ─────────────────────────────────────────────────  │
│  [KB Items list]                                     │
└──────────────────────────────────────────────────────┘
```

#### KB Item Types

**FAQ (Manual Entry)**
- Question (text input)
- Answer (textarea)
- Category (optional)
- Active/Inactive toggle

**Website Sync**
- URL input
- Fetch content button (calls edge function)
- Shows: Last synced date, content preview, word count
- Auto-sync: Daily or Manual

**Document (PDF — Future)**
- Upload PDF
- Auto-extract text
- Shows page count, word count
- Status: Processing / Active

**CSV Upload (Properties / Menu / Services)**
- Upload CSV
- Map columns (Name, Description, Price, etc.)
- Preview first 5 rows
- Import

#### KB Stats
- Total items count
- Active items count
- Total token estimate
- Warning if too many tokens (model context limit)

---

### 8.9 Analytics

**Philosophy:** Business owners are not analysts. Show them what matters in plain language.

#### Time Range Selector
- Today / Yesterday / Last 7 days / Last 30 days / Custom range

#### Overview Cards (top row)
Same style as dashboard stat cards:
- Total Messages (In + Out)
- New Leads
- Appointments Booked
- AI Response Rate %

#### Charts Section

**Messages Over Time** (Line chart)
- X: Days
- Y: Message count
- Two lines: Inbound (blue) / Outbound (green)

**Lead Funnel** (Funnel or bar chart)
- New → Contacted → Qualified → Proposal → Won
- Conversion rate between each stage

**AI vs Human Messages** (Donut chart)
- % AI-generated vs agent-sent
- Shows AI efficiency

**Appointments Status** (Bar chart)
- Scheduled / Confirmed / Completed / Cancelled / No-show

**Response Time Distribution** (Histogram)
- AI: Fast (typically <5s)
- Human: Variable
- Average response time displayed as stat

**Top Performing Days** (Heatmap — future)

#### Export
- [Export CSV] button for each chart's data
- Date range respects current filter

---

### 8.10 Enquiries

**Purpose:** Unified view of all inbound leads from any source, designed for business owners who primarily care about "who enquired and what happened."

#### Page Layout

```
┌──────────────────────────────────────────────────────┐
│  Enquiries                          [Export] [Filter]│
│  ─────────────────────────────────────────────────  │
│  Quick Stats: Today(12) | This Week(45) | Total(230)│
│  ─────────────────────────────────────────────────  │
│  [Table with filters]                               │
└──────────────────────────────────────────────────────┘
```

#### Table Columns

| Column | Notes |
|--------|-------|
| Name | Contact name, clickable |
| Phone Number | With click-to-call on mobile |
| Email | Nullable |
| Source | WhatsApp / Google Sheets / Manual badge |
| Appointment Date | Formatted, with time |
| Status | Colored badge dropdown (inline edit) |
| Assigned Agent | Dropdown (inline assign) |
| Notes | Preview + expand |
| Conversation | [View] link icon |
| Actions | Three-dot menu |

**Mobile View:**
- Table converts to stacked cards
- Most important info: Name, Phone, Status, Date
- Expandable card for full details

**Deduplication Logic:**
- Backend checks `(workspace_id, phone_number)` before insert
- If duplicate: Update existing record, append to notes: "Also received from Google Sheets on [date]"
- Clear indicator: "Synced from Google Sheets" badge

**Filters Drawer:**
- Source (multi-select)
- Status (multi-select)
- Date range
- Assigned agent
- Has appointment

**Export:**
- Export current view to CSV
- Column order matches table

---

### 8.11 Settings

#### Settings Navigation (left sub-menu or tabs)

- Workspace Settings
- WhatsApp Configuration
- Integrations (Google Calendar, Google Sheets)
- Team Members (future)
- Notifications (future)
- Billing (agency owner only)
- Danger Zone

#### Workspace Settings Form
- Business Name
- Business Type (dropdown)
- Timezone
- Language
- Logo Upload
- Phone Number (display)

#### WhatsApp Configuration
- Phone Number ID (read-only after setup)
- Status: Connected ✓ / Not Connected ✗
- [Reconnect] button
- Webhook URL (read-only, copy button)
- [Test Webhook] button (sends test message)

#### Integrations

**Google Calendar Card:**
```
┌────────────────────────────────────────┐
│ 📅 Google Calendar              [●●●] │
│ Status: Connected                      │
│ Calendar: Work Appointments           │
│ Last sync: 2 min ago                   │
│ [Disconnect]  [Change Calendar]        │
└────────────────────────────────────────┘
```

**Google Sheets Card:**
```
┌────────────────────────────────────────┐
│ 📊 Google Sheets               [●●●] │
│ Status: Connected                      │
│ Sheet: "Leads 2024"                   │
│ Auto-sync: Enabled [Toggle]            │
│ [Disconnect]  [Change Sheet]           │
└────────────────────────────────────────┘
```

#### Team Members (future)

Placeholder section:
```
┌──────────────────────────────────────────────────────┐
│ Team Members                           [+Invite]    │
│ ─────────────────────────────────────────────────   │
│ This feature is coming soon. You'll be able to     │
│ invite agents and assign conversations.             │
└──────────────────────────────────────────────────────┘
```

#### Danger Zone
- Delete Workspace (with confirmation: type workspace name)
- Clear all conversations (separate confirmation)

---

## 9. UI/UX Design System

### 9.1 Design Philosophy

**Inspired by:** Linear, Stripe, Apple — characterized by:
- Generous whitespace
- High information density without clutter
- Monochrome base with single accent color
- Typography does the heavy lifting
- Borders over shadows (lighter feel)
- Micro-interactions that confirm actions, not decorate

**NOT inspired by:** Dashboard templates with gradients, too many colors, large empty hero sections, excessive card shadows, colorful backgrounds.

### 9.2 Color System

```css
/* Base */
--color-background: #FFFFFF;
--color-surface: #FAFAFA;       /* Card backgrounds */
--color-surface-2: #F4F4F5;     /* Subtle dividers */
--color-border: #E4E4E7;        /* Card borders */
--color-border-hover: #D1D5DB;

/* Text */
--color-text-primary: #09090B;   /* Near black */
--color-text-secondary: #71717A; /* Muted */
--color-text-tertiary: #A1A1AA;  /* Placeholder */

/* Accent */
--color-accent: #18181B;        /* Primary action — refined black */
--color-accent-hover: #27272A;
--color-accent-fg: #FFFFFF;

/* Status */
--color-success: #16A34A;
--color-success-bg: #F0FDF4;
--color-warning: #D97706;
--color-warning-bg: #FFFBEB;
--color-error: #DC2626;
--color-error-bg: #FEF2F2;
--color-info: #2563EB;
--color-info-bg: #EFF6FF;

/* WhatsApp Chat */
--color-bubble-inbound: #F0F2F5;
--color-bubble-outbound-ai: #D9FDD3;
--color-bubble-outbound-agent: #DCF8C6;

/* AI/Human Mode Indicators */
--color-ai-active: #16A34A;     /* Green */
--color-human-takeover: #2563EB; /* Blue */
--color-ai-paused: #D97706;     /* Amber */
```

### 9.3 Typography

```css
/* Font Stack */
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace; /* AI prompt editor */

/* Scale */
--text-xs: 11px / 1.4;     /* Badges, timestamps */
--text-sm: 13px / 1.5;     /* Body small, labels */
--text-base: 14px / 1.6;   /* Body default */
--text-md: 15px / 1.5;     /* Chat messages */
--text-lg: 18px / 1.4;     /* Section headings */
--text-xl: 24px / 1.3;     /* Stat numbers */
--text-2xl: 30px / 1.2;    /* Page titles */

/* Weights */
--font-regular: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### 9.4 Component Specifications

#### Button Variants

**Primary:**
- Background: `--color-accent` (black)
- Text: white
- Hover: slightly lighter black
- Disabled: 40% opacity
- Sizes: sm (28px) / md (36px) / lg (44px)

**Secondary:**
- Background: transparent
- Border: `--color-border`
- Text: `--color-text-primary`

**Destructive:**
- Background: `--color-error`
- Text: white
- Only in danger zones and confirmations

**Ghost:**
- No background/border
- Text: `--color-text-secondary`
- Hover: `--color-surface`

#### Input Fields

- Height: 36px (md), 32px (sm)
- Border: 1px solid `--color-border`
- Border radius: 6px
- Focus: Ring 2px `--color-accent`
- Error: Border red, error text below
- Placeholder: `--color-text-tertiary`

#### Cards

- Background: `--color-background`
- Border: 1px solid `--color-border`
- Border radius: 8px
- No default shadow (shadow only on hover for interactive cards)
- Padding: 16px (sm) / 24px (md)

#### Modals / Dialogs

- Backdrop: black 40% opacity
- Card: white, 8px border radius
- Max width: 480px (sm) / 640px (md) / 800px (lg)
- Animation: scale-in from 95% + fade (Framer Motion)
- Close: X button top-right + ESC key + backdrop click

#### Badges

- Height: 20px
- Border radius: 10px (pill)
- Padding: 0 8px
- Text: 11px semibold uppercase
- No border — background color conveys status

#### Sidebar

- Width: 240px fixed (desktop), 280px (tablet slide-out)
- Background: `--color-surface` (#FAFAFA)
- Right border: 1px `--color-border`
- Logo area: 52px height
- Nav item height: 36px
- Nav item: Icon (16px) + Label
- Active state: `--color-surface-2` background, accent-colored icon
- Hover state: `--color-surface-2` background transition 100ms

#### Animations (Framer Motion — used sparingly)

| Interaction | Animation |
|-------------|-----------|
| Modal open/close | Scale 0.95→1 + opacity 0→1, 150ms ease-out |
| Page transition | Fade 0→1, 150ms |
| Sidebar slide (mobile) | Translate X -100%→0, 200ms ease-out |
| Conversation switch | Content fade, 100ms |
| Toast notification | Slide up from bottom, 200ms |
| New message | Slide up from bottom in chat, 200ms |
| Stat card load | Count up animation, 600ms |
| Kanban drag | CSS transform, no Framer needed |

**No:** Bounce effects, heavy parallax, page flip animations, spinning loaders on simple actions.

### 9.5 Loading States

**Skeleton loading** is used for ALL content that loads from the server. No blank white spaces.

**Skeleton patterns:**
- Text line: rounded grey bar, 60–90% width, varying heights
- Card: full card outline with skeleton internals
- Avatar: grey circle
- Image: grey rectangle
- Pulsing animation: 1.5s ease-in-out infinite

**Specific loading states:**
- Conversation list: 5 skeleton conversation items
- Chat messages: 8 skeleton message bubbles (alternating left/right)
- Dashboard stats: 4 skeleton stat cards
- Table: 8 skeleton rows with same column widths

**Spinner:** Used only for button loading states (inline, small)

### 9.6 Empty States

Every empty state has:
1. Centered icon (Lucide, large, muted color)
2. Headline: Clear, direct
3. Subtext: What to do next
4. Primary action button (if applicable)

**Examples:**

*No conversations:*
```
💬
No conversations yet
Connect your WhatsApp number and start automating
[Configure WhatsApp →]
```

*No leads:*
```
🎯
Your pipeline is empty
Leads from WhatsApp conversations will appear here
[Import Leads] [Add Manually]
```

*Knowledge base empty:*
```
📚
No knowledge base items
Add FAQs, website content, or documents for the AI to use
[+ Add FAQ] [Sync Website]
```

### 9.7 Error States

**Inline errors (form fields):**
- Red text below field
- Icon: ⚠️ before text
- Never use "Error:" prefix — just state the problem directly

**Page-level errors:**
- Centered card with error icon
- "Something went wrong" headline
- Specific message if available
- [Try again] and [Contact Support] buttons

**Network errors:**
- Toast notification (red, auto-dismiss 5s)
- "Check your connection and try again"

**Toast notifications (Sonner):**
- Success: Green left border
- Error: Red left border
- Info: Blue left border
- Warning: Amber left border
- Duration: 4s default, 8s for important
- Position: Bottom-right (desktop), Bottom-center (mobile)

---

## 10. Mobile-First Design Specification

### 10.1 Philosophy

**Mobile-first, not mobile-compatible.** The mobile experience is designed first. Desktop is an enhancement, not the reference. For business owners who check WhatsApp on their phone, this CRM should feel like a native app.

### 10.2 Navigation

**Desktop:** Fixed left sidebar (240px)

**Mobile (< 768px):** Bottom navigation bar

```
┌─────────────────────────────────────────────────────┐
│                    Content Area                     │
│                                                     │
│                                                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│ 💬Chats   🎯Leads  📊Stats  ☰More                  │
│ (badge)                       (→Dashboard,Settings)│
└─────────────────────────────────────────────────────┘
```

"More" opens a bottom sheet with: Dashboard, Contacts, Appointments, KB, AI Settings.

**Tap targets:** Minimum 44x44px for all interactive elements.

### 10.3 Chat on Mobile (WhatsApp-Like)

**Conversation List (full screen):**
- Swipe-to-reveal actions (Resolve, Pin) — planned with CSS for future gesture
- Pull-to-refresh
- Sticky search bar
- Filter pills (horizontal scroll, no text truncation)

**Chat Window (full screen, slides in):**
- Top: Header with back button, contact name, status badge
- Middle: Scrolling message area (full height minus header and input)
- Bottom: Sticky input bar above system keyboard (handles iOS keyboard avoidance)
- Header stays fixed during scroll

**Keyboard Behavior:**
- On iOS: `env(safe-area-inset-bottom)` for input bar position
- Input bar lifts when keyboard opens, chat scrolls to show latest message
- Message area height adjusts dynamically

**Text Input on Mobile:**
- Textarea grows to 3 lines max, then scrolls
- Send button always visible (right of input)
- No desktop shortcuts (Ctrl+Enter) — tap Send

### 10.4 Tables → Cards on Mobile

All tables (Contacts, Leads list, Analytics, Enquiries) automatically convert to vertical card stacks on mobile:

```
Desktop Table Row:               Mobile Card:
[Name] [Phone] [Status] [Date]  ┌────────────────────┐
                                │ Rajesh Kumar       │
                                │ +91 98765 43210    │
                                │ Qualified • Dec 30 │
                                │ [View] [Edit]      │
                                └────────────────────┘
```

Tailwind responsive classes drive this: `hidden md:table-row` / `block md:hidden`

### 10.5 Touch Interactions

| Gesture | Action | Status |
|---------|--------|--------|
| Tap | Primary action | MVP |
| Swipe right (conversation list) | Resolve | Future (planned in data model) |
| Swipe left (conversation list) | Archive | Future |
| Long press (conversation) | Context menu | Future |
| Pull to refresh | Reload data | MVP |
| Pinch zoom | Disabled in CRM | — |
| Double tap (message) | React with emoji | Future |

### 10.6 Performance on Mobile

- Images lazy loaded
- Virtual scrolling for conversation list (react-virtualized or @tanstack/virtual)
- Debounced search (300ms)
- Skeleton loading for all async content
- No blocking requests on navigation
- Next.js App Router streaming for progressive page loads

---

## 11. Google Sheets Integration

### 11.1 Architecture

```
n8n Workflow:
1. AI books appointment OR qualifies lead
2. n8n → Google Sheets API: append/update row
3. n8n → Supabase: insert/upsert enquiry + lead
4. Row ID stored in both places for bidirectional sync

Optional Sync Flow (Google Sheets → CRM):
1. Scheduled n8n trigger (every 30 min / manual)
2. n8n reads new/modified rows from Google Sheets
3. n8n writes to Supabase enquiries table
4. Deduplication by phone_number + workspace_id
5. Supabase Realtime pushes update to dashboard
```

### 11.2 Deduplication Strategy

**Problem:** AI books appointment → writes to Google Sheets → n8n also writes to Supabase → sheet sync runs again → would create duplicate.

**Solution: UPSERT with unique constraint**
- `enquiries` table: UNIQUE constraint on `(workspace_id, phone_number, source)`
- On every Google Sheets sync: INSERT with `ON CONFLICT DO UPDATE`
- Lead table: check by `(workspace_id, contact_id)` — one lead per contact
- `google_sheets_row_id` stored on both `leads` and `enquiries` tables

### 11.3 Google Sheets Column Mapping

Standard Google Sheet columns expected:
| Sheet Column | Supabase Field |
|-------------|----------------|
| Name | enquiries.name |
| Phone | enquiries.phone_number |
| Email | enquiries.email |
| Source | enquiries.source |
| Appointment Date | enquiries.appointment_date / appointments.start_time |
| Status | enquiries.status |
| Agent | enquiries.assigned_agent_id (lookup by name) |
| Notes | enquiries.notes |
| Row ID | enquiries.google_sheets_row_ref |

### 11.4 Settings

Google Sheets is **optional per workspace**:
- Toggle in Settings → Integrations
- When disabled: All data saved only to Supabase
- When enabled: Dual-write via n8n
- Users can enable/disable without losing historical data

### 11.5 Future Bidirectional Sync

**Phase 3+ Feature** (placeholder in data model now):

```
CRM Update → n8n triggered by Supabase webhook → Google Sheets API update
```

The `google_sheets_row_id` field on both `leads` and `enquiries` makes this possible without additional schema changes.

---

## 12. n8n Automation Architecture

### 12.1 Core Workflows (to be built in n8n)

#### Workflow 1: Incoming Message Handler
```
Trigger: WhatsApp Webhook (POST)
│
├── Validate webhook signature
├── Parse message: extract phone, text, type
├── Find or create contact in Supabase
├── Find or create conversation in Supabase
├── Insert message into Supabase
│
└── Check conversation.ai_mode:
    ├── 'enabled' → Route to AI Handler
    └── 'paused' / 'human_takeover' → Notify agent only
```

#### Workflow 2: AI Response Handler
```
Input: Contact, Conversation, Message
│
├── Load ai_configurations from Supabase (for workspace)
├── Load recent conversation history (last N messages)
├── Load active knowledge_base_items (for workspace)
├── Check business hours → if outside hours, send configured message
│
└── Call OpenAI:
    ├── System prompt from ai_configurations
    ├── Knowledge base context
    └── Conversation history
│
├── Parse OpenAI response
├── Check: Is appointment needed? → Route to Appointment Handler
├── Check: Is escalation needed? → Route to Escalation Handler
├── Insert AI message to Supabase messages table
└── Send message via WhatsApp Cloud API
```

#### Workflow 3: Lead Qualification Handler
```
Triggered by: AI detects qualification complete
│
├── Extract fields: name, email, budget, requirements
├── Create/update contact in Supabase
├── Create lead in Supabase
├── Create enquiry in Supabase
└── (If Google Sheets enabled) → Append to Google Sheet
```

#### Workflow 4: Appointment Booking Handler
```
Triggered by: AI confirms appointment intent
│
├── Parse: date, time, contact info
├── Check Google Calendar availability
├── Book Google Calendar slot
├── Insert appointment in Supabase
├── Insert enquiry in Supabase
├── (If Google Sheets enabled) → Append to Google Sheet
└── Send confirmation message via WhatsApp
```

#### Workflow 5: Status Change Trigger
```
Trigger: Supabase DB Webhook on conversations table
│
├── On ai_mode change to 'human_takeover'
│   └── Send Supabase Realtime event to dashboard
└── On status change
    └── Log to analytics_events
```

### 12.2 n8n Credential Management

Each workspace has its own n8n workflow OR n8n uses workspace lookup by phone number:

**Option A (Recommended for MVP): Single Workflow, Multi-Workspace**
- One n8n webhook endpoint for all workspaces
- First step: lookup `workspaces` by `whatsapp_phone_number_id`
- Load workspace-specific config (OpenAI prompt, Google Calendar credentials)
- Process message in context of that workspace

**Option B: Separate Workflow per Workspace**
- More isolated but harder to maintain
- Better for agencies with highly different client requirements

**For MVP:** Option A. Field for `n8n_webhook_url` in `workspaces` table supports Option B in future.

---

## 13. WhatsApp Cloud API Integration

### 13.1 API Configuration per Workspace

Each workspace has its own WhatsApp Business Account:
- `whatsapp_phone_number_id` — from Meta Developer App
- `whatsapp_access_token` — System User access token (stored encrypted)
- `whatsapp_verify_token` — Random string for webhook verification

### 13.2 Sending Messages

All outbound messages go through WhatsApp Cloud API:
```
POST https://graph.facebook.com/v19.0/{phone_number_id}/messages
Authorization: Bearer {access_token}
Body: {
  messaging_product: "whatsapp",
  to: "{customer_phone}",
  type: "text",
  text: { body: "{message}" }
}
```

n8n handles all outbound sends. The dashboard never calls WhatsApp API directly.

**Exception:** In human takeover mode, agent types in dashboard → Next.js API route → Supabase Edge Function → WhatsApp API. This keeps agent messages going through Supabase (stored before sending) with delivery status updates.

### 13.3 Receiving Messages

WhatsApp sends POST to webhook URL:
```
{phone_number_id} → identifies which workspace
{from} → customer's phone number (becomes contact.whatsapp_id)
{text.body} → message content
{id} → message ID (stored as messages.whatsapp_message_id)
```

### 13.4 Message Status Updates

WhatsApp sends status webhooks: sent → delivered → read

These update `messages.status` in Supabase via n8n → Realtime pushes update to chat UI (delivery ticks).

### 13.5 Unsupported Message Types (MVP)

- Images: Receive notification "Customer sent an image" but not display image
- Documents, Audio, Video: Same
- Stickers: Treat as "unsupported media type"

Future (Phase 2+): Full media handling via Supabase Storage.

---

## 14. Folder Structure

### 14.1 Root Structure

```
crm-platform/
├── apps/
│   └── web/                    # Next.js 15 application
├── packages/
│   ├── ui/                     # Shared UI components (future monorepo)
│   ├── types/                  # Shared TypeScript types
│   └── utils/                  # Shared utilities
├── supabase/
│   ├── migrations/             # SQL migrations
│   ├── functions/              # Edge Functions
│   └── seed/                   # Seed data
├── n8n/
│   └── workflows/              # Exported n8n workflow JSON files
├── docs/
│   ├── PROJECT_SPEC.md         # This file
│   ├── API.md                  # API documentation
│   └── DEPLOYMENT.md           # Deployment guide
├── .env.example
├── .gitignore
└── README.md
```

### 14.2 Next.js App Structure

```
apps/web/
├── app/                                # Next.js 15 App Router
│   ├── (auth)/                         # Auth route group
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   └── forgot-password/
│   │       └── page.tsx
│   │
│   ├── (dashboard)/                    # Protected route group
│   │   ├── layout.tsx                  # Dashboard shell (sidebar + header)
│   │   ├── agency/
│   │   │   ├── page.tsx                # Agency overview
│   │   │   └── setup/
│   │   │       └── page.tsx            # New agency onboarding
│   │   │
│   │   └── workspace/
│   │       └── [workspaceId]/
│   │           ├── layout.tsx          # Workspace layout
│   │           ├── dashboard/
│   │           │   └── page.tsx
│   │           ├── chats/
│   │           │   ├── page.tsx        # Chat list
│   │           │   └── [conversationId]/
│   │           │       └── page.tsx    # Individual chat
│   │           ├── leads/
│   │           │   ├── page.tsx        # Pipeline board
│   │           │   └── [leadId]/
│   │           │       └── page.tsx    # Lead detail
│   │           ├── contacts/
│   │           │   ├── page.tsx
│   │           │   └── [contactId]/
│   │           │       └── page.tsx
│   │           ├── appointments/
│   │           │   └── page.tsx
│   │           ├── enquiries/
│   │           │   └── page.tsx
│   │           ├── analytics/
│   │           │   └── page.tsx
│   │           ├── knowledge-base/
│   │           │   └── page.tsx
│   │           ├── ai-settings/
│   │           │   └── page.tsx
│   │           └── settings/
│   │               └── page.tsx
│   │
│   ├── api/                            # Next.js API routes
│   │   ├── webhooks/
│   │   │   └── whatsapp/
│   │   │       └── route.ts            # WhatsApp webhook proxy
│   │   └── messages/
│   │       └── send/
│   │           └── route.ts            # Human message send
│   │
│   ├── globals.css
│   ├── layout.tsx                      # Root layout
│   └── not-found.tsx
│
├── components/
│   ├── ui/                             # shadcn/ui base components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── skeleton.tsx
│   │   ├── toast.tsx
│   │   ├── tabs.tsx
│   │   ├── select.tsx
│   │   └── ...
│   │
│   ├── layout/                         # Layout components
│   │   ├── sidebar.tsx
│   │   ├── mobile-nav.tsx              # Bottom navigation (mobile)
│   │   ├── workspace-switcher.tsx
│   │   ├── user-menu.tsx
│   │   └── top-bar.tsx
│   │
│   ├── chat/                           # Chat module components
│   │   ├── conversation-list.tsx
│   │   ├── conversation-item.tsx
│   │   ├── chat-window.tsx
│   │   ├── message-bubble.tsx
│   │   ├── message-input.tsx
│   │   ├── chat-header.tsx
│   │   ├── takeover-banner.tsx
│   │   ├── typing-indicator.tsx
│   │   ├── date-separator.tsx
│   │   └── contact-context-panel.tsx
│   │
│   ├── leads/                          # Lead CRM components
│   │   ├── pipeline-board.tsx
│   │   ├── pipeline-column.tsx
│   │   ├── lead-card.tsx
│   │   ├── lead-detail-drawer.tsx
│   │   ├── lead-form.tsx
│   │   ├── leads-table.tsx
│   │   └── activity-timeline.tsx
│   │
│   ├── contacts/
│   │   ├── contacts-list.tsx
│   │   ├── contact-card.tsx
│   │   ├── contact-form.tsx
│   │   └── contact-detail.tsx
│   │
│   ├── appointments/
│   │   ├── appointments-list.tsx
│   │   ├── appointment-card.tsx
│   │   ├── appointment-form.tsx
│   │   └── calendar-view.tsx
│   │
│   ├── analytics/
│   │   ├── stat-card.tsx
│   │   ├── messages-chart.tsx
│   │   ├── leads-funnel-chart.tsx
│   │   ├── ai-human-chart.tsx
│   │   └── appointments-chart.tsx
│   │
│   ├── knowledge-base/
│   │   ├── kb-list.tsx
│   │   ├── kb-item-card.tsx
│   │   ├── faq-form.tsx
│   │   └── website-sync-form.tsx
│   │
│   ├── ai-settings/
│   │   ├── prompt-editor.tsx
│   │   ├── behavior-settings.tsx
│   │   ├── message-templates.tsx
│   │   └── business-hours-form.tsx
│   │
│   ├── enquiries/
│   │   ├── enquiries-table.tsx
│   │   └── enquiry-card.tsx
│   │
│   ├── dashboard/
│   │   ├── stat-cards.tsx
│   │   ├── recent-conversations.tsx
│   │   ├── leads-summary.tsx
│   │   └── activity-feed.tsx
│   │
│   └── shared/
│       ├── empty-state.tsx
│       ├── error-state.tsx
│       ├── skeleton-wrapper.tsx
│       ├── confirm-dialog.tsx
│       ├── tag-input.tsx
│       ├── avatar.tsx
│       ├── status-badge.tsx
│       ├── page-header.tsx
│       └── data-table.tsx
│
├── hooks/
│   ├── use-workspace.ts                # Current workspace context
│   ├── use-auth.ts                     # Auth state and actions
│   ├── use-conversations.ts            # Conversations query + realtime
│   ├── use-messages.ts                 # Messages query + realtime
│   ├── use-leads.ts                    # Leads query
│   ├── use-contacts.ts                 # Contacts query
│   ├── use-appointments.ts             # Appointments query
│   ├── use-analytics.ts                # Analytics queries
│   ├── use-ai-settings.ts              # AI config query/mutation
│   ├── use-knowledge-base.ts           # KB query/mutation
│   ├── use-enquiries.ts                # Enquiries query
│   ├── use-realtime.ts                 # Generic Supabase Realtime hook
│   ├── use-human-takeover.ts           # Takeover state machine
│   ├── use-mobile.ts                   # Is mobile breakpoint
│   └── use-debounce.ts                 # Search debounce
│
├── services/
│   ├── supabase/
│   │   ├── client.ts                   # Browser Supabase client
│   │   ├── server.ts                   # Server Supabase client
│   │   ├── conversations.ts            # Conversation queries
│   │   ├── messages.ts                 # Message queries
│   │   ├── leads.ts                    # Lead CRUD
│   │   ├── contacts.ts                 # Contact CRUD
│   │   ├── appointments.ts             # Appointment CRUD
│   │   ├── analytics.ts                # Analytics queries
│   │   ├── ai-settings.ts              # AI config CRUD
│   │   ├── knowledge-base.ts           # KB CRUD
│   │   └── workspaces.ts               # Workspace queries
│   │
│   ├── whatsapp/
│   │   └── send-message.ts             # WhatsApp API helper
│   │
│   └── google/
│       ├── calendar.ts                 # Google Calendar helpers
│       └── sheets.ts                   # Google Sheets helpers
│
├── store/
│   ├── workspace-store.ts              # Current workspace Zustand store
│   ├── ui-store.ts                     # UI state (sidebar open, etc.)
│   └── chat-store.ts                   # Chat draft, scroll position
│
├── types/
│   ├── database.types.ts               # Generated from Supabase
│   ├── workspace.types.ts
│   ├── chat.types.ts
│   ├── lead.types.ts
│   ├── contact.types.ts
│   ├── appointment.types.ts
│   ├── analytics.types.ts
│   └── api.types.ts
│
├── utils/
│   ├── format-date.ts
│   ├── format-phone.ts
│   ├── format-currency.ts
│   ├── lead-score.ts
│   ├── whatsapp-id.ts
│   ├── truncate.ts
│   ├── cn.ts                           # className merger (shadcn utility)
│   └── constants.ts
│
├── config/
│   ├── site.ts                         # Site metadata
│   ├── nav.ts                          # Sidebar navigation config
│   ├── business-types.ts               # Dropdown options
│   └── ai-presets.ts                   # Vertical AI prompt presets
│
├── middleware.ts                        # Auth + workspace routing
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### 14.3 Supabase Structure

```
supabase/
├── migrations/
│   ├── 00001_initial_schema.sql
│   ├── 00002_rls_policies.sql
│   ├── 00003_realtime_setup.sql
│   ├── 00004_indexes.sql
│   └── 00005_triggers.sql
│
├── functions/
│   ├── whatsapp-webhook/               # Webhook receiver + validator
│   │   └── index.ts
│   ├── auth-hook/                      # Custom JWT claims
│   │   └── index.ts
│   ├── send-whatsapp-message/          # Agent message send
│   │   └── index.ts
│   ├── sync-google-sheets/             # Manual sync trigger
│   │   └── index.ts
│   └── analytics-aggregator/           # Daily summary computation
│       └── index.ts
│
└── seed/
    ├── seed-agency.ts
    ├── seed-workspace.ts
    └── seed-demo-data.ts
```

---

## 15. Environment Variables

### 15.1 `.env.example`

```bash
# ============================================================
# CRM Platform — Environment Variables
# ============================================================
# IMPORTANT: Never commit real values. Use this as template.
# Copy to .env.local for development.
# ============================================================


# --- SUPABASE ---
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
SUPABASE_DB_PASSWORD=your_database_password_here


# --- WHATSAPP CLOUD API ---
# From Meta Developer Console → Your App → WhatsApp → Setup
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id_here
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token_here
WHATSAPP_APP_SECRET=your_app_secret_for_webhook_validation
WHATSAPP_VERIFY_TOKEN=your_custom_random_verify_token


# --- OPENAI ---
OPENAI_API_KEY=sk-your_openai_key_here
OPENAI_DEFAULT_MODEL=gpt-4o
OPENAI_DEFAULT_TEMPERATURE=0.7


# --- N8N ---
# The URL where n8n receives WhatsApp webhooks
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/whatsapp
# Secret for validating requests from n8n to Next.js
N8N_WEBHOOK_SECRET=your_n8n_webhook_secret_here
# n8n API for triggering workflows programmatically (future)
N8N_API_URL=https://your-n8n-instance.com/api/v1
N8N_API_KEY=your_n8n_api_key_here


# --- GOOGLE ---
GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/callback/google


# --- APP ---
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXTAUTH_SECRET=your_nextauth_secret_here
NEXTAUTH_URL=https://your-domain.com


# --- FEATURE FLAGS ---
NEXT_PUBLIC_FEATURE_GOOGLE_SHEETS=true
NEXT_PUBLIC_FEATURE_KNOWLEDGE_BASE=true
NEXT_PUBLIC_FEATURE_ANALYTICS=true
NEXT_PUBLIC_FEATURE_APPOINTMENTS=true
# Future features (set false to hide UI elements)
NEXT_PUBLIC_FEATURE_VOICE_AI=false
NEXT_PUBLIC_FEATURE_BROADCASTS=false
NEXT_PUBLIC_FEATURE_PAYMENTS=false
NEXT_PUBLIC_FEATURE_WHITE_LABEL=false


# --- MONITORING (future) ---
SENTRY_DSN=your_sentry_dsn_here
SENTRY_ORG=your_org
SENTRY_PROJECT=crm-platform


# --- EMAIL (future notifications) ---
RESEND_API_KEY=your_resend_api_key_here
EMAIL_FROM=noreply@your-domain.com
```

---

## 16. Development Roadmap

### Phase 1 — Foundation (Weeks 1–4)

**Goal:** Working authentication, core data model, and basic chat UI.

**Priorities:**
1. Supabase project setup + all migrations
2. RLS policies for all tables
3. Next.js project scaffolding (routing, layout, design system)
4. Authentication (login, register, session management, middleware)
5. Agency + Workspace creation flow
6. Sidebar + workspace switcher
7. Supabase Realtime hook setup
8. Basic conversation list + chat window (no n8n yet)
9. Manual message insert to test realtime

**Dependencies:**
- Supabase project created
- Design tokens finalized
- TypeScript types generated from Supabase

**Deliverables:**
- User can register, create agency, create workspace
- Can see (empty) chat UI
- Auth works with RLS

**Acceptance Criteria:**
- Login/logout works
- Protected routes redirect unauthenticated users
- RLS tested: User A cannot see User B's data
- Supabase Realtime: insert to messages table → UI updates without refresh

---

### Phase 2 — Core Features (Weeks 5–9)

**Goal:** Full WhatsApp integration, Human Takeover, Lead CRM, Contacts.

**Priorities:**
1. WhatsApp webhook setup + n8n connection
2. Live incoming messages → database → realtime → UI
3. Outbound agent messages via Supabase Edge Function
4. Human Takeover complete flow
5. Lead pipeline (Kanban + table)
6. Contact management
7. Basic AI settings page
8. Enquiries page with Google Sheets sync placeholder
9. Mobile responsive: chat + navigation

**Dependencies:**
- Phase 1 complete
- n8n instance running
- WhatsApp Business Account configured (can use test number)

**Deliverables:**
- End-to-end: Customer messages → AI responds → Agent can take over
- Leads created manually and from n8n
- Contacts page functional
- Mobile chat experience functional

**Acceptance Criteria:**
- Message from WhatsApp appears in CRM chat within 2 seconds
- Human takeover stops AI responses
- Resume AI restarts AI for next customer message
- Lead pipeline drag-and-drop works
- Mobile chat UI works on iOS and Android browsers

---

### Phase 3 — Intelligence & Automation (Weeks 10–14)

**Goal:** Full AI pipeline, Knowledge Base, Appointments, Analytics.

**Priorities:**
1. Knowledge Base CRUD + AI context injection in n8n
2. Appointment booking with Google Calendar
3. Google Sheets sync (enquiries → CRM)
4. Full Analytics page with charts
5. AI Settings: business hours, model selection
6. Notification system (unread badges, browser notifications)
7. Dashboard stat cards with real data
8. AI vs Human mode visual differentiation complete

**Dependencies:**
- Phase 2 complete
- Google Cloud project with Calendar + Sheets API enabled
- OpenAI API key

**Deliverables:**
- AI answers from Knowledge Base
- Appointments booked via AI, synced to Google Calendar
- Enquiries page populated from WhatsApp + Google Sheets
- Analytics showing real data
- Business hours enforced by n8n

**Acceptance Criteria:**
- AI uses KB content in responses
- Appointment booked by AI appears in Google Calendar
- Same lead from WhatsApp and Google Sheets → single record (no duplicate)
- Analytics charts load within 1 second
- Business hours: AI does not respond outside configured hours

---

### Phase 4 — Polish & Production (Weeks 15–18)

**Goal:** Production-ready, performance-optimized, fully tested.

**Priorities:**
1. Performance audit (Lighthouse ≥90 on mobile)
2. Error handling everywhere (all async operations)
3. Loading states and skeleton screens complete
4. Security audit (RLS policies penetration test)
5. Onboarding flow for new workspaces
6. Settings page complete (integrations, team)
7. E2E tests (Playwright): critical user flows
8. Unit tests (Vitest): utility functions, hooks
9. Documentation: deployment guide, n8n workflow guide
10. Staging environment deployment

**Dependencies:**
- Phase 3 complete
- Real WhatsApp Business Account for testing
- Domain and hosting configured

**Deliverables:**
- Production-deployed staging environment
- All critical flows tested
- Performance budgets met
- Security review passed

**Acceptance Criteria:**
- Lighthouse Performance ≥90 (mobile)
- No console errors in production
- All Playwright tests pass
- 0 known security vulnerabilities in RLS policies
- Onboarding: new user can go from signup to first AI conversation in <15 minutes

---

## 17. Acceptance Criteria

### 17.1 Authentication Module

**Done means:**
- User can register with email + password
- Email verification required before access
- Login works, creates Supabase session
- Incorrect password shows clear error (not "something went wrong")
- Session persists across browser refreshes
- Logout clears session and redirects to /login
- Middleware protects all /workspace/* routes

**Edge Cases:**
- Attempt to access workspace the user doesn't belong to → 403 page
- Expired session → redirect to login with "Session expired" message
- Password reset flow works end-to-end
- Register with existing email → clear error

**Testing Checklist:**
- [ ] Register new user
- [ ] Login with correct credentials
- [ ] Login with wrong password
- [ ] Protected route redirect when unauthenticated
- [ ] Direct URL access to other user's workspace
- [ ] Session persistence after page refresh
- [ ] Logout clears all state

---

### 17.2 Chat Module

**Done means:**
- Conversation list loads with correct ordering (newest first)
- Clicking conversation opens chat window
- Messages load from database, newest at bottom
- New incoming messages appear without refresh (<2s latency)
- Unread count increments on new messages, clears on view
- Send message works in Human Takeover mode
- Search filters conversation list in real-time
- Status filters work (Open, Human Takeover, Resolved)
- Chat is fully functional on mobile

**Edge Cases:**
- Empty conversation (no messages yet) shows empty state
- Very long message wraps correctly in bubble
- Message fails to send → error state + retry option
- Contact has no name (only phone number) → display formatted phone
- Network disconnect → UI shows offline indicator (future)
- Rapid incoming messages → all appear in correct order

**Testing Checklist:**
- [ ] Conversation list correct order
- [ ] Realtime: send WhatsApp → appears in CRM
- [ ] Unread count badge
- [ ] Search conversations
- [ ] Filter by status
- [ ] Human takeover flow
- [ ] Resume AI
- [ ] Send message as agent
- [ ] Mobile layout
- [ ] Date separators appear correctly

---

### 17.3 Human Takeover

**Done means:**
- Clicking "Take Over" immediately pauses AI
- AI does not respond to subsequent customer messages
- Agent can send messages normally
- "Resume AI" restores AI behavior
- Multiple agents see who has taken over
- Status badges update in real-time for all connected sessions

**Edge Cases:**
- Agent takes over → customer sends 3 messages → all 3 received, none answered by AI
- Two agents click Take Over simultaneously → one wins (last write wins on DB)
- Agent closes browser while in takeover → conversation stays in human_takeover state
- Reassign conversation to another agent → both notified

**Testing Checklist:**
- [ ] Take Over stops AI
- [ ] Customer message during takeover does not trigger AI
- [ ] Resume AI restores behavior
- [ ] Status visible to all sessions in real-time
- [ ] Takeover banner visible and correct

---

### 17.4 Lead CRM

**Done means:**
- Kanban board loads with correct stages and lead counts
- Leads can be dragged between stages
- Clicking lead opens detail drawer
- Notes auto-save
- Activity timeline shows all events
- Table view works with sorting and bulk actions
- Lead filters work correctly

**Edge Cases:**
- No leads → empty state per column, not blank
- 100+ leads in one column → virtual scroll or pagination
- Lead deleted → removed from board immediately
- Concurrent update by two users → last write wins, UI reflects correctly

---

### 17.5 Google Sheets Integration

**Done means:**
- When Google Sheets enabled, appointment bookings write to both Supabase and Sheets
- Enquiries page shows leads from both sources
- No duplicate entries for same phone number
- Disabling Google Sheets does not lose existing data
- Sync status visible in Settings → Integrations

**Edge Cases:**
- Google Sheets API rate limit → n8n retries with backoff
- Google Sheet deleted by user → graceful error in settings, no crash
- Same phone appears in Sheets twice → second row updates existing record

---

### 17.6 Analytics

**Done means:**
- All charts load within 1 second for last 30 days
- Date range change updates all charts simultaneously
- Stats match raw data in conversations/leads/appointments tables
- Export CSV contains correct columns and data

**Edge Cases:**
- No data for selected range → empty chart with "No data for this period" message
- Very high message volume → aggregated data from summary table (not raw table scan)

---

## 18. Future Features & Placeholders

The following features are NOT in scope for MVP but must be architecturally supported. Database schema, UI placeholders, and feature flags are prepared now.

### 18.1 Voice AI

**Placeholder:** AI Settings tab with "Voice AI" section showing "Coming Soon" badge.  
**Architecture prep:** `ai_configurations` table has `language` field. Audio message handling noted in message types.

### 18.2 Broadcast Campaigns

**Placeholder:** Sidebar nav item "Broadcasts" with "Coming Soon" badge.  
**Architecture prep:** Template-type messages noted in `messages.content_type`. Contacts table has `is_blocked` for opt-outs.

### 18.3 Template Management

**Placeholder:** Within AI Settings, "Templates" tab with "Coming Soon."  
**Architecture prep:** Separate `message_templates` table can be added in Phase 2+.

### 18.4 Payments & Subscriptions

**Placeholder:** Agency settings shows "Billing" tab with static placeholder.  
**Architecture prep:** `agencies.plan` and `agencies.plan_expires_at` fields exist. Stripe webhook endpoint structure stubbed.

### 18.5 White Label

**Placeholder:** `agencies.custom_domain` field in database.  
**Architecture prep:** `NEXT_PUBLIC_FEATURE_WHITE_LABEL=false` feature flag. Custom domain routing logic commented placeholder in middleware.

### 18.6 Multi-Agent & Team Permissions

**Placeholder:** Settings → Team Members section with "Coming Soon."  
**Architecture prep:** `workspace_members` table fully built. `assigned_agent_id` on conversations and leads. Agent online status field exists.

### 18.7 Audit Logs

**Architecture prep:** `lead_activities` table can be extended for all audit events. `analytics_events` stores system events. `webhook_logs` stores all API events.

### 18.8 Push Notifications

**Placeholder:** Settings → Notifications with "Coming Soon."  
**Architecture prep:** `unread_count` on conversations. Supabase Realtime event structure designed for notification payloads.

### 18.9 Mobile App (React Native)

**Architecture prep:** All business logic in Supabase + n8n, not in Next.js. The mobile app will use same Supabase client. API-first design with no Next.js-specific state management.

### 18.10 Advanced RAG Knowledge Base

**Architecture prep:** `knowledge_base_items.embedding` vector column exists (disabled until pgvector enabled). `token_count` field for context window management. Structure ready for semantic search without schema changes.

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| Agency | The SaaS agency that has purchased this platform to resell WhatsApp automation |
| Workspace | One client business managed within the agency account |
| Conversation | A WhatsApp thread between the business and a customer |
| Contact | A person who has messaged the WhatsApp number |
| Lead | A structured deal/opportunity linked to a contact |
| Enquiry | Any inbound lead regardless of source (WhatsApp/Sheets/manual) |
| Human Takeover | State where AI is paused and an agent handles the conversation manually |
| AI Mode | Whether AI is actively responding (enabled/paused/disabled) |
| n8n | Self-hosted workflow automation tool handling AI and integrations |
| RLS | Row Level Security — PostgreSQL-native tenant isolation |
| Realtime | Supabase's WebSocket push for live UI updates |

---

## Appendix B: API Endpoint Reference (Planned)

All Supabase queries via client SDK. Next.js API routes for:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/webhooks/whatsapp` | POST | Receive WhatsApp webhooks |
| `/api/messages/send` | POST | Agent sends WhatsApp message |
| `/api/conversations/takeover` | POST | Initiate/release human takeover |
| `/api/google/calendar/auth` | GET | Google Calendar OAuth start |
| `/api/google/calendar/callback` | GET | Google Calendar OAuth callback |
| `/api/google/sheets/auth` | GET | Google Sheets OAuth start |
| `/api/google/sheets/sync` | POST | Manual sync trigger |
| `/api/workspaces/[id]/test-whatsapp` | POST | Send test message to verify setup |

---

*END OF DOCUMENT*

---

> **Version:** 1.0.0  
> **Status:** Ready for Development  
> **Next Step:** Run `npx create-next-app@latest` and begin Phase 1 Foundation work using this spec as the single source of truth.
