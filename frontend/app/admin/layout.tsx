import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ToastProvider } from '@/components/panel/PanelContext';

export const metadata: Metadata = {
  title: { default: 'Boshqaruv paneli // Wan-Net', template: '%s // Wan-Net panel' },
  robots: { index: false, follow: false },
};

/** /admin/ — xodimlar uchun boshqaruv paneli. Ma'lumot faqat brauzerdan /api/panel/ orqali olinadi. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href="/ctf/panel.css" precedence="default" />
      <ToastProvider>{children}</ToastProvider>
    </>
  );
}
