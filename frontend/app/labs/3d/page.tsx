import type { Metadata } from 'next';

import { CyberLabPageHost } from '@/components/lab3d/CyberLabPageHost';
import { OG_IMAGE, SITE_NAME } from '@/lib/seo';
import { fetchPage } from '@/lib/server-api';
import type { PagePayload } from '@/lib/types';

const TITLE = `3D kiber-poligon | ${SITE_NAME}`;
const DESCRIPTION =
  "Interaktiv 3D tarmoq laboratoriyasi: router, WAF, veb-server va ma'lumotlar bazasi. Skanerlash, WAF'ni aylanib o'tish, SQL injection va DDoS himoyasini ko'z bilan kuzating.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/labs/3d/' },
  openGraph: { type: 'website', siteName: SITE_NAME, locale: 'uz_UZ', url: '/labs/3d/', title: TITLE, description: DESCRIPTION, images: [OG_IMAGE] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [OG_IMAGE.url] },
};

export default async function CyberLab3DPage() {
  let initial: PagePayload;
  try {
    initial = await fetchPage('labs/');
  } catch {
    // Django ishlamasa ham sahifa (simulyatsiya) ochiladi
    initial = {
      template: 'ctf/labs.html',
      data: {},
      user: { authenticated: false, is_staff: false, username: '', avatar: '' },
      year: new Date().getFullYear(),
      messages: [],
    };
  }

  return <CyberLabPageHost initial={initial} />;
}
