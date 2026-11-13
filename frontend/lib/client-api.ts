import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

import type { PagePayload } from './types';

const CSRF_COOKIE = 'csrftoken';

function readCookie(name: string) {
  const prefix = `${name}=`;
  for (const part of document.cookie.split(';')) {
    const item = part.trim();
    if (item.startsWith(prefix)) return decodeURIComponent(item.slice(prefix.length));
  }
  return '';
}

export async function csrfToken() {
  let token = readCookie(CSRF_COOKIE);
  if (!token) {
    await fetch('/api/csrf/', { credentials: 'same-origin' });
    token = readCookie(CSRF_COOKIE);
  }
  return token;
}

export type PostResult = { redirect: string } | PagePayload;

/** Formani mavjud view'ga yuboradi. `path` — sahifa manzili (masalan /panel/guruhlar/5/?tab=jadval). */
export async function postPage(path: string, body: FormData): Promise<PostResult> {
  const response = await fetch(`/api/page${path}`, {
    method: 'POST',
    body,
    credentials: 'same-origin',
    headers: { 'X-CSRFToken': await csrfToken(), accept: 'application/json' },
  });
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) throw new Error(String(response.status));
  const data = await response.json();
  if (!data.redirect && !data.template) throw new Error(String(response.status));
  return data;
}

/** Django redirect'iga o'tadi. Manzil o'zgarmasa ham sahifa serverdan qayta olinadi. */
export function goTo(router: AppRouterInstance, url: string) {
  const target = new URL(url, window.location.href);
  if (target.origin !== window.location.origin) {
    window.location.assign(target.href);
    return;
  }
  const relative = target.pathname + target.search + target.hash;
  if (target.pathname + target.search === window.location.pathname + window.location.search) {
    router.replace(relative);
    router.refresh();
  } else {
    router.push(relative);
  }
}

