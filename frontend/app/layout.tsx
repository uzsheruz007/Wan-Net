import type { ReactNode } from 'react';

const FONTS =
  'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap';
const FONT_AWESOME = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';

export const viewport = { themeColor: '#04070a' };

// CSS tartibi ctf/base.html bilan bir xil: cyber.css Tailwind'dan keyin keladi
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href={FONTS} rel="stylesheet" />
        <link rel="stylesheet" href={FONT_AWESOME} crossOrigin="anonymous" referrerPolicy="no-referrer" />
        <link rel="stylesheet" href="/ctf/tw.css" />
        <link rel="stylesheet" href="/ctf/cyber.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
