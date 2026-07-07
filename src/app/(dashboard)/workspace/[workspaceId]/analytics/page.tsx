import AnalyticsClient from './analytics-client'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  params: Promise<{ workspaceId: string }>
}

export const metadata = { title: 'Analytics' }

export default async function AnalyticsPage({ params }: PageProps) {
  const { workspaceId } = await params
  const supabase = await createClient()

  // Fetch last 30 days of analytics
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: summaries } = await supabase
    .from('analytics_summaries')
    .select('date, total_messages_in, total_messages_out, ai_messages_out, agent_messages_out, new_leads, new_appointments, human_takeovers')
    .eq('workspace_id', workspaceId)
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: true }) as {
      data: Array<{
        date: string; total_messages_in: number; total_messages_out: number;
        ai_messages_out: number; agent_messages_out: number; new_leads: number;
        new_appointments: number; human_takeovers: number;
      }> | null; error: unknown
    }

  return <AnalyticsClient data={summaries ?? []} />
}
