import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { ConfirmProvider, Toaster } from '@vera/ui';
import './globals.css';

const fraunces = Fraunces({
  variable: '--font-display',
  subsets: ['latin'],
  axes: ['opsz', 'SOFT'],
});

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'Vera Calloway · AI Intelligence',
    template: 'Vera Calloway · %s',
  },
  description:
    'An AI AR specialist for roofing contractors. Watches aging, surfaces anomalies, drafts follow-ups, runs the morning briefing.',
  applicationName: 'Vera Calloway',
  authors: [{ name: 'Priority Roofs' }],
  keywords: [
    'accounts receivable',
    'roofing',
    'AI assistant',
    'AR aging',
    'collections',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Vera Calloway',
    title: 'Vera Calloway · AI Intelligence',
    description:
      'An AI AR specialist for roofing contractors. Watches aging, surfaces anomalies, drafts follow-ups, runs the morning briefing.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vera Calloway · AI Intelligence',
    description:
      'An AI AR specialist for roofing contractors. Watches aging, surfaces anomalies, drafts follow-ups, runs the morning briefing.',
  },
  themeColor: '#1A1614',
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} h-full antialiased`}>
      <body className="bg-bg-base text-text-primary min-h-full font-sans">
        <NuqsAdapter>
          <ConfirmProvider>{children}</ConfirmProvider>
        </NuqsAdapter>
        <Toaster />
      </body>
    </html>
  );
}
