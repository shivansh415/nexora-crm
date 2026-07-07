'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, MessageSquare, ArrowRight, User, Mail, Lock } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const score = checks.filter(Boolean).length
  const colors = ['', '#ef4444', '#f59e0b', '#00a884', '#00a884']
  const labels = ['', 'Weak', 'Fair', 'Strong', 'Very strong']
  if (!password) return null
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ backgroundColor: i <= score ? (colors[score] ?? '#00a884') : 'var(--wa-border)' }} />
        ))}
      </div>
      <p className="text-[11px]" style={{ color: colors[score] || 'var(--wa-text-tertiary)' }}>
        {labels[score]}
      </p>
    </div>
  )
}

export default function RegisterForm() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function update(field: keyof typeof form, val: string) {
    setForm((prev) => ({ ...prev, [field]: val }))
    if (error) setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.name || !form.email || !form.password || !form.confirm) {
      setError('Please fill in all fields.'); return
    }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }

    if (!isSupabaseConfigured()) {
      setLoading(true)
      await new Promise((r) => setTimeout(r, 1000))
      toast.success('Account created! Welcome to the demo.')
      router.push('/workspace/ws-001/dashboard')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.name } },
    })
    if (authError) { setError(authError.message); setLoading(false); return }
    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ backgroundColor: 'var(--wa-bg)' }}>
        <div className="w-full max-w-md rounded-2xl border p-8 text-center"
          style={{ backgroundColor: 'var(--wa-surface)', borderColor: 'var(--wa-border)' }}>
          <div className="mb-4 flex justify-center">
            <div className="flex size-16 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(0,168,132,0.12)' }}>
              <MessageSquare className="size-8" style={{ color: 'var(--wa-green)' }} />
            </div>
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--wa-text-primary)' }}>Check your email!</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--wa-text-secondary)' }}>
            We sent a verification link to <strong style={{ color: 'var(--wa-text-primary)' }}>{form.email}</strong>.
          </p>
          <Link href="/login"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
            style={{ backgroundColor: 'var(--wa-green)' }}>
            Back to Sign in
          </Link>
        </div>
      </div>
    )
  }

  const isDemoMode = !isSupabaseConfigured()

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">

      {/* ── Left Panel ─────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden md:w-[45%] md:min-h-screen flex-shrink-0"
        style={{ background: 'linear-gradient(160deg, #075e54 0%, #128c7e 45%, #00a884 80%, #25d366 100%)' }}
      >
        {/* ── MOBILE: compact top banner ─────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-4 md:hidden">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <MessageSquare className="size-5 text-white" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-white/70 leading-tight">AI WhatsApp Agent</p>
            <p className="text-sm font-bold text-white leading-tight">CRM Platform</p>
          </div>
          <div className="ml-auto">
            <p className="text-[9px] font-bold tracking-widest uppercase text-white/60">NEXORA LAB</p>
          </div>
        </div>

        {/* ── DESKTOP: full branding panel ───────────────────────────────── */}
        <div className="hidden md:flex flex-col justify-between h-full min-h-screen px-8 py-10">
          {/* Decorative */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-12 -right-12 size-64 rounded-full bg-white/10" />
            <div className="absolute -bottom-16 -left-8 size-48 rounded-full bg-white/10" />
          </div>

          {/* Logo */}
          <div className="relative flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <MessageSquare className="size-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-white/70 leading-tight">AI WhatsApp Agent</p>
              <p className="text-sm font-bold text-white leading-tight">CRM Platform</p>
            </div>
          </div>

          {/* Headline + steps */}
          <div className="relative space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-white leading-tight mb-3">
                Start automating<br />your business today
              </h1>
              <p className="text-sm text-white/75 leading-relaxed">
                Join hundreds of agencies using AI WhatsApp Agent CRM to grow with intelligent automation.
              </p>
            </div>
            <div className="space-y-4">
              {[
                { step: '1', title: 'Create your account', desc: 'Free to get started' },
                { step: '2', title: 'Connect WhatsApp Business', desc: 'Via Meta Developer API' },
                { step: '3', title: 'Let AI handle conversations', desc: '24/7 automated responses' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex items-start gap-3">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{ backgroundColor: 'rgba(255,255,255,0.25)', color: '#ffffff' }}>
                    {step}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="text-xs text-white/65">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Nexora Lab footer */}
          <div className="relative">
            <p className="text-xs font-bold tracking-widest uppercase text-white/80">NEXORA LAB</p>
            <p className="text-[10px] text-white/50 mt-0.5">by Shivansh · © 2024</p>
          </div>
        </div>
      </div>

      {/* ── Right Panel: Form ─────────────────────────────────────────────── */}
      <div
        className="flex flex-1 items-start md:items-center justify-center px-5 py-8 md:px-12 md:py-12 overflow-y-auto"
        style={{ backgroundColor: 'var(--wa-bg)' }}
      >
        <div className="w-full max-w-md">

          {/* Demo banner */}
          {isDemoMode && (
            <div className="mb-5 rounded-xl border px-4 py-3 text-xs"
              style={{ backgroundColor: 'rgba(0,168,132,0.08)', borderColor: 'rgba(0,168,132,0.3)', color: 'var(--wa-text-secondary)' }}>
              <strong style={{ color: 'var(--wa-green)' }}>Demo Mode</strong> — Registration goes straight to dashboard.
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--wa-text-primary)' }}>Create your account</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--wa-text-secondary)' }}>
              Get started with AI WhatsApp Agent CRM today
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Full name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--wa-text-secondary)' }}>FULL NAME</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4" style={{ color: 'var(--wa-text-tertiary)' }} />
                <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)}
                  placeholder="Shivansh Patidar" required
                  className="w-full rounded-xl border px-4 py-3 pl-10 text-sm outline-none transition-all"
                  style={{ backgroundColor: 'var(--wa-surface)', borderColor: 'var(--wa-border)', color: 'var(--wa-text-primary)' }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--wa-green)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--wa-border)')}
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--wa-text-secondary)' }}>EMAIL ADDRESS</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4" style={{ color: 'var(--wa-text-tertiary)' }} />
                <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)}
                  placeholder="you@example.com" required
                  className="w-full rounded-xl border px-4 py-3 pl-10 text-sm outline-none transition-all"
                  style={{ backgroundColor: 'var(--wa-surface)', borderColor: 'var(--wa-border)', color: 'var(--wa-text-primary)' }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--wa-green)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--wa-border)')}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--wa-text-secondary)' }}>PASSWORD</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4" style={{ color: 'var(--wa-text-tertiary)' }} />
                <input type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  placeholder="Min. 8 characters" required
                  className="w-full rounded-xl border px-4 py-3 pl-10 pr-12 text-sm outline-none transition-all"
                  style={{ backgroundColor: 'var(--wa-surface)', borderColor: 'var(--wa-border)', color: 'var(--wa-text-primary)' }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--wa-green)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--wa-border)')}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--wa-text-tertiary)' }}>
                  {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <PasswordStrength password={form.password} />
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--wa-text-secondary)' }}>CONFIRM PASSWORD</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4" style={{ color: 'var(--wa-text-tertiary)' }} />
                <input type={showPass ? 'text' : 'password'} value={form.confirm}
                  onChange={(e) => update('confirm', e.target.value)}
                  placeholder="Repeat password" required
                  className="w-full rounded-xl border px-4 py-3 pl-10 text-sm outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--wa-surface)',
                    borderColor: form.confirm && form.confirm !== form.password ? 'var(--color-error)' : 'var(--wa-border)',
                    color: 'var(--wa-text-primary)',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--wa-green)')}
                  onBlur={(e) => (e.target.style.borderColor =
                    form.confirm && form.confirm !== form.password ? '#ef4444' : 'var(--wa-border)')}
                />
              </div>
              {form.confirm && form.confirm !== form.password && (
                <p className="text-[11px]" style={{ color: '#ef4444' }}>Passwords do not match</p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg border px-4 py-3 text-sm"
                style={{ backgroundColor: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.3)', color: '#ef4444' }}>
                {error}
              </div>
            )}

            {/* Terms */}
            <p className="text-xs" style={{ color: 'var(--wa-text-tertiary)' }}>
              By creating an account you agree to our{' '}
              <Link href="/terms" className="hover:underline" style={{ color: 'var(--wa-green)' }}>Terms</Link>
              {' '}and{' '}
              <Link href="/privacy" className="hover:underline" style={{ color: 'var(--wa-green)' }}>Privacy Policy</Link>.
            </p>

            {/* Submit */}
            <button type="submit" disabled={loading}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all',
                loading ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90 active:scale-[0.98]'
              )}
              style={{ backgroundColor: 'var(--wa-green)' }}>
              {loading
                ? <><Loader2 className="size-4 animate-spin" />Creating account...</>
                : <><span>Create account</span><ArrowRight className="size-4" /></>}
            </button>
          </form>

          <p className="mt-5 text-center text-sm" style={{ color: 'var(--wa-text-secondary)' }}>
            Already have an account?{' '}
            <Link href="/login" className="font-semibold hover:underline" style={{ color: 'var(--wa-green)' }}>
              Sign in
            </Link>
          </p>

          {/* Nexora Lab branding */}
          <div className="mt-10 flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium tracking-widest uppercase" style={{ color: 'var(--wa-text-tertiary)' }}>Crafted by</span>
              <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'var(--wa-text-secondary)' }}>Nexora Lab</span>
            </div>
            <a href="https://www.instagram.com/shivansh.js/" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 transition-opacity hover:opacity-80">
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--wa-green)' }}>
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
              </svg>
              <span className="text-[11px] font-medium" style={{ color: 'var(--wa-green)' }}>@shivansh.js</span>
            </a>
          </div>

        </div>
      </div>
    </div>
  )
}
