import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const WEBHOOK_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-12) || 'crm-webhook-secret'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// POST /api/leads/cleanup-stale
// Auto-closes leads that are still in "new" stage after 7 days (no contact ever
// happened). Marks them as 'lost' with a clear reason so they're archived
// out of the active pipeline but retained for reporting.
//
// Auth: either an authenticated CRM session, or a scheduler carrying the
// x-webhook-secret header. Safe to invoke from Vercel Cron / n8n Schedule Trigger.
export async function POST(req: NextRequest) {
  try {
    // Path 1: scheduler header
    const secret = req.headers.get('x-webhook-secret')
    let authorized = secret === WEBHOOK_SECRET

    // Path 2: authenticated CRM user
    if (!authorized) {
      const { createClient: createServerClient } = await import('@/lib/supabase/server')
      const authSupabase = await createServerClient()
      const { data: { user } } = await authSupabase.auth.getUser()
      authorized = !!user
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabase()
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: stale, error: findErr } = await supabase
      .from('leads')
      .select('id, contact_id, created_at')
      .eq('stage', 'new')
      .lt('created_at', cutoff)

    if (findErr) {
      return NextResponse.json({ error: 'Failed to query stale leads', details: findErr.message }, { status: 500 })
    }
    if (!stale || stale.length === 0) {
      return NextResponse.json({ ok: true, closed: 0 })
    }

    const ids = stale.map((l) => l.id)
    const { error: updErr } = await supabase
      .from('leads')
      .update({
        stage: 'lost',
        lost_reason: 'No response after 7 days',
        updated_at: new Date().toISOString(),
      })
      .in('id', ids)

    if (updErr) {
      return NextResponse.json({ error: 'Failed to close leads', details: updErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, closed: ids.length })
  } catch (err) {
    console.error('[leads/cleanup-stale] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
