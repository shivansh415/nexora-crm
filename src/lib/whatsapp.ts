// Thin wrapper around the Meta WhatsApp Cloud API for sending template messages.
// Business-initiated ("cold") messages MUST use a pre-approved template because
// the recipient has not messaged us within the last 24 hours.

const GRAPH_VERSION = 'v23.0'

// Approved template used for the first outreach to ad leads.
// Override via env if you rename/re-language the template in Meta.
export const OUTREACH_TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME || 'ad_lead_message'
export const OUTREACH_TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'en'
// Fixed agent name injected as {{2}} in the template body.
export const OUTREACH_AGENT_NAME = process.env.WHATSAPP_AGENT_NAME || 'Shivansh'
// Whether the template body has {{1}}/{{2}} variables.
// hello_world has NONE (set false); ad_lead_message has two (set true).
export const OUTREACH_TEMPLATE_HAS_VARS =
  (process.env.WHATSAPP_TEMPLATE_HAS_VARS ?? 'true').toLowerCase() !== 'false'

// Template used to RE-OPEN a conversation whose 24h customer-care window has
// closed (re-engagement). Defaults to the outreach template so it works out of
// the box, but you should ideally approve a dedicated UTILITY template for this
// and set WHATSAPP_REENGAGE_TEMPLATE_NAME (UTILITY templates have better pacing).
export const REENGAGE_TEMPLATE_NAME = process.env.WHATSAPP_REENGAGE_TEMPLATE_NAME || OUTREACH_TEMPLATE_NAME
export const REENGAGE_TEMPLATE_LANG = process.env.WHATSAPP_REENGAGE_TEMPLATE_LANG || OUTREACH_TEMPLATE_LANG
export const REENGAGE_TEMPLATE_HAS_VARS =
  (process.env.WHATSAPP_REENGAGE_TEMPLATE_HAS_VARS ?? String(OUTREACH_TEMPLATE_HAS_VARS)).toLowerCase() !== 'false'

export interface SendTemplateResult {
  ok: boolean
  waMessageId?: string
  error?: string
  errorCode?: number
  retryable?: boolean
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Render the human-readable body of the outreach message for storing in the
 * messages table / showing in the chat UI. Keep in sync with the approved
 * template body in Meta.
 */
export function renderOutreachPreview(leadName: string): string {
  // Templates with no variables (e.g. hello_world) have fixed Meta-provided text.
  if (!OUTREACH_TEMPLATE_HAS_VARS) {
    return 'Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta.'
  }
  const name = leadName?.trim() || 'there'
  // Keep this EXACTLY in sync with the approved `ad_lead_message` template body in Meta.
  // {{1}} = lead name, {{2}} = agent name.
  return `Hi ${name}, this is ${OUTREACH_AGENT_NAME} from Nexora Lab. I saw your enquiry and wanted to personally reach out. What do you want to Automate, We Help business to Grow with AI Agents.`
}

/**
 * Low-level: POST a message payload to the Meta Cloud API with automatic retry
 * and exponential backoff for transient failures (HTTP 429 / 5xx / network).
 * Honors the `Retry-After` header when Meta sends it.
 *
 * This is the single choke-point every outbound send goes through, so retries,
 * backoff and error normalization are guaranteed for templates, text and media.
 */
async function metaSend(
  payload: Record<string, unknown>,
  { maxTries = 3, baseDelayMs = 800 }: { maxTries?: number; baseDelayMs?: number } = {},
): Promise<SendTemplateResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    return { ok: false, error: 'WhatsApp credentials not configured (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN)' }
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`
  let lastError = 'unknown error'
  let lastCode: number | undefined

  for (let attempt = 1; attempt <= maxTries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...payload }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        console.log('[whatsapp] send OK:', JSON.stringify({ to: payload.to, waId: data?.messages?.[0]?.id }))
        return { ok: true, waMessageId: data?.messages?.[0]?.id }
      }

      lastCode = data?.error?.code
      lastError = data?.error?.message || JSON.stringify(data).slice(0, 300)
      console.error('[whatsapp] send FAILED:', JSON.stringify({ attempt, status: res.status, code: lastCode, error: lastError, to: payload.to }))

      // Decide if this is worth retrying.
      // 429 = rate limited; 5xx = Meta transient; 131056/130429 = throughput/pair-rate limits.
      const transientCodes = new Set([130429, 131056, 133016])
      const retryable = res.status === 429 || res.status >= 500 || (lastCode !== undefined && transientCodes.has(lastCode))

      if (!retryable || attempt === maxTries) {
        return { ok: false, error: lastError, errorCode: lastCode, retryable }
      }

      // Backoff: honor Retry-After, else exponential with jitter.
      const retryAfter = Number(res.headers.get('retry-after'))
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 250)
      await sleep(backoff)
    } catch (err) {
      // Network error — retry.
      lastError = err instanceof Error ? err.message : String(err)
      if (attempt === maxTries) return { ok: false, error: lastError, retryable: true }
      await sleep(baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 250))
    }
  }

  return { ok: false, error: lastError, errorCode: lastCode, retryable: true }
}

/**
 * Send ANY approved template to a recipient. `phone` must already be normalized
 * (digits only, country code prefixed). Pass `bodyParams` for {{1}},{{2}},...
 */
export async function sendTemplate(
  phone: string,
  opts: { name: string; lang: string; bodyParams?: string[] },
): Promise<SendTemplateResult> {
  const template: Record<string, unknown> = {
    name: opts.name,
    language: { code: opts.lang },
  }
  if (opts.bodyParams && opts.bodyParams.length > 0) {
    template.components = [
      { type: 'body', parameters: opts.bodyParams.map((text) => ({ type: 'text', text })) },
    ]
  }
  return metaSend({ to: phone, type: 'template', template })
}

/**
 * Send the approved outreach template to a single recipient (first cold touch).
 */
export async function sendOutreachTemplate(phone: string, leadName: string): Promise<SendTemplateResult> {
  const name = leadName?.trim() || 'there'
  return sendTemplate(phone, {
    name: OUTREACH_TEMPLATE_NAME,
    lang: OUTREACH_TEMPLATE_LANG,
    bodyParams: OUTREACH_TEMPLATE_HAS_VARS ? [name, OUTREACH_AGENT_NAME] : undefined,
  })
}

/**
 * Re-open a conversation whose 24h window has closed by sending the approved
 * re-engagement template. Uses the same variables as outreach by default.
 */
export async function sendReengageTemplate(phone: string, leadName: string): Promise<SendTemplateResult> {
  const name = leadName?.trim() || 'there'
  return sendTemplate(phone, {
    name: REENGAGE_TEMPLATE_NAME,
    lang: REENGAGE_TEMPLATE_LANG,
    bodyParams: REENGAGE_TEMPLATE_HAS_VARS ? [name, OUTREACH_AGENT_NAME] : undefined,
  })
}
