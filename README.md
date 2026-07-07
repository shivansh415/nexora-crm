# 🏠 WhatsApp CRM — AI-Powered Real Estate Sales Platform

A production-ready multi-tenant CRM with WhatsApp AI automation, lead pipeline management, and intelligent appointment booking.

---

## ✨ Features

| Module | Description |
|---|---|
| 💬 **Chat** | WhatsApp-style inbox with AI/agent toggle, bubble UI, read receipts |
| 🎯 **Leads** | Kanban pipeline with drag-and-drop, deal value, stage management |
| 👥 **Contacts** | Contact table with lead score bar, tags, avatar, source tracking |
| 📅 **Appointments** | AI-booked site visits with status, location, reschedule support |
| 📥 **Enquiries** | Unified inbound inbox from WhatsApp, Google Sheets, manual entry |
| 📊 **Analytics** | Line charts, donut, funnel — messages, leads, appointments, AI rate |
| 📚 **Knowledge Base** | FAQs, website scraping, PDFs — toggle/add/remove with token counter |
| 🤖 **AI Settings** | Model, temperature, system prompt, business hours, feature flags |
| ⚙️ **Settings** | WhatsApp API config, Google Calendar/Sheets integration, notifications |

---

## 🚀 Quick Start (Demo Mode)

```bash
# 1. Install dependencies
npm install

# 2. Copy demo env (no real keys needed)
cp .env.example .env.local
# .env.local is already configured for demo mode

# 3. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it auto-redirects to the demo workspace.

---

## 🗂 Project Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── workspace/[workspaceId]/
│   │       ├── layout.tsx          # Sidebar + mobile nav shell
│   │       ├── dashboard/          # Overview stats + pipeline summary
│   │       ├── chats/              # WhatsApp conversation inbox
│   │       ├── leads/              # Kanban pipeline board
│   │       ├── contacts/           # Contact table
│   │       ├── appointments/       # Appointment scheduler
│   │       ├── enquiries/          # Inbound enquiries
│   │       ├── analytics/          # Charts & metrics
│   │       ├── knowledge-base/     # AI knowledge management
│   │       ├── ai-settings/        # AI configuration
│   │       └── settings/           # Workspace settings
│   ├── error.tsx
│   └── not-found.tsx
├── components/
│   ├── layout/       # sidebar.tsx, mobile-nav.tsx
│   ├── chat/         # chat-view.tsx
│   ├── leads/        # pipeline-board.tsx
│   ├── knowledge-base/
│   └── ai-settings/
├── lib/
│   ├── mock-data.ts  # Demo data (Skyline Realty)
│   ├── supabase/     # client.ts, server.ts
│   └── utils.ts
├── types/
│   ├── database.types.ts   # All 13 table types
│   └── index.ts            # Re-exports + enums
├── components/ui/    # shadcn/ui components (@base-ui/react)
└── proxy.ts          # Next.js 16 middleware (auth + routing)
```

---

## 🗄 Database Setup (Supabase)

```bash
# Run migrations in order in Supabase SQL editor:
supabase/migrations/
  00001_initial_schema.sql   # All 13 tables + enums
  00002_rls_policies.sql     # Row-level security
  00003_indexes_triggers.sql # Indexes + realtime + triggers

# Optional: seed demo data
supabase/seed/seed-demo-data.sql
```

---

## 🔑 Environment Variables

Copy `.env.example` to `.env.local`:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side) |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta WhatsApp Business phone number ID |
| `WHATSAPP_ACCESS_TOKEN` | Meta System User access token |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verify token (any random string) |
| `OPENAI_API_KEY` | OpenAI API key for AI features |
| `N8N_WEBHOOK_URL` | n8n webhook URL for automation |

---

## 🧱 Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui (`@base-ui/react`) |
| Database | Supabase (PostgreSQL + RLS + Realtime) |
| State | TanStack Query v5 |
| Charts | Recharts |
| DnD | dnd-kit |
| Dates | date-fns |
| Toasts | Sonner |

---

## 📱 Demo Credentials (Demo Mode)

No login required in demo mode. The app uses mock data for:
- **Workspace**: Skyline Realty (`ws-001`)
- **Contacts**: 7 realistic real estate leads
- **Conversations**: WhatsApp-style chat threads with AI/agent messages
- **Analytics**: 30 days of synthetic data

---

## 🚀 Production Deployment

1. Add real environment variables to `.env.local`
2. Run Supabase migrations
3. Configure WhatsApp webhook URL in Meta Developer Console to `https://yourdomain.com/api/whatsapp/webhook`
4. Deploy: `npm run build && npm start`

---

## 📄 License

Proprietary — All rights reserved.
