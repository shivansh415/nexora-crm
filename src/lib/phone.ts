// Phone number normalization for WhatsApp (India-focused).
// WhatsApp Cloud API expects numbers in international format WITHOUT the leading
// "+" (e.g. "919876543210"). Leads imported from Meta come in mixed formats:
//   "+91 98765 43210", "9876543210", "919876543210", "09876543210", etc.

const DEFAULT_COUNTRY_CODE = '91'

export interface NormalizedPhone {
  /** Digits-only, country-code-prefixed number ready for the WhatsApp API, or null if invalid. */
  value: string | null
  /** Reason it could not be normalized (only set when value is null). */
  reason?: string
}

/**
 * Normalize a raw phone string into WhatsApp Cloud API format ("919876543210").
 * Returns { value: null, reason } when the input cannot be turned into a valid
 * Indian mobile number.
 */
export function normalizePhone(raw: unknown): NormalizedPhone {
  if (raw === null || raw === undefined) {
    return { value: null, reason: 'empty' }
  }

  // Strip everything except digits (drops "+", spaces, dashes, parentheses, etc.)
  let digits = String(raw).replace(/\D/g, '')

  if (!digits) {
    return { value: null, reason: 'no digits' }
  }

  // Drop a single leading trunk "0" (e.g. "09876543210" → "9876543210")
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1)
  }

  // Already has country code: "91" + 10 digits
  if (digits.length === 12 && digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    const subscriber = digits.slice(2)
    if (isValidIndianMobile(subscriber)) return { value: digits }
    return { value: null, reason: 'invalid mobile number' }
  }

  // Bare 10-digit mobile → prepend country code
  if (digits.length === 10) {
    if (isValidIndianMobile(digits)) return { value: DEFAULT_COUNTRY_CODE + digits }
    return { value: null, reason: 'invalid mobile number' }
  }

  return { value: null, reason: 'unexpected length' }
}

// Indian mobile numbers are 10 digits starting with 6-9.
function isValidIndianMobile(tenDigits: string): boolean {
  return /^[6-9]\d{9}$/.test(tenDigits)
}
