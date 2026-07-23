// Phone number normalization for WhatsApp (international).
// WhatsApp Cloud API expects numbers in international format WITHOUT the leading
// "+" (e.g. "919876543210" for India, "923001234567" for Pakistan, "971501234567"
// for the UAE). Leads and manually-entered numbers arrive in mixed formats:
//   "+91 98765 43210", "9876543210", "919876543210", "09876543210",
//   "+92 300 1234567", "00971501234567", "971 50 123 4567", etc.
//
// This CRM started out India-only. It now supports EVERY country by delegating
// to libphonenumber-js (Google's phone metadata), while keeping India as the
// default country so bare 10-digit Indian numbers continue to work unchanged.

import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'

// Default country used when the input has no country code and does not start
// with "+" (e.g. a bare "9876543210"). Override via env if this CRM's primary
// market changes. Must be a 2-letter ISO country code (IN, PK, AE, US, ...).
const DEFAULT_COUNTRY = ((process.env.DEFAULT_PHONE_COUNTRY || 'IN').toUpperCase()) as CountryCode
const DEFAULT_COUNTRY_CODE = '91' // India dialing code — used for legacy bare-number handling.

export interface NormalizedPhone {
  /** Digits-only, country-code-prefixed number ready for the WhatsApp API, or null if invalid. */
  value: string | null
  /** Reason it could not be normalized (only set when value is null). */
  reason?: string
}

/**
 * Normalize a raw phone string into WhatsApp Cloud API format (digits only,
 * country code prefixed, no "+"). Works for ALL countries.
 *
 * Strategy (each step falls through to the next on failure):
 *  1. Explicitly international ("+..." or "00..." IDD prefix) → parse as-is.
 *  2. India-first legacy handling for bare numbers (default market), so
 *     "9876543210", "09876543210" and "919876543210" behave exactly as before.
 *  3. Bare number that isn't valid India → try interpreting it as an
 *     international number that already carries its own country code
 *     (e.g. "971501234567" → "+971501234567").
 *
 * Returns { value: null, reason } when the input cannot be turned into a valid
 * phone number.
 */
export function normalizePhone(raw: unknown): NormalizedPhone {
  if (raw === null || raw === undefined) {
    return { value: null, reason: 'empty' }
  }

  const input = String(raw).trim()
  if (!input) {
    return { value: null, reason: 'empty' }
  }

  // Digits only (drops "+", spaces, dashes, parentheses, etc.).
  const digits = input.replace(/\D/g, '')
  if (!digits) {
    return { value: null, reason: 'no digits' }
  }

  // Treat a leading "00" as the international dialing prefix (e.g. "0092..." → "+92...").
  const isInternational = input.startsWith('+') || /^00\d/.test(input)

  // ── 1. Explicitly international ("+..." or "00..." IDD) ──
  if (isInternational) {
    const e164 = input.startsWith('+') ? input : `+${digits.replace(/^0+/, '')}`
    const parsed = tryParse(e164)
    if (parsed) return { value: parsed }
    return { value: null, reason: 'invalid international number' }
  }

  // ── 2. India-first legacy handling for bare numbers (preserves old behavior) ──
  let indiaDigits = digits
  // Drop a single leading trunk "0" (e.g. "09876543210" → "9876543210").
  if (indiaDigits.length === 11 && indiaDigits.startsWith('0')) {
    indiaDigits = indiaDigits.slice(1)
  }
  // Already has India country code: "91" + 10 digits.
  if (indiaDigits.length === 12 && indiaDigits.startsWith(DEFAULT_COUNTRY_CODE)) {
    const subscriber = indiaDigits.slice(2)
    if (isValidIndianMobile(subscriber)) return { value: indiaDigits }
  }
  // Bare 10-digit Indian mobile → prepend country code.
  if (indiaDigits.length === 10 && isValidIndianMobile(indiaDigits)) {
    return { value: DEFAULT_COUNTRY_CODE + indiaDigits }
  }

  // ── 3. Bare number with its own (non-India) country code, e.g. "971501234567" ──
  // Every valid bare INDIAN format was already handled in step 2, so a number
  // reaching here most likely already carries a foreign country code. Interpret
  // it as international FIRST ("971501234567" → "+971501234567"), then fall back
  // to the configured default country for rare short national numbers.
  const asInternational = tryParse(`+${digits.replace(/^0+/, '')}`)
  if (asInternational) return { value: asInternational }

  const asDefaultCountry = tryParse(digits, DEFAULT_COUNTRY)
  if (asDefaultCountry) return { value: asDefaultCountry }

  return { value: null, reason: 'unrecognized number' }
}

/**
 * Parse with libphonenumber-js and return digits-only E.164 (no "+") when the
 * number is usable. Accepts numbers that are valid OR at least "possible"
 * (correct length for the country) so we don't reject good numbers just because
 * the library's metadata hasn't caught up with a new mobile prefix — WhatsApp
 * is the final arbiter of deliverability.
 */
function tryParse(input: string, country?: CountryCode): string | null {
  try {
    const parsed = country ? parsePhoneNumberFromString(input, country) : parsePhoneNumberFromString(input)
    if (parsed && (parsed.isValid() || parsed.isPossible())) {
      // .number is E.164 with a leading "+"; strip it for the WhatsApp API.
      return parsed.number.replace(/^\+/, '')
    }
  } catch {
    // fall through
  }
  return null
}

// Indian mobile numbers are 10 digits starting with 6-9.
function isValidIndianMobile(tenDigits: string): boolean {
  return /^[6-9]\d{9}$/.test(tenDigits)
}
