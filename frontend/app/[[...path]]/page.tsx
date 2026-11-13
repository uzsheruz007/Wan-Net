import { SitePageHost } from '@/components/SitePageHost';
import { fetchPage } from '@/lib/server-api';

type Search = Record<string, string | string[] | undefined>;

/** Hamma CTF sahifalari: manzil o'zgarmasdan Django view'iga (/api/page/<yo'l>) uzatiladi, noma'lum yo'l → 404. */
export default async function CtfPage({ params, searchParams }: { params: Promise<{ path?: string[] }>; searchParams: Promise<Search> }) {
  const { path = [] } = await params;
  const suffix = path.length ? `${path.map(encodeURIComponent).join('/')}/` : '';
  return <SitePageHost initial={await fetchPage(suffix, await searchParams)} />;
}
