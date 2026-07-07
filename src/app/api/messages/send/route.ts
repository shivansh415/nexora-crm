import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/messages/send
 *
 * Forwards an agent-composed reply to n8n, which is the single source of truth
 * for all WhatsApp operations (sending, retries, delivery tracking, logging).
 *
 * Flow: CRM → n8n webhook → WhatsApp Cloud API → Supabase → Realtime → CRM
 *
 * The CRM never calls the WhatsApp Cloud API directly.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Verify caller is authenticated
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { conversationId, workspaceId, message } = await req.json() as {
      conversationId: string
      workspaceId: string
      message: string
    }

    if (!conversationId || !workspaceId || !message?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const adminHeaders = {
      'Content-Type': 'application/json',
      apikey: sbKey,
      Authorization: `Bearer ${sbKey}`,
    }

    // 2. Fetch the workspace's n8n webhook URL
    const wsRes = await fetch(
      `${sbUrl}/rest/v1/workspaces?id=eq.${encodeURIComponent(workspaceId)}&select=n8n_webhook_url`,
      { headers: adminHeaders }
    )
    if (!wsRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch workspace' }, { status: 500 })
    }
    const wsData = await wsRes.json() as Array<{ n8n_webhook_url: string | null }>
    const n8nWebhookUrl = wsData[0]?.n8n_webhook_url ?? process.env.N8N_WEBHOOK_URL

    if (!n8nWebhookUrl) {
      return NextResponse.json(
        {
          error: 'n8n webhook URL not configured',
          hint: 'Set n8n_webhook_url on the workspace row, or add N8N_WEBHOOK_URL to .env.local',
        },
        { status: 503 }
      )
    }

    // 3. Forward to n8n — n8n handles WhatsApp sending, message saving, and logging
    const n8nRes = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'agent_reply',
        conversation_id: conversationId,
        workspace_id: workspaceId,
        agent_id: user.id,
        message: message.trim(),
        timestamp: new Date().toISOString(),
      }),
    })

    if (!n8nRes.ok) {
      const errText = await n8nRes.text()
      console.error('[send] n8n error:', n8nRes.status, errText.slice(0, 200))
      return NextResponse.json(
        { error: 'n8n rejected the request', details: errText.slice(0, 200) },
        { status: 502 }
      )
    }

    const n8nData = await n8nRes.json().catch(() => ({}))
    return NextResponse.json({ ok: true, forwarded_to: 'n8n', n8n: n8nData })
  } catch (err) {
    console.error('[send] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
