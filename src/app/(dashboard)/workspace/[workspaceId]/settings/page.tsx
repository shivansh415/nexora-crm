import SettingsClient from '@/components/settings/settings-client'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  params: Promise<{ workspaceId: string }>
}

export const metadata = { title: 'Settings' }

export default async function SettingsPage({ params }: PageProps) {
  const { workspaceId } = await params
  const supabase = await createClient()

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, business_type, timezone, n8n_webhook_url, google_calendar_connected, google_sheets_connected, whatsapp_phone_number_id, settings')
    .eq('id', workspaceId)
    .single() as {
      data: {
        id: string
        name: string
        business_type: string
        timezone: string
        n8n_webhook_url: string | null
        google_calendar_connected: boolean
        google_sheets_connected: boolean
        whatsapp_phone_number_id: string | null
      } | null
      error: unknown
    }

  return <SettingsClient workspaceId={workspaceId} workspace={workspace} />
}
