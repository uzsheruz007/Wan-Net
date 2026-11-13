'use client';

import { useState } from 'react';

import { ApiForm } from '@/components/ApiForm';
import { Avatar, TermHead } from '@/components/ui';
import type { Data } from '@/lib/types';

const MAX_MEMBERS = 5;
const COLORS = ['#00ff9c', '#00d1ff', '#b388ff', '#ffc53d', '#ff3b5c', '#5dffc0', '#7dd3fc'];

interface Member {
  id: number;
  username: string;
  points: number;
  is_captain: boolean;
  is_me: boolean;
}

interface Stat {
  label: string;
  value: number;
}

/** Kategoriyalar bo'yicha yechilganlar: halqa diagramma (Chart.js o'rniga SVG) */
function Donut({ stats, points }: { stats: Stat[]; points: number }) {
  const total = stats.reduce((sum, s) => sum + s.value, 0);
  const r = 40;
  const length = 2 * Math.PI * r;
  const arcs = stats.reduce<{ label: string; value: number; color: string; dash: number; offset: number }[]>((acc, s, i) => {
    const offset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0;
    return [...acc, { ...s, color: COLORS[i % COLORS.length], dash: total ? (s.value / total) * length : 0, offset }];
  }, []);

  return (
    <div className="grid gap-4">
      <div className="relative h-48 grid place-items-center">
        <svg viewBox="0 0 100 100" className="h-48 w-48 -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="7" />
          {arcs.map((a) => (
            <circle
              key={a.label}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth="7"
              strokeDasharray={`${Math.max(a.dash - 0.8, 0)} ${length}`}
              strokeDashoffset={-a.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 grid place-items-center pointer-events-none text-center">
          <div>
            <div className="stat-value acc" style={{ margin: 0 }}>
              {points}
            </div>
            <div className="stat-label">jami ball</div>
          </div>
        </div>
      </div>
      {total > 0 && (
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 font-mono text-[10px] text-dim">
          {arcs.map((a) => (
            <li key={a.label} className="flex items-center gap-1.5">
              <i className="w-2 h-2 inline-block" style={{ background: a.color }}></i>
              {a.label} · {a.value}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TokenButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="panel w-full p-4 group"
      style={{ borderStyle: 'dashed', borderColor: 'var(--line-strong)' }}
      onClick={() => navigator.clipboard?.writeText(token).then(() => setCopied(true))}
    >
      <code className="block font-mono text-2xl font-bold text-acc tracking-[0.2em]" style={{ textShadow: '0 0 14px rgba(0,255,156,.4)' }}>
        {token}
      </code>
      <span className="block font-mono text-[10px] text-muted mt-2 group-hover:text-acc" aria-live="polite">
        {copied ? 'NUSXALANDI ✓' : 'NUSXALASH UCHUN BOSING'}
      </span>
    </button>
  );
}

function NoTeam() {
  return (
    <div className="grid-2">
      <section className="panel hud pad rise d1">
        <div className="chal-icon mb-6">
          <i className="fas fa-plus"></i>
        </div>
        <h2 className="section-title mb-2">Jamoa tuzish</h2>
        <p className="text-dim text-sm mb-8">Yangi kiberxavfsizlik guruhini tuzing, do'stlaringizni taklif qiling va turnirlarda qatnashing.</p>
        <ApiForm action="/team/create/" encType="multipart/form-data" className="space-y-5">
          <div>
            <label className="label" htmlFor="team-name">
              Jamoa nomi
            </label>
            <input id="team-name" type="text" name="name" required maxLength={100} className="input" placeholder="dark_packets" />
          </div>
          <div>
            <label className="label" htmlFor="team-motto">
              Shior (ixtiyoriy)
            </label>
            <input id="team-motto" type="text" name="motto" maxLength={255} className="input" placeholder="we pwn, we learn" />
          </div>
          <div>
            <label className="label" htmlFor="team-avatar">
              Logo
            </label>
            <input id="team-avatar" type="file" name="avatar" accept="image/jpeg,image/png,image/gif,image/webp" className="input-file" />
          </div>
          <button type="submit" className="btn btn-solid btn-block">
            <i className="fas fa-check"></i> YARATISH
          </button>
        </ApiForm>
      </section>

      <section className="panel hud pad rise d2">
        <div className="chal-icon mb-6" style={{ color: 'var(--acc-2)' }}>
          <i className="fas fa-right-to-bracket"></i>
        </div>
        <h2 className="section-title mb-2">Jamoaga qo'shilish</h2>
        <p className="text-dim text-sm mb-8">Mavjud jamoaga taklif kodi orqali qo'shiling. Kodni kapitandan so'rang.</p>
        <ApiForm action="/team/join/" className="space-y-5">
          <div>
            <label className="label" htmlFor="team-token">
              Taklif kodi
            </label>
            <input
              id="team-token"
              type="text"
              name="token"
              required
              maxLength={10}
              autoComplete="off"
              className="input text-center text-lg tracking-[0.3em] uppercase"
              placeholder="A1B2C3D4"
            />
          </div>
          <button type="submit" className="btn btn-cyan btn-block">
            JAMOAGA KIRISH <i className="fas fa-arrow-right"></i>
          </button>
        </ApiForm>
      </section>
    </div>
  );
}

/** ctf/team_dashboard.html */
export function Team({ d }: { d: Data }) {
  const team = d.team;

  return (
    <div className="page">
      <header className="mb-10 rise">
        <div className="eyebrow mb-4">team_ops</div>
        <h1 className="page-title">
          Jamoa <span className="hl">boshqaruvi</span>
        </h1>
      </header>

      {!team ? (
        <NoTeam />
      ) : (
        <div className="grid-side">
          <aside className="panel hud pad text-center rise d1">
            <Avatar src={team.avatar} name={team.name} className="w-28 h-28 text-5xl mx-auto mb-5" />
            <h2 className="font-display text-2xl font-bold text-white mb-1 break-all">{team.name}</h2>
            <p className="font-mono text-xs text-acc mb-6">"{team.motto || 'shior yo‘q'}"</p>
            <span className="chip chip-warn mb-8">
              <i className="fas fa-crown"></i> {team.captain}
            </span>

            <div className="divider mb-6"></div>
            <div className="label">taklif kodi</div>
            <TokenButton token={team.token} />
          </aside>

          <div className="flex flex-col gap-5">
            <section className="panel hud rise d2">
              <TermHead title="members.list">
                <span className="chip">
                  {team.members.length} / {MAX_MEMBERS}
                </span>
              </TermHead>
              <ul className="p-4 md:p-5 space-y-3">
                {team.members.map((m: Member) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-4 p-3 border border-[color:var(--line-soft)] bg-black/30 hover:border-[color:var(--line-strong)] transition-colors"
                  >
                    <Avatar name={m.username} className="w-10 h-10" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white truncate">
                        {m.username}
                        {m.is_captain && <i className="fas fa-crown text-warn text-xs ml-1" title="Kapitan"></i>}
                      </div>
                      <div className="font-mono text-[11px] text-muted">
                        {m.is_captain ? 'KAPITAN' : 'OPERATIV'} · <span className="text-acc">{m.points} pts</span>
                      </div>
                    </div>
                    {m.is_me && <span className="chip">SIZ</span>}
                    {m.is_me && !team.is_captain && (
                      <ApiForm action="/team/leave/">
                        <button type="submit" data-confirm="Jamoadan chiqasizmi?" className="btn btn-danger btn-icon" title="Chiqish" aria-label="Jamoadan chiqish">
                          <i className="fas fa-right-from-bracket text-xs"></i>
                        </button>
                      </ApiForm>
                    )}
                    {team.is_captain && !m.is_me && (
                      <ApiForm action={`/team/kick/${m.id}/`}>
                        <button
                          type="submit"
                          data-confirm={`${m.username} chetlashtirilsinmi?`}
                          className="btn btn-danger btn-icon"
                          title="Chetlashtirish"
                          aria-label={`${m.username} ni chetlashtirish`}
                        >
                          <i className="fas fa-xmark"></i>
                        </button>
                      </ApiForm>
                    )}
                  </li>
                ))}
                {team.members.length < MAX_MEMBERS && (
                  <li className="flex items-center gap-4 p-3 border border-dashed border-[color:var(--line-soft)] text-muted font-mono text-xs">
                    <span className="avatar w-10 h-10" style={{ color: 'var(--muted)', borderColor: 'var(--line-soft)' }}>
                      <i className="fas fa-plus"></i>
                    </span>
                    bo'sh o'rin — taklif kodini yuboring
                  </li>
                )}
              </ul>
            </section>

            <section className="panel hud pad rise d3">
              <h3 className="section-title mb-6">Statistika</h3>
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <Donut stats={d.stats} points={team.points} />
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between py-2 border-b border-[color:var(--line-soft)]">
                    <span className="text-muted">YECHILGAN MASALALAR</span>
                    <span className="text-white font-bold">{d.total_solved}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[color:var(--line-soft)]">
                    <span className="text-muted">A'ZOLAR</span>
                    <span className="text-white font-bold">{team.members.length}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[color:var(--line-soft)]">
                    <span className="text-muted">KAPITAN</span>
                    <span className="text-acc font-bold">{team.captain}</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
