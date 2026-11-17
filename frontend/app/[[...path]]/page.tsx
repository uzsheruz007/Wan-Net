import type { Metadata } from 'next';
import { cache } from 'react';

import { SitePageHost } from '@/components/SitePageHost';
import { OG_IMAGE, pageSeo, SITE_NAME } from '@/lib/seo';
import { fetchPage } from '@/lib/server-api';

type Search = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ path?: string[] }>; searchParams: Promise<Search> };

// generateMetadata va sahifa bitta so'rov ichida Django'ga bir marta murojaat qiladi
const loadPage = cache((suffix: string, search: string) => fetchPage(suffix, JSON.parse(search) as Search));

async function load({ params, searchParams }: Props) {
  const { path = [] } = await params;
  const suffix = path.length ? `${path.map(encodeURIComponent).join('/')}/` : '';
  return { suffix, page: await loadPage(suffix, JSON.stringify(await searchParams)) };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { suffix, page } = await load(props);
  const seo = pageSeo(page.template, page.data);
  // Filtr/sahifa parametrlari bilan ochilgan manzillar asosiy sahifaga kanonik
  const canonical = `/${suffix}`;
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical },
    // openGraph/twitter ota layout'dagini to'liq almashtiradi — rasm va tur shu yerda ham kerak
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'uz_UZ',
      title: seo.title,
      description: seo.description,
      url: canonical,
      images: [OG_IMAGE],
    },
    twitter: { card: 'summary_large_image', title: seo.title, description: seo.description, images: [OG_IMAGE.url] },
    robots: seo.index ? undefined : { index: false, follow: true },
  };
}

/** Hamma CTF sahifalari: manzil o'zgarmasdan Django view'iga (/api/page/<yo'l>) uzatiladi, noma'lum yo'l → 404. */
export default async function CtfPage(props: Props) {
  const { page } = await load(props);
  return <SitePageHost initial={page} />;
}
