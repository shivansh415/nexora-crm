import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// POST /api/messages/edit
// Body: { messageId: string, content: string }
// Edits the stored text of an OUTBOUND message (the CRM record). Note: WhatsApp's
// Cloud API does not support editing an already-delivered message, so this updates
// the CRM copy only and marks it as edited via metadata.
export async function POST(req: NextRequest) {
  try {
    const { createClient: createServerClient } = await import('@/lib/supabase/server')
    const authSupabase = await createServerClient()
    const { data: { user } } = await authSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messageId, content } = await req.json() as { messageId: string; content: string }
    if (!messageId || !content?.trim()) {
      return NextResponse.json({ error: 'Missing messageId or content' }, { status: 400 })
    }

    const supabase = getSupabase()

    const { data: existing, error: fetchErr } = await supabase
      .from('messages')
      .select('id, direction, message_type, metadata, conversation_id')
      .eq('id', messageId)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }
    if (existing.direction !== 'outbound') {
      return NextResponse.json({ error: 'Only your own sent messages can be edited' }, { status: 403 })
    }
    if (existing.message_type && existing.message_type !== 'text') {
      return NextResponse.json({ error: 'Only text messages can be edited' }, { status: 400 })
    }

    const trimmed = content.trim()
    const metadata = {
      ...(typeof existing.metadata === 'object' && existing.metadata ? existing.metadata : {}),
      edited: true,
      edited_at: new Date().toISOString(),
    }

    const { error: updErr } = await supabase
      .from('messages')
      .update({ content: trimmed, metadata })
      .eq('id', messageId)

    if (updErr) {
      console.error('[messages/edit] update error:', updErr)
      return NextResponse.json({ error: 'Failed to update message' }, { status: 500 })
    }

    // Keep the conversation preview in sync if this was the latest message.
    if (existing.conversation_id) {
      const { data: latest } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', existing.conversation_id)
        .order('timestamp', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1)
      if (latest?.[0]?.id === messageId) {
        await supabase
          .from('conversations')
          .update({ last_message_preview: trimmed.slice(0, 100), updated_at: new Date().toISOString() })
          .eq('id', existing.conversation_id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[messages/edit] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
