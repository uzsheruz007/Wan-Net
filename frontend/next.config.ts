import type { NextConfig } from 'next';

const django = (process.env.DJANGO_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');

/** Sahifa bo'lmagan hamma narsa Django'ga boradi. Prod'da nginx shu yo'llarni to'g'ridan-to'g'ri Django'ga yo'naltiradi. */
const passthrough = [
  '/api/:path*/',
  '/django-admin/',
  '/django-admin/:path*/',
  '/logout/',
  // CTF nishonlari: xom HTML, Django beradi
  '/secret/',
  '/challenge/:id/render/',
];

const config: NextConfig = {
  // Django URL'lari bilan aynan bir xil (bot xabarlaridagi havolalar shunday)
  trailingSlash: true,
  // Faqat `next dev`: 127.0.0.1 orqali ochilganda HMR ulanishi rad etilmasin
  allowedDevOrigins: ['127.0.0.1'],
  async rewrites() {
    return [
      ...passthrough.map((source) => ({ source, destination: `${django}${source}` })),
      { source: '/static/:path*', destination: `${django}/static/:path*` },
      { source: '/media/:path*', destination: `${django}/media/:path*` },
    ];
  },
};

export default config;
