import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { THEME_INIT_SCRIPT } from '@/components/ThemeToggle';
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, jsonLd, KEYWORDS, OG_IMAGE, SITE_NAME, SITE_URL } from '@/lib/seo';

const FONTS =
  'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap';
const FONT_AWESOME = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#01080f' },
    { media: '(prefers-color-scheme: light)', color: '#f3f6f8' },
  ],
  colorScheme: 'dark light',
};

/** Sahifalar o'z sarlavha/tavsifini [[...path]]/page.tsx dagi generateMetadata orqali almashtiradi */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: KEYWORDS,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'education',
  alternates: { canonical: '/' },
  formatDetection: { telephone: false, email: false, address: false },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/brand/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/brand/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/brand/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'uz_UZ',
    url: '/',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
  // Search Console / Yandex Webmaster tasdiqlash kodlari .env da (bo'lmasa teg chiqmaydi)
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    yandex: process.env.YANDEX_VERIFICATION || undefined,
  },
};

// CSS tartibi ctf/base.html bilan bir xil: cyber.css Tailwind'dan keyin keladi
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz" className="scroll-smooth" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href={FONTS} rel="stylesheet" />
        <link rel="stylesheet" href={FONT_AWESOME} crossOrigin="anonymous" referrerPolicy="no-referrer" />
        <link rel="stylesheet" href="/ctf/tw.css" />
        <link rel="stylesheet" href="/ctf/cyber.css" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
