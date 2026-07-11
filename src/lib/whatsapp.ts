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

export interface SendTemplateResult {
  ok: boolean
  waMessageId?: string
  error?: string
}

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
 * Send the approved outreach template to a single recipient.
 * `phone` must already be normalized (digits only, country code prefixed).
 */
export async function sendOutreachTemplate(phone: string, leadName: string): Promise<SendTemplateResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    return { ok: false, error: 'WhatsApp credentials not configured (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN)' }
  }

  const name = leadName?.trim() || 'there'

  const template: Record<string, unknown> = {
    name: OUTREACH_TEMPLATE_NAME,
    language: { code: OUTREACH_TEMPLATE_LANG },
  }

  // Only attach body parameters when the template actually has {{1}}/{{2}}.
  // Sending parameters to a no-variable template (like hello_world) is rejected by Meta.
  if (OUTREACH_TEMPLATE_HAS_VARS) {
    template.components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: name },
          { type: 'text', text: OUTREACH_AGENT_NAME },
        ],
      },
    ]
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
          type: 'template',
          template,
        }),
      }
    )

    const data = await res.json()

    if (!res.ok) {
      const msg = data?.error?.message || JSON.stringify(data).slice(0, 300)
      return { ok: false, error: msg }
    }

    return { ok: true, waMessageId: data?.messages?.[0]?.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
