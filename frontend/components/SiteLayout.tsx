'use client';

import { type ReactNode, useEffect, useState } from 'react';

import { A, Avatar } from '@/components/ui';
import type { PageMessage, PageUser } from '@/lib/types';

import { MatrixCanvas } from './MatrixCanvas';

export type NavKey = 'challenges' | 'labs' | 'tournaments' | 'leaderboard' | 'team' | 'profile' | null;

const LINKS: { key: NavKey; href: string; label: string }[] = [
  { key: 'challenges', href: '/challenges/', label: 'MASHQLAR' },
  { key: 'labs', href: '/labs/', label: 'LABORATORIYA' },
  { key: 'tournaments', href: '/tournaments/', label: 'TURNIRLAR' },
  { key: 'leaderboard', href: '/leaderboard/', label: 'REYTING' },
  { key: 'team', href: '/team/', label: 'JAMOA' },
];

function Toasts({ messages }: { messages: PageMessage[] }) {
  const [visible, setVisible] = useState(messages);
  const [seen, setSeen] = useState(messages);
  const [fading, setFading] = useState(false);

  if (seen !== messages) {
    setSeen(messages);
    setVisible(messages);
    setFading(false);
  }

  useEffect(() => {
    if (!messages.length) return;
    const fade = setTimeout(() => setFading(true), 6000);
    const remove = setTimeout(() => setVisible([]), 6300);
    return () => {
      clearTimeout(fade);
      clearTimeout(remove);
    };
  }, [messages]);

  if (!visible.length) return null;
  return (
    <div id="toasts" className="fixed top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none" role="status" aria-live="polite">
      {visible.map((message, index) => (
        <div
          key={`${index}-${message.text}`}
          className={`toast ${message.tags}`}
          style={fading ? { opacity: 0, transform: 'translateX(20px)' } : undefined}
        >
          <span className="flex-1">{message.text}</span>
          <button
            type="button"
            onClick={() => setVisible((items) => items.filter((item) => item !== message))}
            className="text-muted hover:text-white"
            aria-label="Yopish"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

interface Props {
  user: PageUser;
  year: number;
  messages: PageMessage[];
  nav: NavKey;
  children: ReactNode;
}

/** ctf/base.html: fon, menyu, xabarlar va pastki qism */
export function SiteLayout({ user, year, messages, nav, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [seenNav, setSeenNav] = useState(nav);
  // Boshqa bo'limga o'tilganda mobil menyu yopiladi
  if (seenNav !== nav) {
    setSeenNav(nav);
    setMenuOpen(false);
  }

  return (
    <>
      <div className="bg-stack" aria-hidden="true">
        <div className="bg-glow"></div>
        <div className="bg-grid"></div>
        <MatrixCanvas />
        <div className="bg-scan"></div>
        <div className="bg-vignette"></div>
      </div>

      <nav className="nav">
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between gap-6">
          <A href="/" className="brand">
            <span className="brand-mark">W</span>
            <span className="brand-name">
              WAN<span>-</span>NET
            </span>
            <span className="hidden sm:inline text-[10px] tracking-[0.25em] text-muted">// CTF</span>
          </A>

          <div className="hidden lg:flex items-center gap-7">
            {LINKS.map((link) => (
              <A
                key={link.href}
                href={link.href}
                className={`nav-link ${nav === link.key ? 'active' : ''}`}
                aria-current={nav === link.key ? 'page' : undefined}
              >
                {link.label}
              </A>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {user.authenticated ? (
              <A
                href="/profile/"
                title="Profil"
                aria-current={nav === 'profile' ? 'page' : undefined}
                className="group flex items-center gap-3 pl-3 pr-1 py-1 border border-transparent hover:border-[color:var(--line-strong)] transition-colors"
              >
                <span className="hidden sm:flex flex-col items-end leading-tight">
                  <span className="font-mono text-xs font-bold text-white group-hover:text-acc transition-colors">{user.username}</span>
                  <span className="font-mono text-[9px] tracking-[0.2em] text-acc/70">● ONLINE</span>
                </span>
                <Avatar src={user.avatar} name={user.username} className="w-9 h-9 text-sm" />
              </A>
            ) : (
              <A href="/login/" className="btn btn-sm">
                <i className="fab fa-telegram"></i> KIRISH
              </A>
            )}
            <button
              type="button"
              className="menu-toggle btn btn-ghost btn-icon"
              aria-label="Menyu"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <i className="fas fa-bars"></i>
            </button>
          </div>
        </div>
        <div id="mobile-menu" className={`mobile-menu ${menuOpen ? '' : 'hidden'} lg:hidden`}>
          {LINKS.map((link) => (
            <A key={link.href} href={link.href} className={nav === link.key ? 'active' : ''}>
              &gt; {link.label}
            </A>
          ))}
        </div>
      </nav>

      <Toasts messages={messages} />

      <main>{children}</main>

      <footer className="footer">
        <div className="max-w-7xl mx-auto px-5 py-10 grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <A href="/" className="brand mb-4">
              <span className="brand-mark">W</span>
              <span className="brand-name">
                WAN<span>-</span>NET
              </span>
            </A>
            <p className="font-mono text-xs leading-relaxed text-dim max-w-sm">
              Capture The Flag platformasi. Tizimlarni sinab, buzib va tushunib kiberxavfsizlikni amalda o'rganing.
            </p>
          </div>
          <div>
            <div className="label">// platforma</div>
            <ul className="space-y-2 font-mono text-xs">
              <li>
                <A href="/challenges/">./mashqlar</A>
              </li>
              <li>
                <A href="/labs/">./laboratoriyalar</A>
              </li>
              <li>
                <A href="/tournaments/">./turnirlar</A>
              </li>
              <li>
                <A href="/leaderboard/">./reyting</A>
              </li>
              <li>
                <A href="/team/">./jamoa</A>
              </li>
            </ul>
          </div>
          <div>
            <div className="label">// aloqa</div>
            <ul className="space-y-2 font-mono text-xs">
              <li>
                <a href="https://t.me/Wan_Netbot" target="_blank" rel="noopener">
                  <i className="fab fa-telegram mr-2"></i>@Wan_Netbot
                </a>
              </li>
              {user.authenticated ? (
                <li>
                  <A href="/profile/">
                    <i className="fas fa-user-secret mr-2"></i>profil
                  </A>
                </li>
              ) : (
                <li>
                  <A href="/login/">
                    <i className="fas fa-right-to-bracket mr-2"></i>kirish
                  </A>
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="border-t border-[color:var(--line-soft)]">
          <div className="max-w-7xl mx-auto px-5 py-4 flex flex-col sm:flex-row gap-2 justify-between font-mono text-[10px] tracking-[0.15em] text-muted">
            <span>© {year} WAN-NET // BARCHA HUQUQLAR HIMOYALANGAN</span>
            <span>
              <span className="text-acc">●</span> SYSTEM ONLINE
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
