'use client';

import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { A, Avatar } from '@/components/ui';
import { type MeResponse, NETWORK_ERROR, panelGet, panelPost } from '@/lib/panel';

import { PanelContext, useToast } from './PanelContext';

type State = { kind: 'loading' } | { kind: 'ready'; me: MeResponse } | { kind: 'forbidden'; message: string } | { kind: 'error' };

function loginUrl() {
  const here = window.location.pathname + window.location.search;
  return `/admin/login/?next=${encodeURIComponent(here)}`;
}

/** Panel karkasi: kirishni tekshiradi, yon menyu va yuqori satr. */
export function PanelShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [menuOpen, setMenuOpen] = useState(false);
  const [crumb, setCrumb] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    panelGet<MeResponse>('me/')
      .then(({ status, data }) => {
        if (!alive) return;
        if (status === 200) setState({ kind: 'ready', me: data });
        else if (status === 401) router.replace(loginUrl());
        else if (status === 403) setState({ kind: 'forbidden', message: data.message ?? '' });
        else setState({ kind: 'error' });
      })
      .catch(() => alive && setState({ kind: 'error' }));
    return () => {
      alive = false;
    };
  }, [router, attempt]);

  // Sahifa almashganda mobil menyu yopiladi
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const handleAuth = useCallback(
    (status: number) => {
      if (status === 401) {
        toast('Sessiya tugadi — qayta kiring.', 'info');
        router.replace(loginUrl());
        return true;
      }
      if (status === 403) {
        setAttempt((n) => n + 1); // huquq o'zgargan bo'lishi mumkin: holatni qayta tekshiramiz
        return true;
      }
      return false;
    },
    [router, toast],
  );

  async function logout() {
    try {
      await panelPost('logout/', new FormData());
    } catch {
      toast(NETWORK_ERROR, 'error');
      return;
    }
    router.replace('/admin/login/');
  }

  const me = state.kind === 'ready' ? state.me : null;
  const api = useMemo(() => (me ? { me, handleAuth, setCrumb } : null), [me, handleAuth]);

  if (state.kind === 'loading') {
    return (
      <main className="adm-login" aria-busy="true">
        <title>Yuklanmoqda // Wan-Net panel</title>
        <p className="adm-sub">
          <i className="fas fa-circle-notch fa-spin" aria-hidden="true"></i> Panel yuklanmoqda…
        </p>
      </main>
    );
  }
  if (state.kind === 'forbidden' || state.kind === 'error') {
    const forbidden = state.kind === 'forbidden';
    return (
      <main className="adm-login">
        <title>{forbidden ? 'Ruxsat yo‘q' : 'Xato'} // Wan-Net panel</title>
        <section className="adm-login-card panel hud pad" role="alert" style={{ textAlign: 'center' }}>
          <i className={`fas ${forbidden ? 'fa-lock' : 'fa-plug-circle-xmark'}`} style={{ fontSize: 28, color: 'var(--danger)' }} aria-hidden="true"></i>
          <h1 className="adm-title" style={{ fontSize: '1.3rem', marginTop: 16 }}>
            {forbidden ? 'Panelga ruxsat yo‘q' : 'Panel yuklanmadi'}
          </h1>
          <p className="adm-sub" style={{ margin: '10px 0 24px' }}>
            {forbidden ? state.message || 'Bu hisob xodim emas.' : NETWORK_ERROR}
          </p>
          <div className="adm-row" style={{ justifyContent: 'center' }}>
            {forbidden ? (
              <button type="button" className="btn btn-solid btn-sm" onClick={logout}>
                <i className="fas fa-right-from-bracket" aria-hidden="true"></i> BOSHQA HISOB
              </button>
            ) : (
              <button type="button" className="btn btn-solid btn-sm" onClick={() => setAttempt((n) => n + 1)}>
                <i className="fas fa-rotate-right" aria-hidden="true"></i> QAYTA URINISH
              </button>
            )}
            <A href="/" className="btn btn-ghost btn-sm">
              SAYTGA
            </A>
          </div>
        </section>
      </main>
    );
  }

  const { user, resources } = state.me;
  const section = resources.find((r) => pathname.startsWith(`/admin/${r.slug}/`));

  return (
    <PanelContext.Provider value={api}>
      <div className="adm">
        <a href="#adm-content" className="adm-skip">
          Asosiy qismga o‘tish
        </a>
        <aside id="adm-side" className={`adm-side ${menuOpen ? 'open' : ''}`} aria-label="Panel menyusi">
          <div className="adm-brand">
            <A href="/admin/" className="brand">
              <img src="/brand/logo-mark.png" alt="" width={34} height={34} className="brand-logo" />
              <span>
                <span className="brand-name">
                  WAN<span>-NET</span>
                </span>
                <small>BOSHQARUV</small>
              </span>
            </A>
          </div>
          <nav className="adm-nav">
            <NavLink href="/admin/" icon="fa-gauge-high" label="Bosh sahifa" active={pathname === '/admin/'} />
            <div className="adm-nav-label">Bo‘limlar</div>
            {resources.map((r) => (
              <NavLink key={r.slug} href={`/admin/${r.slug}/`} icon={r.icon} label={r.label} active={section?.slug === r.slug} />
            ))}
          </nav>
          <div className="adm-side-foot">
            <div className="adm-me">
              <Avatar src={user.avatar} name={user.username} />
              <span>
                <b>{user.username}</b>
                <small>{user.is_superuser ? 'Bosh administrator' : 'Xodim'}</small>
              </span>
            </div>
            <div className="adm-row">
              <A href="/" className="btn btn-ghost btn-sm" style={{ flex: 1 }}>
                <i className="fas fa-arrow-up-right-from-square" aria-hidden="true"></i> SAYT
              </A>
              <button type="button" className="btn btn-ghost btn-sm" onClick={logout} aria-label="Chiqish" title="Chiqish">
                <i className="fas fa-right-from-bracket" aria-hidden="true"></i>
              </button>
            </div>
            {user.is_superuser && (
              <a href="/django-admin/" className="adm-sub" style={{ marginTop: 0 }}>
                <i className="fas fa-screwdriver-wrench" aria-hidden="true"></i> Django admin
              </a>
            )}
          </div>
        </aside>
        {menuOpen && <button type="button" className="adm-backdrop" aria-label="Menyuni yopish" onClick={() => setMenuOpen(false)} />}

        <div className="adm-main">
          <header className="adm-top">
            <button
              type="button"
              className="btn btn-ghost btn-sm adm-menu-btn"
              aria-label="Menyu"
              aria-expanded={menuOpen}
              aria-controls="adm-side"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <i className="fas fa-bars" aria-hidden="true"></i>
            </button>
            <nav className="crumbs" aria-label="Joylashuv">
              <A href="/admin/">panel</A>
              {section && (
                <>
                  {' / '}
                  {crumb ? <A href={`/admin/${section.slug}/`}>{section.label.toLowerCase()}</A> : <span className="cur">{section.label.toLowerCase()}</span>}
                </>
              )}
              {section && crumb && (
                <>
                  {' / '}
                  <span className="cur">{crumb}</span>
                </>
              )}
            </nav>
          </header>
          <main id="adm-content" className="adm-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </PanelContext.Provider>
  );
}

function NavLink({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <A href={href} className={`adm-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
      <i className={`fas ${icon}`} aria-hidden="true"></i>
      {label}
    </A>
  );
}
