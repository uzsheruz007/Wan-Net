import type { Metadata } from 'next';

import { ScadaPageHost } from '@/components/scada/ScadaPageHost';
import { OG_IMAGE, SITE_NAME } from '@/lib/seo';
import { fetchPage } from '@/lib/server-api';
import type { PagePayload } from '@/lib/types';

const TITLE = `SCADA / ICS Sanoat Kiber-Poligoni | ${SITE_NAME}`;
const DESCRIPTION =
  "Kritik infratuzilma va sanoat boshqaruv tizimlari (SCADA/ICS) kiber-fizik laboratoriyasi. Modbus TCP, DNP3, PLC relelari, sensorlar va Stuxnet-uslubidagi stansiya diversiyasi.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/labs/scada/' },
  openGraph: { type: 'website', siteName: SITE_NAME, locale: 'uz_UZ', url: '/labs/scada/', title: TITLE, description: DESCRIPTION, images: [OG_IMAGE] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [OG_IMAGE.url] },
};

export default async function ScadaLabPage() {
  let initial: PagePayload;
  try {
    initial = await fetchPage('labs/');
  } catch {
    initial = {
      template: 'ctf/labs.html',
      data: {},
      user: { authenticated: false, is_staff: false, username: '', avatar: '' },
      year: new Date().getFullYear(),
      messages: [],
    };
  }

  return <ScadaPageHost initial={initial} />;
}
