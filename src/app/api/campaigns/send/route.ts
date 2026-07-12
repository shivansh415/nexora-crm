import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizePhone } from '@/lib/phone'
import { sendOutreachTemplate, renderOutreachPreview } from '@/lib/whatsapp'

const WORKSPACE_ID = 'f38c0ad0-d4ef-4090-94eb-50d3f6a21bce'

// Delay between sends to stay well under Meta's per-second throughput limits.
const SEND_DELAY_MS = 350
// Hard cap per request as a safety valve (Meta tier limits, accidental huge files).
const MAX_RECIPIENTS = 250

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface SendItem {
  name?: string
  phone: string // normalized on client, re-validated here
}

interface ReportRow {
  name: string
  phone: string
  status: 'sent' | 'skipped' | 'failed'
  reason?: string
}

export async function POST(req: NextRequest) {
  try {
    // Auth
    const { createClient: createServerClient } = await import('@/lib/supabase/server')
    const authSupabase = await createServerClient()
    const { data: { user } } = await authSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { recipients } = await req.json() as { recipients: SendItem[] }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'No recipients provided' }, { status: 400 })
    }
    if (recipients.length > MAX_RECIPIENTS) {
      return NextResponse.json({ error: `Too many recipients (max ${MAX_RECIPIENTS} per send)` }, { status: 400 })
    }

    const supabase = getSupabase()
    const report: ReportRow[] = []
    let sent = 0, skipped = 0, failed = 0

    // Track phones handled in this request to avoid double-sends within the batch
    const handled = new Set<string>()

    for (const item of recipients) {
      const name = (item.name || '').trim()
      const { value: phone } = normalizePhone(item.phone)

      if (!phone) {
        failed++
        report.push({ name, phone: String(item.phone ?? ''), status: 'failed', reason: 'invalid phone' })
        continue
      }

      if (handled.has(phone)) {
        skipped++
        report.push({ name, phone, status: 'skipped', reason: 'duplicate in batch' })
        continue
      }
      handled.add(phone)

      // Skip if contact already exists (already-in-CRM leads should not be re-messaged)
      const { data: existingContacts } = await supabase
        .from('contacts')
        .select('id, metadata')
        .eq('workspace_id', WORKSPACE_ID)
        .eq('phone_number', phone)
        .limit(1)

      if (existingContacts && existingContacts.length > 0) {
        skipped++
        const meta = existingContacts[0].metadata as { wa_reachable?: boolean } | null
        const reason = meta?.wa_reachable === false ? 'Not on WhatsApp' : 'already in CRM'
        report.push({ name, phone, status: 'skipped', reason })
        continue
      }

      // 1. Send the approved template via Meta
      const result = await sendOutreachTemplate(phone, name)
      if (!result.ok) {
        failed++
        report.push({ name, phone, status: 'failed', reason: result.error?.slice(0, 200) })
        await sleep(SEND_DELAY_MS)
        continue
      }

      // 2. Create contact
      const { data: newContact, error: contactErr } = await supabase
        .from('contacts')
        .insert({
          workspace_id: WORKSPACE_ID,
          phone_number: phone,
          name: name || phone,
          source: 'ad_upload',
          wa_id: phone,
          lead_score: 10,
          tags: ['Meta Ad', 'Outreach Sent'],
          last_seen_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (contactErr || !newContact) {
        // Message went out but we failed to persist — report as failed so it's visible
        failed++
        report.push({ name, phone, status: 'failed', reason: 'sent but DB save failed: ' + (contactErr?.message ?? '') })
        await sleep(SEND_DELAY_MS)
        continue
      }

      const nowIso = new Date().toISOString()
      const previewText = renderOutreachPreview(name)

      // 3. Create conversation with AI ARMED (ai_paused = false) so n8n auto-replies on reply
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({
          workspace_id: WORKSPACE_ID,
          contact_id: newContact.id,
          status: 'active',
          channel: 'whatsapp',
          ai_paused: false,
          last_message_at: nowIso,
          last_message_preview: previewText.slice(0, 100),
          unread_count: 0,
        })
        .select('id')
        .single()

      // 4. Save the outbound template message
      if (newConv) {
        await supabase.from('messages').insert({
          workspace_id: WORKSPACE_ID,
          conversation_id: newConv.id,
          wa_message_id: result.waMessageId || `outreach_${Date.now()}`,
          direction: 'outbound',
          sender_type: 'agent',
          sender_id: user.id,
          message_type: 'template',
          content: previewText,
          status: 'sent',
          is_ai_generated: false,
          timestamp: nowIso,
        })

        // 5. Create a lead so it shows up in the pipeline
        await supabase.from('leads').insert({
          workspace_id: WORKSPACE_ID,
          contact_id: newContact.id,
          conversation_id: newConv.id,
          title: `${name || phone} — Ad Outreach`,
          stage: 'contacted',
          priority: 'medium',
          tags: ['Meta Ad', 'Outreach Sent'],
          notes: 'First outreach template sent from bulk upload.',
        })
      }

      sent++
      report.push({ name, phone, status: 'sent' })
      await sleep(SEND_DELAY_MS)
    }

    return NextResponse.json({
      ok: true,
      summary: { total: recipients.length, sent, skipped, failed },
      report,
    })
  } catch (err) {
    console.error('[campaigns/send] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
