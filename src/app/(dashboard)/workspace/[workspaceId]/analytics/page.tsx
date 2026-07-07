import AnalyticsClient from './analytics-client'
import { createClient } from '@supabase/supabase-js'

interface PageProps {
  params: Promise<{ workspaceId: string }>
}

export const metadata = { title: 'Analytics' }

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export default async function AnalyticsPage({ params }: PageProps) {
  const { workspaceId } = await params
  const supabase = getAdminSupabase()

  // Build last 30 days of data from live messages table (grouped by day)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Pull all messages from last 30 days
  const { data: messages } = await supabase
    .from('messages')
    .select('direction, is_ai_generated, created_at')
    .eq('workspace_id', workspaceId)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: true }) as {
      data: Array<{ direction: string; is_ai_generated: boolean; created_at: string }> | null; error: unknown
    }

  const { data: leads } = await supabase
    .from('leads')
    .select('created_at')
    .eq('workspace_id', workspaceId)
    .gte('created_at', thirtyDaysAgo.toISOString()) as { data: Array<{ created_at: string }> | null; error: unknown }

  const { data: appointments } = await supabase
    .from('appointments')
    .select('created_at')
    .eq('workspace_id', workspaceId)
    .gte('created_at', thirtyDaysAgo.toISOString()) as { data: Array<{ created_at: string }> | null; error: unknown }

  // Group by date
  const dayMap: Record<string, {
    date: string; total_messages_in: number; total_messages_out: number;
    ai_messages_out: number; agent_messages_out: number; new_leads: number; new_appointments: number; human_takeovers: number;
  }> = {}

  // Generate all 30 days
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    dayMap[key] = { date: key, total_messages_in: 0, total_messages_out: 0, ai_messages_out: 0, agent_messages_out: 0, new_leads: 0, new_appointments: 0, human_takeovers: 0 }
  }

  for (const msg of messages ?? []) {
    const key = msg.created_at.split('T')[0]
    if (!dayMap[key]) continue
    if (msg.direction === 'inbound') {
      dayMap[key].total_messages_in++
    } else {
      dayMap[key].total_messages_out++
      if (msg.is_ai_generated) dayMap[key].ai_messages_out++
      else dayMap[key].agent_messages_out++
    }
  }

  for (const lead of leads ?? []) {
    const key = lead.created_at.split('T')[0]
    if (dayMap[key]) dayMap[key].new_leads++
  }

  for (const apt of appointments ?? []) {
    const key = apt.created_at.split('T')[0]
    if (dayMap[key]) dayMap[key].new_appointments++
  }

  const summaries = Object.values(dayMap)

  return <AnalyticsClient data={summaries} />
}
