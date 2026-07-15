import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// POST /api/workspace/update
// Body: { workspaceId, name?, business_type?, timezone?, notification_prefs?, n8n_webhook_url? }
// Persists workspace-level settings changes.
export async function POST(req: NextRequest) {
  try {
    const { createClient: createServerClient } = await import('@/lib/supabase/server')
    const authSupabase = await createServerClient()
    const { data: { user } } = await authSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      workspaceId: string
      name?: string
      business_type?: string
      timezone?: string
      notification_prefs?: Record<string, boolean>
      n8n_webhook_url?: string
    }
    if (!body.workspaceId) return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })

    const supabase = getSupabase()

    // Notification prefs go inside settings JSON. Everything else is a plain column.
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof body.name === 'string') patch.name = body.name.trim()
    if (typeof body.business_type === 'string') patch.business_type = body.business_type.trim()
    if (typeof body.timezone === 'string') patch.timezone = body.timezone.trim()
    if (typeof body.n8n_webhook_url === 'string') patch.n8n_webhook_url = body.n8n_webhook_url.trim()

    if (body.notification_prefs) {
      const { data: current } = await supabase
        .from('workspaces')
        .select('settings')
        .eq('id', body.workspaceId)
        .single()
      const existing = (typeof current?.settings === 'object' && current?.settings) ? current.settings : {}
      patch.settings = { ...existing, notification_prefs: body.notification_prefs }
    }

    const { error } = await supabase
      .from('workspaces')
      .update(patch)
      .eq('id', body.workspaceId)

    if (error) {
      return NextResponse.json({ error: 'Failed to save', details: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[workspace/update] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
