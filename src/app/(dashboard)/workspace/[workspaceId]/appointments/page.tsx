import { Plus, CalendarDays, MapPin, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AppointmentStatus } from '@/types'

interface PageProps {
  params: Promise<{ workspaceId: string }>
}

export const metadata = { title: 'Appointments' }

// Always display appointment times in Indian Standard Time,
// regardless of the server's timezone (Vercel runs in UTC).
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

interface AppointmentRow {
  id: string
  title: string
  start_time: string
  end_time: string
  status: AppointmentStatus
  location: string | null
  booked_by: string
  contacts: { name: string; phone_number: string } | null
}

export default async function AppointmentsPage({ params }: PageProps) {
  const { workspaceId } = await params
  const supabase = await createClient()

  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, title, start_time, end_time, status, location, booked_by, contacts(name, phone_number)')
    .eq('workspace_id', workspaceId)
    .order('start_time', { ascending: true }) as { data: AppointmentRow[] | null; error: unknown }

  const safeAppointments = appointments ?? []
  const upcoming = safeAppointments.filter((a) => ['scheduled', 'confirmed'].includes(a.status))
  const past = safeAppointments.filter((a) => ['completed', 'no_show', 'cancelled'].includes(a.status))

  function AppCard({ apt }: { apt: AppointmentRow }) {
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
        <div className="space-y-1.5 text-xs text-zinc-600">
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
          <button className="rounded px-2.5 py-1 text-[11px] font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors">View Details</button>
          {['scheduled', 'confirmed'].includes(apt.status) && (
            <button className="rounded px-2.5 py-1 text-[11px] font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors">Reschedule</button>
          )}
          {['scheduled', 'confirmed'].includes(apt.status) && (
            <button className="rounded px-2.5 py-1 text-[11px] font-medium bg-red-50 hover:bg-red-100 text-red-600 transition-colors">Cancel</button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Appointments</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{upcoming.length} upcoming</p>
        </div>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-3.5" /> New Appointment
        </Button>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList className="mb-4">
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past & Cancelled ({past.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.length === 0 ? (
              <div className="col-span-2 rounded-lg border border-dashed border-zinc-200 py-16 text-center">
                <CalendarDays className="size-10 text-zinc-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No upcoming appointments</p>
                <p className="text-xs text-zinc-400 mt-1">Book an appointment from a conversation or lead</p>
              </div>
            ) : (
              upcoming.map((apt) => <AppCard key={apt.id} apt={apt} />)
            )}
          </div>
        </TabsContent>
        <TabsContent value="past">
          <div className="grid gap-3 sm:grid-cols-2">
            {past.length === 0 ? (
              <div className="col-span-2 rounded-lg border border-dashed border-zinc-200 py-16 text-center">
                <p className="text-sm text-zinc-400">No past appointments</p>
              </div>
            ) : (
              past.map((apt) => <AppCard key={apt.id} apt={apt} />)
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
