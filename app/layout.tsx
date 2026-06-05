import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

import { SidebarProvider } from '@/lib/context/sidebar-context'
import { AuthProvider } from '@/lib/context/auth-context'
import { MobileSidebar } from '@/components/layout/mobile-sidebar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SILO OPS Central',
  description: 'Sistema de Inteligência Logística Operacional',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <AuthProvider>
          <SidebarProvider>
            <MobileSidebar />
            {children}
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
