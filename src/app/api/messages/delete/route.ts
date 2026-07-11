import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// POST /api/messages/delete
// Body: { messageId: string }
// Removes an OUTBOUND message from the CRM. WhatsApp's Cloud API cannot recall a
// message already delivered to the recipient, so this deletes the CRM record only.
export async function POST(req: NextRequest) {
  try {
    const { createClient: createServerClient } = await import('@/lib/supabase/server')
    const authSupabase = await createServerClient()
    const { data: { user } } = await authSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messageId } = await req.json() as { messageId: string }
    if (!messageId) {
      return NextResponse.json({ error: 'Missing messageId' }, { status: 400 })
    }

    const supabase = getSupabase()

    const { data: existing, error: fetchErr } = await supabase
      .from('messages')
      .select('id, direction, conversation_id')
      .eq('id', messageId)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }
    if (existing.direction !== 'outbound') {
      return NextResponse.json({ error: 'Only your own sent messages can be deleted' }, { status: 403 })
    }

    const { error: delErr } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)

    if (delErr) {
      console.error('[messages/delete] delete error:', delErr)
      return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 })
    }

    // Refresh the conversation preview to whatever the newest remaining message is.
    if (existing.conversation_id) {
      const { data: latest } = await supabase
        .from('messages')
        .select('content, timestamp, created_at')
        .eq('conversation_id', existing.conversation_id)
        .order('timestamp', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1)
      const newest = latest?.[0]
      await supabase
        .from('conversations')
        .update({
          last_message_preview: (newest?.content ?? '').slice(0, 100),
          last_message_at: newest?.timestamp ?? newest?.created_at ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.conversation_id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[messages/delete] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
