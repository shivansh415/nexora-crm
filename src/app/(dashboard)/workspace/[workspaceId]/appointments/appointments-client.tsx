'use client'

import { useState } from 'react'
import { CalendarDays, MapPin, User, X, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { AppointmentStatus } from '@/types'

const IST = 'Asia/Kolkata'

function formatDateIST(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: IST,
  })
}
function formatTimeIST(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST,
  })
}

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  rescheduled: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-600',
  completed: 'bg-zinc-100 text-zinc-500',
  no_show: 'bg-red-50 text-red-400',
}

export interface AppointmentRow {
  id: string
  title: string
  start_time: string
  end_time: string
  status: AppointmentStatus
  location: string | null
  notes: string | null
  booked_by: string
  contacts: { name: string; phone_number: string } | null
}

export default function AppointmentsClient({ initial }: { initial: AppointmentRow[] }) {
  const [appointments, setAppointments] = useState<AppointmentRow[]>(initial)
  const [viewing, setViewing] = useState<AppointmentRow | null>(null)
  const [cancelling, setCancelling] = useState<AppointmentRow | null>(null)
  const [busy, setBusy] = useState(false)

  const upcoming = appointments.filter((a) => ['scheduled', 'confirmed', 'rescheduled'].includes(a.status))
  const past = appointments.filter((a) => ['completed', 'no_show', 'cancelled'].includes(a.status))

  async function handleCancel() {
    if (!cancelling || busy) return
    const id = cancelling.id
    setBusy(true)
    try {
      const res = await fetch('/api/appointments/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to cancel')
        return
      }
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'cancelled' } : a)))
      toast.success('Appointment cancelled')
      setCancelling(null)
    } catch {
      toast.error('Network error')
    } finally {
      setBusy(false)
    }
  }

  function AppCard({ apt }: { apt: AppointmentRow }) {
    const active = ['scheduled', 'confirmed', 'rescheduled'].includes(apt.status)
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:shadow-sm transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{apt.title}</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {formatDateIST(apt.start_time)} · {formatTimeIST(apt.start_time)} IST
            </p>
          </div>
          <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize', STATUS_STYLES[apt.status])}>
            {apt.status}
          </span>
        </div>
        <div className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <User className="size-3 text-zinc-400 dark:text-zinc-500" />
            <span>{apt.contacts?.name ?? 'Unknown'} · {apt.contacts?.phone_number ?? ''}</span>
          </div>
          {apt.location && (
            <div className="flex items-center gap-2">
              <MapPin className="size-3 text-zinc-400 dark:text-zinc-500" />
              <span>{apt.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <CalendarDays className="size-3 text-zinc-400 dark:text-zinc-500" />
            <span>Booked by {apt.booked_by === 'ai' ? '🤖 AI' : apt.booked_by === 'agent' ? '👤 Agent' : '👤 Customer'}</span>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setViewing(apt)}
            className="rounded px-2.5 py-1 text-[11px] font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors"
          >
            View Details
          </button>
          {active && (
            <button
              onClick={() => setCancelling(apt)}
              className="rounded px-2.5 py-1 text-[11px] font-medium bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Appointments</h1>
        <p className="text-xs text-zinc-500 mt-0.5">{upcoming.length} upcoming · booked automatically by the AI</p>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList className="mb-4">
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past & Cancelled ({past.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.length === 0 ? (
              <div className="col-span-2 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 py-16 text-center">
                <CalendarDays className="size-10 text-zinc-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No upcoming appointments</p>
                <p className="text-xs text-zinc-400 mt-1">The AI books site visits into your calendar automatically</p>
              </div>
            ) : (
              upcoming.map((apt) => <AppCard key={apt.id} apt={apt} />)
            )}
          </div>
        </TabsContent>
        <TabsContent value="past">
          <div className="grid gap-3 sm:grid-cols-2">
            {past.length === 0 ? (
              <div className="col-span-2 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 py-16 text-center">
                <p className="text-sm text-zinc-400">No past appointments</p>
              </div>
            ) : (
              past.map((apt) => <AppCard key={apt.id} apt={apt} />)
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* View details */}
      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) setViewing(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
            <DialogDescription>
              {viewing && `${formatDateIST(viewing.start_time)} · ${formatTimeIST(viewing.start_time)} – ${formatTimeIST(viewing.end_time)} IST`}
            </DialogDescription>
          </DialogHeader>
          {viewing && (
            <DialogBody className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Status</span>
                <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize', STATUS_STYLES[viewing.status])}>{viewing.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Contact</span>
                <span className="font-medium">{viewing.contacts?.name ?? 'Unknown'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Phone</span>
                <span className="font-medium">{viewing.contacts?.phone_number ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Location</span>
                <span className="font-medium">{viewing.location ?? '—'}</span>
              </div>
              {viewing.notes && (
                <div className="space-y-1">
                  <span className="text-zinc-500 dark:text-zinc-400">Notes</span>
                  <p className="rounded-lg bg-zinc-50 p-2.5 text-[13px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{viewing.notes}</p>
                </div>
              )}
            </DialogBody>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel confirm */}
      <Dialog open={!!cancelling} onOpenChange={(o) => { if (!o) setCancelling(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel this appointment?</DialogTitle>
            <DialogDescription>
              This marks the appointment as cancelled in the CRM. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelling(null)} disabled={busy}>Keep it</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={busy} className="gap-1.5">
              {busy ? <><RefreshCw className="size-4 animate-spin" /> Cancelling…</> : <><X className="size-4" /> Cancel appointment</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
