import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { normalizePhone } from '@/lib/phone'

const WORKSPACE_ID = 'f38c0ad0-d4ef-4090-94eb-50d3f6a21bce'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Header candidates (case/space/underscore-insensitive) for auto-detection.
const NAME_KEYS = ['full_name', 'fullname', 'name', 'lead_name', 'first_name']
const PHONE_KEYS = ['phone_number', 'phonenumber', 'phone', 'mobile', 'mobile_number', 'contact_number', 'whatsapp', 'whatsapp_number']

function canonical(key: string): string {
  return key.toLowerCase().replace(/[\s_-]+/g, '')
}

function findColumn(headers: string[], candidates: string[]): string | null {
  const canonCandidates = candidates.map(canonical)
  for (const h of headers) {
    if (canonCandidates.includes(canonical(h))) return h
  }
  // Fallback: partial contains match (e.g. "Phone Number (from Meta)")
  for (const h of headers) {
    const c = canonical(h)
    if (canonCandidates.some((cc) => c.includes(cc))) return h
  }
  return null
}

export type PreviewStatus = 'new' | 'duplicate' | 'invalid'

export interface PreviewRow {
  rowNumber: number
  name: string
  rawPhone: string
  phone: string | null
  status: PreviewStatus
  reason?: string
}

export async function POST(req: NextRequest) {
  try {
    // Auth
    const { createClient: createServerClient } = await import('@/lib/supabase/server')
    const authSupabase = await createServerClient()
    const { data: { user } } = await authSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const buf = Buffer.from(await (file as File).arrayBuffer())

    let rows: Record<string, unknown>[]
    try {
      const wb = XLSX.read(buf, { type: 'buffer' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      if (!sheet) return NextResponse.json({ error: 'File has no sheets' }, { status: 400 })
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    } catch {
      return NextResponse.json({ error: 'Could not parse file. Upload a valid .csv or .xlsx' }, { status: 400 })
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 })
    }

    const headers = Object.keys(rows[0])
    const nameCol = findColumn(headers, NAME_KEYS)
    const phoneCol = findColumn(headers, PHONE_KEYS)

    if (!phoneCol) {
      return NextResponse.json({
        error: 'Could not find a phone number column. Expected a column like "phone_number".',
        headers,
      }, { status: 400 })
    }

    // Normalize + validate every row, dedup within the file first
    const seenInFile = new Set<string>()
    const preview: PreviewRow[] = []
    const validPhones: string[] = []

    rows.forEach((row, i) => {
      const rawPhone = String(row[phoneCol] ?? '').trim()
      const name = nameCol ? String(row[nameCol] ?? '').trim() : ''
      const { value: phone, reason } = normalizePhone(rawPhone)

      let status: PreviewStatus = 'new'
      let rowReason: string | undefined

      if (!phone) {
        status = 'invalid'
        rowReason = reason || 'invalid phone'
      } else if (seenInFile.has(phone)) {
        status = 'duplicate'
        rowReason = 'duplicate in file'
      } else {
        seenInFile.add(phone)
        validPhones.push(phone)
      }

      preview.push({ rowNumber: i + 2, name, rawPhone, phone, status, reason: rowReason })
    })

    // Dedup against existing contacts in the DB
    if (validPhones.length > 0) {
      const supabase = getSupabase()
      const { data: existing } = await supabase
        .from('contacts')
        .select('phone_number')
        .eq('workspace_id', WORKSPACE_ID)
        .in('phone_number', validPhones)

      const existingSet = new Set((existing ?? []).map((c: { phone_number: string }) => c.phone_number))
      for (const r of preview) {
        if (r.status === 'new' && r.phone && existingSet.has(r.phone)) {
          r.status = 'duplicate'
          r.reason = 'already in CRM'
        }
      }
    }

    const summary = {
      total: preview.length,
      toSend: preview.filter((r) => r.status === 'new').length,
      duplicates: preview.filter((r) => r.status === 'duplicate').length,
      invalid: preview.filter((r) => r.status === 'invalid').length,
    }

    return NextResponse.json({
      ok: true,
      detectedColumns: { name: nameCol, phone: phoneCol },
      summary,
      rows: preview,
    })
  } catch (err) {
    console.error('[campaigns/preview] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
