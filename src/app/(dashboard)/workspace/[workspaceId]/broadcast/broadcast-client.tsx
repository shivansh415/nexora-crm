'use client'

import { useRef, useState } from 'react'
import { Upload, FileSpreadsheet, Send, CheckCircle2, XCircle, AlertTriangle, RefreshCw, ArrowLeft, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type PreviewStatus = 'new' | 'duplicate' | 'invalid' | 'unreachable'

interface PreviewRow {
  rowNumber: number
  name: string
  rawPhone: string
  phone: string | null
  status: PreviewStatus
  reason?: string
}

interface PreviewResponse {
  ok: boolean
  detectedColumns: { name: string | null; phone: string | null }
  summary: { total: number; toSend: number; duplicates: number; invalid: number; unreachable: number }
  rows: PreviewRow[]
}

interface ReportRow {
  name: string
  phone: string
  status: 'sent' | 'skipped' | 'failed'
  reason?: string
}

interface SendResponse {
  ok: boolean
  summary: { total: number; sent: number; skipped: number; failed: number }
  report: ReportRow[]
}

type Stage = 'upload' | 'preview' | 'sending' | 'done'

const STATUS_STYLES: Record<PreviewStatus, string> = {
  new: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  duplicate: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  invalid: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  unreachable: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
}

export default function BroadcastClient({ workspaceId }: { workspaceId: string }) {
  const [stage, setStage] = useState<Stage>('upload')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [report, setReport] = useState<SendResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    const ok = /\.(csv|xlsx|xls)$/i.test(file.name)
    if (!ok) {
      toast.error('Please upload a .csv or .xlsx file')
      return
    }
    setFileName(file.name)
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/campaigns/preview', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to parse file')
        return
      }
      setPreview(data)
      setStage('preview')
    } catch {
      toast.error('Network error while uploading')
    } finally {
      setBusy(false)
    }
  }

  async function handleSend() {
    if (!preview) return
    const recipients = preview.rows
      .filter((r) => r.status === 'new' && r.phone)
      .map((r) => ({ name: r.name, phone: r.phone as string }))

    if (recipients.length === 0) {
      toast.error('No valid new recipients to message')
      return
    }

    setStage('sending')
    setBusy(true)
    try {
      const res = await fetch('/api/campaigns/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to send')
        setStage('preview')
        return
      }
      setReport(data)
      setStage('done')
      toast.success(`Sent ${data.summary.sent} message(s)`)
    } catch {
      toast.error('Network error while sending')
      setStage('preview')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setStage('upload')
    setFileName('')
    setPreview(null)
    setReport(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-start gap-3 animate-fade-up">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-md" style={{ backgroundImage: 'var(--brand-gradient)' }}>
          <Megaphone className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">Broadcast to Ad Leads</h1>
          <p className="text-xs text-zinc-500 mt-0.5 max-w-xl">
            Upload your Meta ads sheet, review the list, and send the approved first-message template.
            When a lead replies, the AI takes over automatically.
          </p>
        </div>
      </div>

      {/* ── Upload stage ── */}
      {stage === 'upload' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false)
            const f = e.dataTransfer.files?.[0]
            if (f) handleFile(f)
          }}
          className={cn(
            'rounded-2xl border-2 border-dashed p-12 text-center transition-all',
            dragOver ? 'border-orange-400 bg-orange-50 dark:bg-orange-500/5' : 'border-zinc-300 hover:border-orange-300 dark:border-zinc-700'
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          {busy ? (
            <div className="flex flex-col items-center">
              <RefreshCw className="size-8 text-zinc-400 animate-spin mb-3" />
              <p className="text-sm text-zinc-500">Parsing {fileName}…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-orange-50 dark:bg-orange-500/10">
                <Upload className="size-7 text-orange-500" />
              </div>
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Drag & drop your sheet here</p>
              <p className="text-xs text-zinc-400 mt-1 mb-4">Supports .csv and .xlsx exported from Meta</p>
              <Button onClick={() => inputRef.current?.click()} className="gap-1.5">
                <FileSpreadsheet className="size-4" /> Choose file
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Preview stage ── */}
      {stage === 'preview' && preview && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button onClick={reset} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800">
              <ArrowLeft className="size-3.5" /> Choose another file
            </button>
            <span className="text-xs text-zinc-400">·</span>
            <span className="text-xs text-zinc-500">
              Detected columns — name: <b>{preview.detectedColumns.name ?? '(none)'}</b>, phone: <b>{preview.detectedColumns.phone}</b>
            </span>
          </div>

          {/* Summary cards */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <SummaryCard label="Total rows" value={preview.summary.total} />
            <SummaryCard label="Will send" value={preview.summary.toSend} accent="green" />
            <SummaryCard label="Skipped (dupes)" value={preview.summary.duplicates} accent="amber" />
            <SummaryCard label="Not on WhatsApp" value={preview.summary.unreachable} accent="red" />
            <SummaryCard label="Invalid" value={preview.summary.invalid} accent="red" />
          </div>

          {/* Table */}
          <div className="max-h-[420px] overflow-hidden overflow-y-auto rounded-2xl border border-zinc-200 shadow-sm dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                  {['#', 'Name', 'Phone (normalized)', 'Original', 'Status'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                {preview.rows.map((r) => (
                  <tr key={r.rowNumber} className="transition-colors hover:bg-orange-50/40 dark:hover:bg-zinc-800/40">
                    <td className="px-3 py-2 text-[11px] text-zinc-400">{r.rowNumber}</td>
                    <td className="px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200">{r.name || '—'}</td>
                    <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 font-mono">{r.phone ?? '—'}</td>
                    <td className="px-3 py-2 text-[11px] text-zinc-400 font-mono">{r.rawPhone || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', STATUS_STYLES[r.status])}>
                        {r.status === 'new' ? 'Will send' : r.status === 'duplicate' ? 'Skip' : 'Invalid'}
                      </span>
                      {r.reason && <span className="ml-2 text-[10px] text-zinc-400">{r.reason}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Confirm */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              {preview.summary.toSend} lead(s) will receive the template message.
            </p>
            <Button onClick={handleSend} disabled={busy || preview.summary.toSend === 0} className="gap-1.5">
              <Send className="size-4" /> Send to {preview.summary.toSend} lead(s)
            </Button>
          </div>
        </div>
      )}

      {/* ── Sending stage ── */}
      {stage === 'sending' && (
        <div className="rounded-2xl border border-zinc-200 p-12 text-center shadow-sm dark:border-zinc-800">
          <RefreshCw className="mx-auto mb-3 size-8 animate-spin text-orange-500" />
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Sending messages…</p>
          <p className="text-xs text-zinc-400 mt-1">This can take a moment — messages are throttled to respect WhatsApp limits. Please keep this tab open.</p>
        </div>
      )}

      {/* ── Done stage ── */}
      {stage === 'done' && report && (
        <div>
          <div className="mb-4 grid grid-cols-4 gap-3">
            <SummaryCard label="Total" value={report.summary.total} />
            <SummaryCard label="Sent" value={report.summary.sent} accent="green" />
            <SummaryCard label="Skipped" value={report.summary.skipped} accent="amber" />
            <SummaryCard label="Failed" value={report.summary.failed} accent="red" />
          </div>

          <div className="max-h-[420px] overflow-hidden overflow-y-auto rounded-2xl border border-zinc-200 shadow-sm dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                  {['Name', 'Phone', 'Result', 'Detail'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                {report.report.map((r, i) => (
                  <tr key={i} className="transition-colors hover:bg-orange-50/40 dark:hover:bg-zinc-800/40">
                    <td className="px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200">{r.name || '—'}</td>
                    <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 font-mono">{r.phone}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1 text-xs">
                        {r.status === 'sent' && <CheckCircle2 className="size-3.5 text-green-500" />}
                        {r.status === 'skipped' && <AlertTriangle className="size-3.5 text-amber-500" />}
                        {r.status === 'failed' && <XCircle className="size-3.5 text-red-500" />}
                        <span className="capitalize">{r.status}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-zinc-400">{r.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={reset} variant="outline" className="gap-1.5">
              <Upload className="size-4" /> Upload another sheet
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent?: 'green' | 'amber' | 'red' }) {
  const color =
    accent === 'green' ? 'text-emerald-600 dark:text-emerald-400' :
    accent === 'amber' ? 'text-amber-600 dark:text-amber-400' :
    accent === 'red' ? 'text-red-600 dark:text-red-400' : 'text-zinc-800 dark:text-zinc-100'
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      <p className={cn('mt-1 text-2xl font-extrabold tabular-nums', color)}>{value}</p>
    </div>
  )
}
