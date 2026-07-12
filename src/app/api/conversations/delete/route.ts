import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// POST /api/conversations/delete
// Body: { conversationId: string, deleteContact?: boolean }
// Permanently removes a conversation and everything tied to it (messages, leads,
// appointments) from Supabase to free up storage. Optionally also deletes the
// contact record. This is a hard delete and cannot be undone.
export async function POST(req: NextRequest) {
  try {
    const { createClient: createServerClient } = await import('@/lib/supabase/server')
    const authSupabase = await createServerClient()
    const { data: { user } } = await authSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { conversationId, deleteContact } = await req.json() as {
      conversationId: string
      deleteContact?: boolean
    }
    if (!conversationId) {
      return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Resolve the contact so we can optionally remove it after.
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, contact_id')
      .eq('id', conversationId)
      .limit(1)
      .single()

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Delete children first to avoid FK violations. Ignore individual errors so a
    // missing table/column never blocks the core cleanup.
    await supabase.from('messages').delete().eq('conversation_id', conversationId)
    await supabase.from('leads').delete().eq('conversation_id', conversationId)
    await supabase.from('appointments').delete().eq('conversation_id', conversationId)

    const { error: convErr } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId)

    if (convErr) {
      console.error('[conversations/delete] conversation delete error:', convErr)
      return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 })
    }

    // Optionally remove the contact (and its leads/appointments) too.
    if (deleteContact && conv.contact_id) {
      await supabase.from('leads').delete().eq('contact_id', conv.contact_id)
      await supabase.from('appointments').delete().eq('contact_id', conv.contact_id)
      await supabase.from('contacts').delete().eq('id', conv.contact_id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[conversations/delete] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
