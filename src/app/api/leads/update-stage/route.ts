import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_STAGES = ['new', 'contacted', 'qualified', 'won', 'lost'] as const
type Stage = (typeof ALLOWED_STAGES)[number]

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// POST /api/leads/update-stage
// Body: { leadId: string, stage: 'new'|'contacted'|'qualified'|'won'|'lost', lostReason?: string }
export async function POST(req: NextRequest) {
  try {
    const { createClient: createServerClient } = await import('@/lib/supabase/server')
    const authSupabase = await createServerClient()
    const { data: { user } } = await authSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { leadId, stage, lostReason } = await req.json() as {
      leadId: string
      stage: Stage
      lostReason?: string
    }

    if (!leadId) return NextResponse.json({ error: 'Missing leadId' }, { status: 400 })
    if (!ALLOWED_STAGES.includes(stage)) {
      return NextResponse.json({ error: `Invalid stage. Allowed: ${ALLOWED_STAGES.join(', ')}` }, { status: 400 })
    }

    const supabase = getSupabase()
    const patch: Record<string, unknown> = { stage, updated_at: new Date().toISOString() }
    if (stage === 'lost' && lostReason) patch.lost_reason = lostReason.trim()

    const { error } = await supabase.from('leads').update(patch).eq('id', leadId)
    if (error) {
      return NextResponse.json({ error: 'Failed to update stage', details: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[leads/update-stage] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
