import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Demo mode: true when no real Supabase keys are configured
const DEMO_MODE = !(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'
)

// Protected routes — require authentication
const PROTECTED_PATHS = ['/workspace', '/agency']
// Auth routes — redirect away if already logged in
const AUTH_PATHS = ['/login', '/register']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Demo mode: bypass all auth ──────────────────────────────────────────
  if (DEMO_MODE) {
    // Root → demo workspace dashboard
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/workspace/ws-001/dashboard', request.url))
    }
    // Auth pages still accessible in demo mode (to preview the UI)
    // but they redirect to dashboard on submit anyway
    return NextResponse.next()
  }

  // ── Real auth mode ──────────────────────────────────────────────────────
  // Create a response we can mutate (for refreshing Supabase session token)
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write to request (for downstream middleware)
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // Rebuild response to carry refreshed cookies
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not write code between createServerClient and getUser.
  // A simple mistake can make session refresh fail.
  const { data: { user } } = await supabase.auth.getUser()

  // ── Root redirect ────────────────────────────────────────────────────────
  if (pathname === '/') {
    if (user) {
      // Fetch the user's first workspace membership to get the real workspace ID
      const { data: membership } = await supabase
        .from('user_workspace_memberships')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single() as { data: { workspace_id: string } | null; error: unknown }
      const wsId = membership?.workspace_id ?? 'ws-001'
      return NextResponse.redirect(new URL(`/workspace/${wsId}/dashboard`, request.url))
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ── Unauthenticated user trying to access protected route ────────────────
  if (!user && PROTECTED_PATHS.some((p) => pathname.startsWith(p))) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname) // preserve redirect target
    return NextResponse.redirect(loginUrl)
  }

  // ── Authenticated user hitting auth pages (login/register) ───────────────
  if (user && AUTH_PATHS.some((p) => pathname.startsWith(p))) {
    // Fetch real workspace and redirect
    const { data: membership } = await supabase
      .from('user_workspace_memberships')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1)
      .single() as { data: { workspace_id: string } | null; error: unknown }
    const wsId = membership?.workspace_id ?? 'ws-001'
    return NextResponse.redirect(new URL(`/workspace/${wsId}/dashboard`, request.url))
  }

  // Return the (potentially updated) response — important for session refresh
  return supabaseResponse
}

export const config = {
  matcher: [
    // Skip static files, API routes, and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
