'use client';

import { useRef } from 'react';

import { ApiForm } from '@/components/ApiForm';
import { A, Avatar, pad4, TermHead } from '@/components/ui';
import type { Data } from '@/lib/types';

interface Solved {
  challenge_id: number;
  title: string;
  points: number;
  solved_at: string;
}

function level(count: number) {
  if (count > 10) return 'ELITE';
  if (count > 5) return 'PRO';
  return 'ROOKIE';
}

/** ctf/profile.html */
export function Profile({ d }: { d: Data }) {
  const input = useRef<HTMLInputElement>(null);
  const solved: Solved[] = d.solved;

  return (
    <div className="page">
      <div className="breadcrumb mb-8 rise">
        agents <span className="mx-2">/</span> <span className="cur">{d.username}</span>
      </div>

      <div className="grid-side">
        <aside className="panel hud pad text-center rise d1">
          <div className="scanbar"></div>
          <span className="chip mb-6">ID: {pad4(d.id)}</span>

          <ApiForm encType="multipart/form-data">
            <input
              ref={input}
              type="file"
              name="avatar"
              id="avatar-input"
              className="hidden"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
            />
          </ApiForm>
          <button
            type="button"
            className="group relative block mx-auto mb-6"
            onClick={() => input.current?.click()}
            title="Rasmni almashtirish"
            aria-label="Profil rasmini almashtirish"
          >
            <Avatar src={d.avatar} name={d.username} className="w-32 h-32 text-5xl" />
            <span className="absolute inset-0 grid place-items-center bg-black/70 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity text-acc">
              <i className="fas fa-camera text-xl"></i>
            </span>
          </button>

          <h1 className="font-display text-2xl font-bold text-white mb-1 break-all">{d.username}</h1>
          <div className="font-mono text-xs text-muted mb-8">{d.email || 'email biriktirilmagan'}</div>

          <div className="space-y-2 text-left font-mono text-xs mb-8">
            <div className="flex justify-between py-2 border-b border-[color:var(--line-soft)]">
              <span className="text-muted">QO'SHILGAN</span>
              <span className="text-white">{d.date_joined}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[color:var(--line-soft)]">
              <span className="text-muted">REYTING</span>
              <span className="text-acc font-bold">#{d.rank}</span>
            </div>
          </div>

          <a href="/logout/" className="btn btn-danger btn-block">
            <i className="fas fa-power-off"></i> TIZIMDAN CHIQISH
          </a>
        </aside>

        <div className="flex flex-col gap-5">
          <div className="stat-row rise d2">
            <div className="panel hud stat">
              <div className="stat-label">Jami ball</div>
              <div className="stat-value acc">{d.total_points}</div>
            </div>
            <div className="panel hud stat">
              <div className="stat-label">Yechilganlar</div>
              <div className="stat-value">{solved.length}</div>
            </div>
            <div className="panel hud stat">
              <div className="stat-label">Daraja</div>
              <div className="stat-value text-acc2">{level(solved.length)}</div>
            </div>
          </div>

          <div className="panel hud rise d3">
            <TermHead title="activity_log.sh">
              <span>{solved.length} yozuv</span>
            </TermHead>
            <div className="overflow-auto max-h-[460px]">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Holat</th>
                    <th>Masala</th>
                    <th className="text-right">Ball</th>
                    <th className="text-right hidden sm:table-cell">Vaqt</th>
                  </tr>
                </thead>
                <tbody>
                  {solved.map((s) => (
                    <tr key={s.challenge_id}>
                      <td className="font-mono text-xs font-bold text-acc">[OK]</td>
                      <td>
                        <A href={`/challenge/${s.challenge_id}/`} className="text-white font-semibold hover:text-acc transition-colors">
                          {s.title}
                        </A>
                      </td>
                      <td className="text-right font-mono font-bold text-acc">+{s.points}</td>
                      <td className="text-right font-mono text-xs text-muted hidden sm:table-cell">{s.solved_at}</td>
                    </tr>
                  ))}
                  {!solved.length && (
                    <tr>
                      <td colSpan={4} className="py-14 text-center font-mono text-xs text-muted">
                        &gt; Hozircha faoliyat yo'q.
                        <br />
                        &gt; Masalalarni yechishni boshlang.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
