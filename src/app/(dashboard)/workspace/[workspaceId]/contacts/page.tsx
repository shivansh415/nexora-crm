import { createClient } from '@/lib/supabase/server'
import ContactsClient, { type ContactRow } from './contacts-client'

interface PageProps {
  params: Promise<{ workspaceId: string }>
}

export const metadata = { title: 'Contacts' }

export default async function ContactsPage({ params }: PageProps) {
  const { workspaceId } = await params
  const supabase = await createClient()

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, phone_number, email, tags, lead_score, source, last_seen_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false }) as {
      data: Array<Omit<ContactRow, 'conversation_id'>> | null; error: unknown
    }

  const safeContacts = contacts ?? []

  // Map each contact to its conversation (for the "Chat" deep-link)
  const { data: convs } = await supabase
    .from('conversations')
    .select('id, contact_id')
    .eq('workspace_id', workspaceId) as {
      data: Array<{ id: string; contact_id: string | null }> | null; error: unknown
    }

  const convByContact = new Map<string, string>()
  for (const c of convs ?? []) {
    if (c.contact_id && !convByContact.has(c.contact_id)) convByContact.set(c.contact_id, c.id)
  }

  const rows: ContactRow[] = safeContacts.map((c) => ({
    ...c,
    conversation_id: convByContact.get(c.id) ?? null,
  }))

  return <ContactsClient initial={rows} workspaceId={workspaceId} />
}
