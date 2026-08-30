import type { Metadata } from 'next';
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
});

export const metadata: Metadata = {
  title: 'InsightHire Admin',
  description: 'InsightHire platform operations console',
  robots: 'noindex, nofollow',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icon-mark.png', sizes: '1024x1024', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/favicon.ico'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${plusJakarta.variable} ${ibmPlexMono.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
