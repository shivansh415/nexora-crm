import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'
import Providers from '@/components/providers'

export const metadata: Metadata = {
  title: {
    default: 'AI WhatsApp Agent CRM — WhatsApp Automation Platform',
    template: '%s | AI WhatsApp Agent CRM',
  },
  description:
    'AI-powered WhatsApp CRM for agencies. Manage conversations, leads, appointments, and automate customer engagement with AI.',
  keywords: ['WhatsApp CRM', 'AI automation', 'lead management', 'WhatsApp business', 'AI agent'],
  openGraph: {
    type: 'website',
    title: 'AI WhatsApp Agent CRM',
    description: 'AI-powered WhatsApp automation CRM',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
        <Toaster
          position="bottom-right"
          richColors
          toastOptions={{
            style: { fontFamily: 'Inter, sans-serif', fontSize: '13px' },
          }}
        />
      </body>
    </html>
  )
}
