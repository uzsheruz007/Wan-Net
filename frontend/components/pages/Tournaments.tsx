'use client';

import { useRouter } from 'next/navigation';

import { ApiForm } from '@/components/ApiForm';
import { ChalCard } from '@/components/ChalCard';
import { Countdown } from '@/components/Countdown';
import { A, Avatar, TermHead } from '@/components/ui';
import type { ChallengeCard, Data } from '@/lib/types';

const pad3 = (n: number) => String(n).padStart(3, '0');

interface TournamentItem {
  id: number;
  title: string;
  mode: 'SOLO' | 'TEAM';
  status: 'ended' | 'live' | 'upcoming';
  start: string;
  description: string;
}

function StatusChip({ status }: { status: TournamentItem['status'] }) {
  if (status === 'ended')
    return (
      <span className="chip chip-danger">
        <i className="fas fa-flag-checkered"></i> TUGAGAN
      </span>
    );
  if (status === 'live')
    return (
      <span className="chip">
        <span className="live-dot"></span> LIVE
      </span>
    );
  return <span className="chip chip-cyan">KUTILMOQDA</span>;
}

/** ctf/tournaments.html */
export function Tournaments({ d }: { d: Data }) {
  const items: TournamentItem[] = d.tournaments;
  return (
    <div className="page">
      <header className="mb-10 rise">
        <div className="eyebrow mb-4">arena</div>
        <h1 className="page-title mb-4">
          Rasmiy <span className="hl">turnirlar</span>
        </h1>
        <p className="page-sub max-w-2xl">
          <span className="p">&gt;</span> Yakka yoki jamoa bo'lib qatnashing, vaqt tugashidan oldin eng ko'p flagni yig'ing.
        </p>
      </header>

      <div className="card-grid rise d1">
        {items.map((t) => (
          <A key={t.id} href={`/tournament/${t.id}/`} className="panel hud panel-interactive block">
            <div className="chal-card chal-card--wrap">
              <div className="chal-visual">
                <span className="chal-cat chip chip-muted">
                  <i className={`fas ${t.mode === 'TEAM' ? 'fa-users' : 'fa-user'}`}></i> {t.mode}
                </span>
                <span className="chal-pts">
                  <StatusChip status={t.status} />
                </span>
                <div className="chal-icon">
                  <i className="fas fa-trophy"></i>
                </div>
              </div>
              <div className="chal-body">
                <h3 className="chal-title mb-2">{t.title}</h3>
                <div className="font-mono text-[11px] text-muted mb-3">
                  <i className="far fa-clock text-acc mr-1"></i> {t.start}
                </div>
                <p className="text-sm text-dim leading-relaxed line-clamp-3 mb-4">{t.description || "Tavsif yo'q"}</p>
                <div className="chal-foot">
                  <span>#T-{pad3(t.id)}</span>
                  <span className="text-acc">
                    KIRISH <i className="fas fa-arrow-right ml-1"></i>
                  </span>
                </div>
              </div>
            </div>
          </A>
        ))}
        {!items.length && (
          <div className="panel hud pad text-center col-span-full">
            <i className="fas fa-trophy text-3xl text-muted mb-4"></i>
            <h3 className="section-title mb-2">Hozircha turnirlar yo'q</h3>
            <p className="page-sub">&gt; Yangi musobaqalar tez orada e'lon qilinadi.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** ctf/tournament_detail.html */
export function TournamentDetail({ d }: { d: Data }) {
  const router = useRouter();
  const t = d.tournament;
  const challenges: ChallengeCard[] = d.challenges;

  return (
    <div className="page">
      <div className="breadcrumb mb-6 rise">
        <A href="/tournaments/">
          <i className="fas fa-chevron-left mr-2"></i>turnirlar
        </A>
        <span className="mx-2">/</span>
        <span className="cur">{t.title}</span>
      </div>

      <section className="panel hud mb-6 rise d1">
        <div className="pad text-center">
          <span className="chip mb-5">
            <span className="live-dot"></span> {t.mode} FORMAT
          </span>
          <h1 className="page-title mb-4">{t.title}</h1>
          <p className="text-dim max-w-2xl mx-auto leading-relaxed mb-8 whitespace-pre-line">{t.description}</p>
          <div className="grid grid-cols-2 max-w-sm mx-auto border-t border-[color:var(--line)] pt-6">
            <div>
              <div className="stat-label">Holat</div>
              <div className={`font-display font-bold text-xl ${t.is_active ? 'text-acc' : 'text-acc2'} mt-1`}>{t.is_active ? 'LIVE' : 'KUTILMOQDA'}</div>
            </div>
            <div>
              <div className="stat-label">Ishtirokchilar</div>
              <div className="font-display font-bold text-xl text-white mt-1">{t.registrations}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel hud rise d2">
        {d.is_registered ? (
          !d.show_challenges ? (
            <div className="pad text-center py-14">
              <span className="chip mb-5">
                <i className="fas fa-check"></i> RO'YXATDAN O'TGANSIZ
              </span>
              <div
                className="font-mono text-4xl md:text-6xl font-bold text-white tracking-widest my-4"
                role="timer"
              >
                <Countdown target={t.start_ms} empty="00:00:00" onDone={() => router.refresh()} />
              </div>
              <div className="stat-label">boshlanishiga qoldi</div>
            </div>
          ) : (
            <>
              <TermHead title={`missions // ${challenges.length} ta`} className="flex-wrap gap-3">
                <span className="chip chip-danger">
                  TUGASHIGA:{' '}
                  <span role="timer">
                    <Countdown target={t.end_ms} empty="--:--:--" />
                  </span>
                </span>
                <A href={`/tournament/${t.id}/leaderboard/`} className="btn btn-ghost btn-sm">
                  <i className="fas fa-ranking-star"></i> NATIJALAR
                </A>
              </TermHead>
              <div className="p-5 md:p-6">
                <div className="card-grid">
                  {challenges.map((c) => (
                    <ChalCard key={c.id} challenge={c} href={`/challenge/${c.id}/?from_tournament=true`} />
                  ))}
                  {!challenges.length && (
                    <div className="col-span-full py-16 text-center font-mono text-muted">
                      <i className="fas fa-ghost text-2xl mb-3 block"></i>Bu turnirda hali masalalar yo'q.
                    </div>
                  )}
                </div>
              </div>
            </>
          )
        ) : (
          <div className="pad text-center py-14">
            <div className="chal-icon mx-auto mb-6">
              <i className="fas fa-user-astronaut"></i>
            </div>
            <h2 className="section-title mb-3">Ishtirok etishga tayyormisiz?</h2>
            {t.mode === 'TEAM' ? (
              <>
                <p className="text-dim text-sm mb-8 max-w-md mx-auto">
                  Bu <b className="text-white">jamoaviy</b> musobaqa. Faqat jamoa kapitani ro'yxatdan o'tkaza oladi.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <ApiForm action={`/tournament/${t.id}/register/`}>
                    <button type="submit" className="btn btn-solid">
                      <i className="fas fa-users"></i> JAMOANI RO'YXATDAN O'TKAZISH
                    </button>
                  </ApiForm>
                  <A href="/team/" className="btn btn-ghost">
                    JAMOA BOSHQARUVI
                  </A>
                </div>
              </>
            ) : (
              <>
                <p className="text-dim text-sm mb-8">Yakka tartibdagi ishtirokchi sifatida ro'yxatdan o'ting.</p>
                <ApiForm action={`/tournament/${t.id}/register/`}>
                  <button type="submit" className="btn btn-solid">
                    <i className="fas fa-user-plus"></i> RO'YXATDAN O'TISH
                  </button>
                </ApiForm>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  is_team: boolean;
  avatar: string;
}

/** ctf/tournament_leaderboard.html */
export function TournamentLeaderboard({ d }: { d: Data }) {
  const rows: ScoreRow[] = d.rows;
  return (
    <div className="page" style={{ maxWidth: '60rem' }}>
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 rise">
        <div>
          <div className="eyebrow mb-4">scoreboard</div>
          <h1 className="page-title" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.2rem)' }}>
            Natijalar <span className="hl">jadvali</span>
          </h1>
          <p className="page-sub mt-2">
            <span className="p">&gt;</span> {d.tournament.title}
          </p>
        </div>
        <A href={`/tournament/${d.tournament.id}/`} className="btn">
          <i className="fas fa-layer-group"></i> MASALALARGA QAYTISH
        </A>
      </header>

      <div className="panel hud rise d1">
        <TermHead title="scoreboard.live">
          <span className="text-acc">
            <span className="live-dot inline-block"></span>
          </span>
        </TermHead>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-20 text-center">#</th>
                <th>Ishtirokchi</th>
                <th className="text-right">Ball</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e, i) => (
                <tr key={`${e.rank}-${e.name}`}>
                  <td className={`text-center font-mono font-bold ${i === 0 ? 'text-warn' : i < 3 ? 'text-acc' : 'text-dim'}`}>
                    {i === 0 ? <i className="fas fa-crown" aria-label="1"></i> : String(i + 1).padStart(2, '0')}
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      {e.avatar ? (
                        <Avatar src={e.avatar} name={e.name} className="w-9 h-9 text-sm" />
                      ) : (
                        <span className="avatar w-9 h-9 text-sm">
                          <i className={`fas ${e.is_team ? 'fa-users' : 'fa-user'} text-xs`}></i>
                        </span>
                      )}
                      <div>
                        <div className="font-semibold text-white">{e.name}</div>
                        <div className="font-mono text-[10px] text-muted">{e.is_team ? 'JAMOA' : 'YAKKA'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right font-mono font-bold text-acc text-lg">{e.score}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={3} className="py-16 text-center font-mono text-muted">
                    <i className="fas fa-magnifying-glass text-2xl mb-3 block"></i>Hozircha natijalar yo'q.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
