'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, MessageSquare, CheckCircle2, ArrowRight } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const FEATURES = [
  'AI-powered WhatsApp conversations',
  'Multi-workspace client management',
  'Real-time lead & CRM pipeline',
  'Automated appointment booking',
  'Knowledge base & AI training',
]

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Please fill in all fields.'); return }

    if (!isSupabaseConfigured()) {
      setLoading(true)
      await new Promise((r) => setTimeout(r, 800))
      router.push('/workspace/ws-001/dashboard')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError(authError.message); setLoading(false); return }

    // Fetch the user's real workspace ID
    let wsId = 'ws-001'
    if (authData.user) {
      const { data: membership } = await supabase
        .from('user_workspace_memberships')
        .select('workspace_id')
        .eq('user_id', authData.user.id)
        .limit(1)
        .single() as { data: { workspace_id: string } | null; error: unknown }
      if (membership?.workspace_id) wsId = membership.workspace_id
    }

    toast.success('Welcome back!')
    router.push(`/workspace/${wsId}/dashboard`)
    router.refresh()
  }

  const isDemoMode = !isSupabaseConfigured()

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">

      {/* ── Left Panel ────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden md:w-[45%] md:min-h-screen flex-shrink-0"
        style={{ background: 'linear-gradient(160deg, #7c2d12 0%, #c2410c 38%, #ea580c 68%, #fb923c 100%)' }}
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
          {/* Decorative bubbles — desktop only */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-12 -right-12 size-64 rounded-full bg-white/10" />
            <div className="absolute -bottom-16 -left-8 size-48 rounded-full bg-white/10" />
            {[...Array(6)].map((_, i) => (
              <div key={i} className="absolute rounded-full opacity-25"
                style={{
                  backgroundColor: '#ffedd5',
                  width: `${[8,12,6,10,14,8][i]}px`, height: `${[8,12,6,10,14,8][i]}px`,
                  top: `${[15,35,55,70,45,80][i]}%`, left: `${[80,15,90,40,60,70][i]}%`,
                }}
              />
            ))}
            {/* Mock chat bubbles */}
            <div className="absolute bottom-32 left-6 max-w-[180px]">
              <div className="rounded-lg rounded-bl-none bg-white/20 backdrop-blur-sm px-3 py-2 text-xs text-white/90 shadow-lg mb-2">
                I&apos;d like to schedule a site visit 🏠
              </div>
              <div className="ml-auto rounded-lg rounded-br-none bg-white/30 backdrop-blur-sm px-3 py-2 text-xs text-white/90 shadow-lg max-w-[140px]">
                Sure! I&apos;ve booked it for tomorrow ✅
              </div>
            </div>
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

          {/* Headline + features */}
          <div className="relative space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-white leading-tight mb-3">
                Automate your<br />WhatsApp business
              </h1>
              <p className="text-sm text-white/75 leading-relaxed">
                AI-powered conversations, smart lead management, and real-time analytics — all in one platform.
              </p>
            </div>
            <div className="space-y-2.5">
              {FEATURES.map((feat) => (
                <div key={feat} className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-white/90 shrink-0" />
                  <span className="text-sm text-white/85">{feat}</span>
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

          {/* Demo mode banner */}
          {isDemoMode && (
            <div
              className="mb-5 rounded-xl px-4 py-3 text-xs border"
              style={{
                backgroundColor: 'rgba(249,115,22,0.08)',
                borderColor: 'rgba(249,115,22,0.3)',
                color: 'var(--wa-text-secondary)',
              }}
            >
              <strong style={{ color: 'var(--brand)' }}>Demo Mode</strong> — Any email/password enters the dashboard.
              Add real keys in <code className="rounded px-1" style={{ backgroundColor: 'var(--wa-surface-2)' }}>.env.local</code> to enable auth.
            </div>
          )}

          {/* Heading */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--wa-text-primary)' }}>Welcome back</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--wa-text-secondary)' }}>
              Sign in to your AI WhatsApp Agent CRM
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--wa-text-secondary)' }}>EMAIL ADDRESS</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" required
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all"
                style={{ backgroundColor: 'var(--wa-surface)', borderColor: 'var(--wa-border)', color: 'var(--wa-text-primary)' }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--brand)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--wa-border)')}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--wa-text-secondary)' }}>PASSWORD</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password" required
                  className="w-full rounded-xl border px-4 py-3 pr-12 text-sm outline-none transition-all"
                  style={{ backgroundColor: 'var(--wa-surface)', borderColor: 'var(--wa-border)', color: 'var(--wa-text-primary)' }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--brand)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--wa-border)')}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--wa-text-tertiary)' }}>
                  {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs font-medium hover:underline" style={{ color: 'var(--brand)' }}>
                Forgot password?
              </Link>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg border px-4 py-3 text-sm"
                style={{ backgroundColor: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.3)', color: '#ef4444' }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all',
                loading ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90 active:scale-[0.98]'
              )}
              style={{ backgroundImage: 'var(--brand-gradient)', boxShadow: 'var(--brand-glow)' }}>
              {loading
                ? <><Loader2 className="size-4 animate-spin" />Signing in...</>
                : <><span>Sign in</span><ArrowRight className="size-4" /></>}
            </button>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px" style={{ backgroundColor: 'var(--wa-border)' }} />
            <span className="text-xs" style={{ color: 'var(--wa-text-tertiary)' }}>or</span>
            <div className="flex-1 h-px" style={{ backgroundColor: 'var(--wa-border)' }} />
          </div>

          {/* Sign up link */}
          <p className="text-center text-sm" style={{ color: 'var(--wa-text-secondary)' }}>
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-semibold hover:underline" style={{ color: 'var(--brand)' }}>
              Create account
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
                strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand)' }}>
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
              </svg>
              <span className="text-[11px] font-medium" style={{ color: 'var(--brand)' }}>@shivansh.js</span>
            </a>
          </div>

        </div>
      </div>
    </div>
  )
}
