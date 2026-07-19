'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Bell,
  CheckCircle2,
  Zap,
  Info,
  Smartphone,
  Settings as SettingsIcon,
  CalendarDays,
  FileSpreadsheet,
} from 'lucide-react'
import { toast } from 'sonner'

const TABS = [
  { id: 'general',       label: 'General' },
  { id: 'integrations',  label: 'Integrations' },
  { id: 'notifications', label: 'Notifications' },
]

interface WorkspaceData {
  id: string
  name: string
  business_type?: string
  timezone?: string
  n8n_webhook_url?: string | null
  google_calendar_connected?: boolean
  google_sheets_connected?: boolean
  whatsapp_phone_number_id?: string | null
  settings?: { notification_prefs?: Record<string, boolean> } | null
}

interface SettingsClientProps {
  workspaceId: string
  workspace?: WorkspaceData | null
}

const DEFAULT_NOTIFS = {
  new_message: true,
  human_takeover: true,
  new_appointment: true,
  new_lead: false,
}

export default function SettingsClient({ workspaceId, workspace }: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState('general')
  const [n8nUrl, setN8nUrl] = useState(workspace?.n8n_webhook_url ?? '')
  const [savingN8n, setSavingN8n] = useState(false)

  // General settings — editable state so Save actually persists them
  const [wsName, setWsName] = useState(workspace?.name ?? '')
  const [wsBusinessType, setWsBusinessType] = useState(workspace?.business_type?.replace('_', ' ') ?? '')
  const [wsTimezone, setWsTimezone] = useState(workspace?.timezone ?? '')
  const [savingGeneral, setSavingGeneral] = useState(false)

  const [notifs, setNotifs] = useState<typeof DEFAULT_NOTIFS>({
    ...DEFAULT_NOTIFS,
    ...(workspace?.settings?.notification_prefs as Partial<typeof DEFAULT_NOTIFS> | undefined),
  })
  const [savingNotifs, setSavingNotifs] = useState(false)

  async function saveGeneral() {
    setSavingGeneral(true)
    try {
      const res = await fetch('/api/workspace/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          name: wsName,
          business_type: wsBusinessType,
          timezone: wsTimezone,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to save'); return }
      toast.success('Settings saved')
    } catch {
      toast.error('Network error')
    } finally {
      setSavingGeneral(false)
    }
  }

  async function toggleNotif(key: keyof typeof notifs) {
    const next = { ...notifs, [key]: !notifs[key] }
    setNotifs(next)
    setSavingNotifs(true)
    try {
      const res = await fetch('/api/workspace/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, notification_prefs: next }),
      })
      if (!res.ok) {
        // Revert if the server didn't accept it
        setNotifs(notifs)
        toast.error('Failed to save preference')
      }
    } catch {
      setNotifs(notifs)
      toast.error('Network error')
    } finally {
      setSavingNotifs(false)
    }
  }

  async function saveN8nUrl() {
    if (!n8nUrl.trim()) {
      toast.error('Please enter a valid n8n webhook URL')
      return
    }
    setSavingN8n(true)
    try {
      const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const res = await fetch(
        `${sbUrl}/rest/v1/workspaces?id=eq.${workspaceId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ n8n_webhook_url: n8nUrl.trim() }),
        }
      )
      if (res.ok) {
        toast.success('n8n webhook URL saved!')
      } else {
        toast.error('Failed to save — check your session and try again')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSavingN8n(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-3 animate-fade-up">
        <span className="flex size-11 items-center justify-center rounded-2xl text-white shadow-md" style={{ backgroundImage: 'var(--brand-gradient)' }}>
          <SettingsIcon className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">Settings</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Manage workspace configuration and integrations
          </p>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 mb-6">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
              activeTab === id
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── GENERAL ───────────────────────────────────────────────── */}
      {activeTab === 'general' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 shadow-sm dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Workspace Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-600 dark:text-zinc-400">Workspace Name</Label>
                <Input value={wsName} onChange={(e) => setWsName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-600 dark:text-zinc-400">Business Type</Label>
                <Input value={wsBusinessType} onChange={(e) => setWsBusinessType(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-600 dark:text-zinc-400">Timezone</Label>
                <Input value={wsTimezone} onChange={(e) => setWsTimezone(e.target.value)} placeholder="Asia/Kolkata" />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={saveGeneral} disabled={savingGeneral}>
                {savingGeneral ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </div>

        </div>
      )}

      {/* ── INTEGRATIONS ──────────────────────────────────────────── */}
      {activeTab === 'integrations' && (
        <div className="space-y-4">

          {/* n8n — primary integration (prominent card) */}
          <div className="space-y-4 rounded-2xl border-2 border-orange-300 bg-white p-5 shadow-sm dark:border-orange-500/40 dark:bg-zinc-900">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg text-white" style={{ backgroundImage: 'var(--brand-gradient)' }}>
                <Zap className="size-4" />
              </span>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">n8n Webhook</h3>
              <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundImage: 'var(--brand-gradient)' }}>
                REQUIRED
              </span>
            </div>

            <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 px-3.5 py-3 text-xs text-blue-700 dark:text-blue-400 flex items-start gap-2">
              <Info className="size-3.5 shrink-0 mt-0.5" />
              <div>
                <strong>n8n is the single source of truth for all WhatsApp operations.</strong>
                {' '}When you reply in the CRM, the message is forwarded to n8n.
                n8n sends it via WhatsApp, saves it to Supabase, and handles delivery tracking.
                The CRM never calls the WhatsApp Cloud API directly.
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-600 dark:text-zinc-400">
                n8n Webhook URL <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  value={n8nUrl}
                  onChange={(e) => setN8nUrl(e.target.value)}
                  placeholder="https://your-n8n.com/webhook/XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                  className="font-mono text-xs"
                />
                <Button size="sm" onClick={saveN8nUrl} disabled={savingN8n} className="shrink-0">
                  {savingN8n ? 'Saving…' : 'Save'}
                </Button>
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                In n8n: create a Webhook node → set method to POST → copy the production URL here.
                This URL receives <code className="bg-zinc-100 dark:bg-zinc-800 rounded px-1">agent_reply</code> events from the CRM.
              </p>
            </div>

            {n8nUrl && (
              <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 className="size-3.5" />
                Webhook URL configured
              </div>
            )}
          </div>

          {/* WhatsApp info — read-only, managed by n8n */}
          <div className="rounded-2xl border border-zinc-200 shadow-sm dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Smartphone className="size-4 text-green-500" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">WhatsApp Business</h3>
              {workspace?.whatsapp_phone_number_id && (
                <span className="ml-auto flex items-center gap-1.5 rounded-full bg-green-50 dark:bg-green-950/40 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400">
                  <CheckCircle2 className="size-3" /> Connected
                </span>
              )}
            </div>
            <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-3.5 py-3 text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
              <Info className="size-3.5 shrink-0 mt-0.5" />
              <div>
                WhatsApp credentials (Phone Number ID, Access Token) are configured in n8n, not here.
                The CRM does not need them — all WhatsApp communication goes through your n8n workflow.
                {workspace?.whatsapp_phone_number_id && (
                  <span className="block mt-1">
                    Phone Number ID: <code className="bg-zinc-100 dark:bg-zinc-700 rounded px-1">{workspace.whatsapp_phone_number_id}</code>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Google integrations */}
          {[
            {
              name: 'Google Calendar',
              icon: CalendarDays,
              tint: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
              desc: 'AI books site visits into Google Calendar. Managed via n8n Google Calendar credential.',
              connected: workspace?.google_calendar_connected,
            },
            {
              name: 'Google Sheets',
              icon: FileSpreadsheet,
              tint: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
              desc: 'Leads are captured to Google Sheets in real time. Managed via n8n Google Sheets credential.',
              connected: workspace?.google_sheets_connected,
            },
          ].map((integration) => {
            const Icon = integration.icon
            return (
              <div
                key={integration.name}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:border-orange-200 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', integration.tint)}>
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{integration.name}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{integration.desc}</p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                      <CheckCircle2 className="size-3" /> Managed via n8n
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── NOTIFICATIONS ─────────────────────────────────────────── */}
      {activeTab === 'notifications' && (
        <div className="rounded-2xl border border-zinc-200 shadow-sm dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-50 dark:divide-zinc-800">
          <div className="px-5 py-4">
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-zinc-500 dark:text-zinc-400" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Notification Preferences</h3>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Choose which events send you a push notification
            </p>
          </div>
          {[
            { key: 'new_message' as const,     label: 'New WhatsApp message',      desc: 'When a customer sends a new message' },
            { key: 'human_takeover' as const,  label: 'Human takeover requested',  desc: 'When AI requests human intervention' },
            { key: 'new_appointment' as const, label: 'New appointment booked',    desc: 'When AI or customer books an appointment' },
            { key: 'new_lead' as const,        label: 'New lead created',          desc: 'When a new lead is added to the pipeline' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.label}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{item.desc}</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center ml-4 shrink-0">
                <input
                  type="checkbox"
                  checked={notifs[item.key]}
                  onChange={() => toggleNotif(item.key)}
                  className="sr-only peer"
                />
                <div className="peer h-6 w-11 rounded-full bg-zinc-200 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-all after:content-[''] peer-checked:bg-orange-500 peer-checked:after:translate-x-5 dark:bg-zinc-700" />
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
