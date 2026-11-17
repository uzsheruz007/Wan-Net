/**
 * SEO: sayt manzili, brend nomi va har sahifaning sarlavha/tavsifi. Server (generateMetadata, sitemap)
 * va klient tomonda bir xil ishlatiladi, shuning uchun bu faylda 'use client' yo'q.
 */
import type { Data } from './types';

/** Prod'da `NEXT_PUBLIC_SITE_URL=https://<domen>` (build vaqtida o'qiladi) */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wan-net.uz').replace(/\/$/, '');
export const SITE_NAME = 'Wan-Net';
/** Google qidiruvda brendni boshqacha yozganlar uchun ham (JSON-LD alternateName) */
export const SITE_ALT_NAMES = ['WAN-NET', 'Wan Net', 'WanNet', 'Wan-Net CTF', 'wan-net.uz'];
export const TELEGRAM_BOT = 'https://t.me/Wan_Netbot';
export const OG_IMAGE = { url: '/brand/og-image.jpg', width: 1200, height: 630, alt: 'Wan-Net logotipi' };

export const DEFAULT_TITLE = "Wan-Net — CTF va kiberxavfsizlik platformasi | O'zbekiston";
export const DEFAULT_DESCRIPTION =
  "Wan-Net — o'zbek tilidagi CTF (Capture The Flag) platformasi. Web, kriptografiya, forensika, reverse " +
  'engineering va OSINT masalalari, Docker laboratoriyalar, turnirlar va reyting. Kiberxavfsizlikni amalda o‘rganing.';
export const KEYWORDS = [
  'Wan-Net',
  'wan-net.uz',
  'CTF',
  'Capture The Flag',
  'kiberxavfsizlik',
  'kiberxavfsizlik kurslari',
  "axborot xavfsizligi",
  'pentest',
  'web xavfsizlik',
  'kriptografiya',
  'forensika',
  'reverse engineering',
  'OSINT',
  'CTF O‘zbekiston',
  'hacking mashqlari',
  'кибербезопасность',
  'CTF Узбекистан',
];

export interface PageSeo {
  title: string;
  description: string;
  /** false → noindex (shaxsiy yoki login sahifalari) */
  index: boolean;
}

const page = (title: string, description: string, index = true): PageSeo => ({
  title: `${title} | ${SITE_NAME}`,
  description,
  index,
});

/** Django `template` nomi → SEO (SitePageHost dagi PAGES ro'yxati bilan bir xil) */
export function pageSeo(template: string, d: Data): PageSeo {
  switch (template) {
    case 'ctf/ctf_home.html':
      return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, index: true };
    case 'ctf/challenges.html':
      return page(
        'CTF masalalari',
        "Oson, o'rta va qiyin darajadagi CTF masalalari: web, kriptografiya, forensika, reverse engineering, OSINT. " +
          'Flagni toping, ball to‘plang va reytingda ko‘tariling.',
      );
    case 'ctf/challenge_detail.html':
      return page(d.challenge.title, `${d.challenge.title} — Wan-Net CTF masalasi (${d.challenge.category}).`, false);
    case 'ctf/labs.html':
      return page(
        'Docker laboratoriyalar',
        'Haqiqiy zaif servislar: SQL injection, IDOR, LFI, SSTI, JWT, SSRF va command injection. Har bir ishtirokchi uchun alohida Docker konteyner.',
      );
    case 'ctf/leaderboard_v2.html':
      return page('Reyting', 'Wan-Net CTF ishtirokchilari reytingi: eng ko‘p ball to‘plagan xakerlar va jamoalar.');
    case 'ctf/tournaments.html':
      return page('CTF turnirlari', "Wan-Net CTF turnirlari: yakka va jamoaviy musobaqalar, jadval va natijalar.");
    case 'ctf/tournament_detail.html':
      return page(d.tournament.title, `${d.tournament.title} — Wan-Net CTF turniri. ${String(d.tournament.description ?? '').slice(0, 120)}`);
    case 'ctf/tournament_leaderboard.html':
      return page(`Natijalar: ${d.tournament.title}`, `${d.tournament.title} turniri natijalari va g‘oliblar.`);
    case 'ctf/telegram_login.html':
      return page('Tizimga kirish', 'Wan-Net ga Telegram orqali kirish.', false);
    case 'ctf/profile.html':
      return page(`Profil: ${d.username}`, 'Ishtirokchi profili.', false);
    case 'ctf/team_dashboard.html':
      return page('Jamoa', 'Jamoa boshqaruvi.', false);
    default:
      return page(SITE_NAME, DEFAULT_DESCRIPTION, false);
  }
}

/** Qidiruv tizimlari uchun ochiq sahifalar (sitemap) */
export const PUBLIC_PATHS = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/challenges/', priority: 0.9, changeFrequency: 'daily' },
  { path: '/labs/', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/labs/3d/', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/tournaments/', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/leaderboard/', priority: 0.6, changeFrequency: 'daily' },
] as const;

/** Google brend nomi va logotipni shu ma'lumotdan oladi */
export function jsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        alternateName: SITE_ALT_NAMES,
        url: `${SITE_URL}/`,
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/brand/logo-512.png`, width: 512, height: 512 },
        image: `${SITE_URL}/brand/og-image.jpg`,
        description: DEFAULT_DESCRIPTION,
        sameAs: [TELEGRAM_BOT],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: SITE_NAME,
        alternateName: SITE_ALT_NAMES,
        url: `${SITE_URL}/`,
        inLanguage: 'uz',
        description: DEFAULT_DESCRIPTION,
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
    ],
  };
}
