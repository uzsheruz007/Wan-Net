import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import type { PagePayload } from './types';

const DJANGO = (process.env.DJANGO_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');
const TIMEOUT_MS = 15_000;

type Search = Record<string, string | string[] | undefined>;

function toQuery(search: Search) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

/** Sahifa ma'lumotini Django view'idan oladi. Redirect va 404 shu yerda hal bo'ladi. */
export async function fetchPage(path: string, search: Search = {}): Promise<PagePayload> {
  const store = await cookies();
  const response = await fetch(`${DJANGO}/api/page/${path}${toQuery(search)}`, {
    headers: { cookie: store.toString(), accept: 'application/json' },
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (response.status === 404) notFound();
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) throw new Error(`Django javobi kutilmagan: ${response.status}`);

  const body = await response.json();
  if (body.redirect) redirect(body.redirect);
  if (!body.template) throw new Error(`Django javobi kutilmagan: ${response.status}`);
  return body as PagePayload;
}
