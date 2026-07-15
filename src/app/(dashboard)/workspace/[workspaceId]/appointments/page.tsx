import { createClient } from '@/lib/supabase/server'
import AppointmentsClient, { type AppointmentRow } from './appointments-client'

interface PageProps {
  params: Promise<{ workspaceId: string }>
}

export const metadata = { title: 'Appointments' }

export default async function AppointmentsPage({ params }: PageProps) {
  const { workspaceId } = await params
  const supabase = await createClient()

  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, title, start_time, end_time, status, location, notes, booked_by, contacts(name, phone_number)')
    .eq('workspace_id', workspaceId)
    .order('start_time', { ascending: true }) as { data: AppointmentRow[] | null; error: unknown }

  return <AppointmentsClient initial={appointments ?? []} />
}
