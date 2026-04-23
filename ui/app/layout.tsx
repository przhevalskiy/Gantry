import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { Providers } from '@/components/providers';
import { AppShell } from '@/components/app-shell';

export const metadata: Metadata = {
  title: 'Gantry — Durable Engineering Crew',
  description: 'Multi-agent software engineering factory.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const agentexAPIBaseURL =
    process.env.NEXT_PUBLIC_AGENTEX_API_BASE_URL ?? 'http://localhost:5003';
  const agentName = process.env.NEXT_PUBLIC_AGENT_NAME ?? 'web-scout';

  return (
    <html lang="en" className={GeistSans.className}>
      <body>
        <Providers agentexAPIBaseURL={agentexAPIBaseURL} agentName={agentName}>
          <AppShell>
            {children}
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
