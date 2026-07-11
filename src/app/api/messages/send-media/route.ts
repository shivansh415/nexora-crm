import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const WORKSPACE_ID = 'f38c0ad0-d4ef-4090-94eb-50d3f6a21bce'
const BUCKET = 'chat-media'
const GRAPH_VERSION = 'v23.0'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Ensure the public storage bucket exists (idempotent).
async function ensureBucket(supabase: ReturnType<typeof getSupabase>) {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (buckets?.some((b) => b.name === BUCKET)) return
  await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: '16MB', // WhatsApp media cap
  })
}

// Map an incoming mime type to a WhatsApp message kind.
function kindFromMime(mime: string): 'image' | 'audio' | 'video' | 'document' {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('video/')) return 'video'
  return 'document'
}

export async function POST(req: NextRequest) {
  try {
    const { createClient: createServerClient } = await import('@/lib/supabase/server')
    const authSupabase = await createServerClient()
    const { data: { user } } = await authSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file')
    const conversationId = String(form.get('conversationId') || '')
    const caption = String(form.get('caption') || '').trim()
    // Explicit "voice" flag lets the UI mark a recording as a voice note.
    const asVoice = String(form.get('voice') || '') === 'true'

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }
    if (!conversationId) {
      return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 })
    }

    const f = file as File
    const mime = f.type || 'application/octet-stream'
    const kind = asVoice ? 'audio' : kindFromMime(mime)

    const supabase = getSupabase()

    // 1. Resolve the recipient phone from the conversation
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .select('contact_id, contacts(phone_number)')
      .eq('id', conversationId)
      .single()

    if (convErr || !conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }
    const phone = (conv as unknown as { contacts?: { phone_number?: string } }).contacts?.phone_number
    if (!phone) {
      return NextResponse.json({ error: 'Contact phone number not found' }, { status: 404 })
    }

    // 1b. Enforce WhatsApp's 24-hour customer-care window (same rule as text).
    // Outside the window Meta accepts the media (HTTP 200 + id) but never delivers
    // it, so block early — before uploading — with a clear error.
    const { data: lastInbound } = await supabase
      .from('messages')
      .select('timestamp, created_at')
      .eq('conversation_id', conversationId)
      .eq('direction', 'inbound')
      .order('timestamp', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)

    const lastInboundAt = lastInbound?.[0]?.timestamp ?? lastInbound?.[0]?.created_at ?? null
    const withinWindow =
      !!lastInboundAt && Date.now() - new Date(lastInboundAt).getTime() < 24 * 60 * 60 * 1000

    if (!withinWindow) {
      return NextResponse.json(
        {
          error: lastInboundAt
            ? "This contact hasn't replied in the last 24 hours, so WhatsApp won't deliver attachments. Ask them to reply first, or re-open the chat with the approved template (New chat)."
            : "This contact hasn't messaged you yet. WhatsApp won't deliver attachments until they reply — use New chat to send the approved template first.",
          code: 'WINDOW_CLOSED',
          windowClosed: true,
        },
        { status: 409 }
      )
    }

    // 2. Upload to Supabase Storage → public URL (also used to display in the CRM)
    await ensureBucket(supabase)
    const ext = (f.name.split('.').pop() || 'bin').toLowerCase()
    const path = `${WORKSPACE_ID}/${conversationId}/${Date.now()}.${ext}`
    const bytes = Buffer.from(await f.arrayBuffer())

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: false })
    if (upErr) {
      console.error('[send-media] upload error:', upErr)
      return NextResponse.json({ error: 'Failed to store media' }, { status: 500 })
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const mediaUrl = pub.publicUrl

    // 3. Send via Meta Cloud API using the public link
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
    if (!phoneNumberId || !accessToken) {
      return NextResponse.json({ error: 'WhatsApp credentials not configured' }, { status: 503 })
    }

    const mediaPayload: Record<string, unknown> = { link: mediaUrl }
    if (kind === 'image' && caption) mediaPayload.caption = caption
    if (kind === 'document') mediaPayload.filename = f.name

    const waRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
          type: kind,
          [kind]: mediaPayload,
        }),
      }
    )
    const waData = await waRes.json()

    if (!waRes.ok) {
      console.error('[send-media] WhatsApp API error:', waData)
      return NextResponse.json({
        error: 'WhatsApp API error',
        details: waData?.error?.message || JSON.stringify(waData).slice(0, 300),
      }, { status: 502 })
    }

    const waMsgId = waData?.messages?.[0]?.id || `media_${Date.now()}`
    const nowIso = new Date().toISOString()

    // 4. Save the message row (media_url makes it renderable in the chat UI)
    const { data: savedMsg } = await supabase
      .from('messages')
      .insert({
        workspace_id: WORKSPACE_ID,
        conversation_id: conversationId,
        wa_message_id: waMsgId,
        direction: 'outbound',
        sender_type: 'agent',
        sender_id: user.id,
        message_type: kind === 'audio' && asVoice ? 'voice' : kind,
        content: caption || '',
        media_url: mediaUrl,
        media_mime_type: mime,
        status: 'sent',
        is_ai_generated: false,
        timestamp: nowIso,
      })
      .select('id')
      .single()

    // 5. Update conversation preview
    const preview = kind === 'image' ? '📷 Photo' : kind === 'audio' ? '🎤 Voice message' : kind === 'video' ? '🎬 Video' : '📎 Attachment'
    await supabase
      .from('conversations')
      .update({
        last_message_at: nowIso,
        last_message_preview: caption ? `📷 ${caption}`.slice(0, 100) : preview,
        updated_at: nowIso,
      })
      .eq('id', conversationId)

    return NextResponse.json({ ok: true, messageId: savedMsg?.id ?? null, mediaUrl, whatsappMessageId: waMsgId })
  } catch (err) {
    console.error('[send-media] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
