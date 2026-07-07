import PipelineBoard from '@/components/leads/pipeline-board'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  params: Promise<{ workspaceId: string }>
}

export const metadata = { title: 'Leads Pipeline' }

export default async function LeadsPage({ params }: PageProps) {
  const { workspaceId } = await params
  const supabase = await createClient()

  const { data: leads } = await supabase
    .from('leads')
    .select('id, workspace_id, contact_id, title, stage, priority, deal_value, currency, budget_min, budget_max, location_pref, notes, tags, created_at, updated_at, contacts(id, name, phone_number, email, tags, lead_score)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false }) as {
      data: Array<{
        id: string; workspace_id: string; contact_id: string; title: string;
        stage: string; priority: string; deal_value: number | null; currency: string;
        budget_min: number | null; budget_max: number | null; location_pref: string | null;
        notes: string | null; tags: string[]; created_at: string; updated_at: string;
        contacts: { id: string; name: string; phone_number: string; email: string | null; tags: string[]; lead_score: number } | null;
      }> | null; error: unknown
    }

  // Transform to match Lead type expected by PipelineBoard
  const safeLeads = (leads ?? []).map((l) => ({
    id: l.id,
    workspace_id: l.workspace_id,
    contact_id: l.contact_id,
    conversation_id: null,
    title: l.title,
    status: l.stage as 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost',
    pipeline_stage: l.stage,
    pipeline_order: 0,
    value: l.deal_value,
    currency: l.currency || 'INR',
    source: 'whatsapp' as const,
    assigned_to: null,
    tags: l.tags ?? [],
    notes: l.notes,
    google_sheets_row_id: null,
    qualification_data: {},
    lost_reason: null,
    expected_close_date: null,
    created_at: l.created_at,
    updated_at: l.updated_at,
    contact: l.contacts ? {
      id: l.contacts.id,
      workspace_id: l.workspace_id,
      whatsapp_id: '',
      phone_number: l.contacts.phone_number,
      name: l.contacts.name,
      email: l.contacts.email,
      avatar_url: null,
      tags: l.contacts.tags ?? [],
      notes: null,
      lead_score: l.contacts.lead_score,
      source: 'whatsapp' as const,
      custom_fields: {},
      is_blocked: false,
      last_seen_at: null,
      created_at: l.created_at,
      updated_at: l.updated_at,
    } : undefined,
  }))

  return <PipelineBoard workspaceId={workspaceId} leads={safeLeads} />
}
