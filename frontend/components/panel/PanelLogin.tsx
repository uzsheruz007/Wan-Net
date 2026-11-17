'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useRef, useState } from 'react';

import { A } from '@/components/ui';
import { type MeResponse, NETWORK_ERROR, panelGet, panelPost, type PanelUser } from '@/lib/panel';

import { safeNext } from './PanelContext';

/** /admin/login/ — xodimlar login va parol bilan kiradi (ishtirokchilar Telegram orqali saytga kiradi). */
export function PanelLogin() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const passwordRef = useRef<HTMLInputElement>(null);

  // Sessiya allaqachon bor bo'lsa formani ko'rsatmay panelga o'tamiz
  useEffect(() => {
    let alive = true;
    panelGet<MeResponse>('me/')
      .then(({ status }) => {
        if (!alive) return;
        if (status === 200) router.replace(next);
        else setChecking(false);
      })
      .catch(() => alive && setChecking(false));
    return () => {
      alive = false;
    };
  }, [next, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { status, data } = await panelPost<{ user: PanelUser }>('login/', new FormData(event.currentTarget));
      if (status === 200 && data.ok) {
        router.replace(next);
        return;
      }
      setError(data.message || "Kirib bo'lmadi.");
      if (passwordRef.current) {
        passwordRef.current.value = '';
        passwordRef.current.focus();
      }
    } catch {
      setError(NETWORK_ERROR);
    }
    setBusy(false);
  }

  return (
    <main className="adm-login">
      <title>Kirish // Wan-Net panel</title>
      <div className="adm-login-card panel hud">
        <div className="pad">
          <div className="brand" style={{ marginBottom: 28 }}>
            <img src="/brand/logo-mark.png" alt="" width={34} height={34} className="brand-logo" />
            <span>
              <span className="brand-name">
                WAN<span>-NET</span>
              </span>
              <small className="adm-brand-sub">BOSHQARUV PANELI</small>
            </span>
          </div>
          <h1 className="adm-title" style={{ fontSize: '1.4rem' }}>
            Xodimlar uchun kirish
          </h1>
          <p className="adm-sub" style={{ marginBottom: 24 }}>
            Ishtirokchilar saytga <A href="/login/" className="text-acc2">Telegram kodi</A> bilan kiradi.
          </p>

          <form onSubmit={onSubmit} aria-busy={busy || checking} noValidate>
            {error && (
              <div className="adm-alert" role="alert" id="login-error">
                <i className="fas fa-triangle-exclamation" aria-hidden="true"></i> {error}
              </div>
            )}
            <div className="adm-field" style={{ marginBottom: 16 }}>
              <label className="label" htmlFor="username">
                Login
              </label>
              <input
                id="username"
                name="username"
                className="input"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                autoFocus
                disabled={checking}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>
            <div className="adm-field" style={{ marginBottom: 24 }}>
              <label className="label" htmlFor="password">
                Parol
              </label>
              <input
                id="password"
                ref={passwordRef}
                name="password"
                type="password"
                className="input"
                autoComplete="current-password"
                required
                disabled={checking}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>
            <button type="submit" className="btn btn-solid btn-block" disabled={busy || checking}>
              {busy || checking ? (
                <>
                  <i className="fas fa-circle-notch fa-spin" aria-hidden="true"></i> {checking ? 'TEKSHIRILMOQDA' : 'KIRILMOQDA'}
                </>
              ) : (
                <>
                  <i className="fas fa-right-to-bracket" aria-hidden="true"></i> KIRISH
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
