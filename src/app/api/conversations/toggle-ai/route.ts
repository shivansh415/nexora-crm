import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/conversations/toggle-ai
// Body: { conversationId: string, paused: boolean }
// paused=true  → AI paused (human takeover)
// paused=false → AI resumed
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { conversationId, paused } = await req.json() as {
      conversationId: string
      paused: boolean
    }

    if (!conversationId || paused === undefined) {
      return NextResponse.json({ error: 'Missing conversationId or paused' }, { status: 400 })
    }

    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Use direct REST PATCH to bypass TS type constraints on generated DB types
    const patchRes = await fetch(
      `${sbUrl}/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: sbKey,
          Authorization: `Bearer ${sbKey}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          ai_paused: paused,
          status: paused ? 'human_takeover' : 'active',
          ai_paused_by: paused ? user.id : null,
          updated_at: new Date().toISOString(),
        }),
      }
    )

    if (!patchRes.ok) {
      const errText = await patchRes.text()
      console.error('[toggle-ai] PATCH error:', errText)
      return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 })
    }

    const updated = await patchRes.json()
    return NextResponse.json({ ok: true, conversation: updated?.[0] ?? null })
  } catch (err) {
    console.error('[toggle-ai] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
