import { Avatar, Pager, TermHead } from '@/components/ui';
import type { Data } from '@/lib/types';

interface Row {
  rank: number;
  username: string;
  avatar: string;
  points: number;
  last_solved: string;
  is_me: boolean;
}

// Shohsupa: 1-o'rin o'rtada va balandroq
const PODIUM_PLACE = ['md:order-2 md:-translate-y-6', 'md:order-1', 'md:order-3'];

/** ctf/leaderboard_v2.html */
export function Leaderboard({ d }: { d: Data }) {
  const podium: Row[] = d.podium;
  const rows: Row[] = d.rows;

  return (
    <div className="page" style={{ maxWidth: '68rem' }}>
      <header className="text-center mb-14 rise">
        <div className="eyebrow mb-4 justify-center">global_rankings</div>
        <h1 className="page-title">
          Elita <span className="hl">reytingi</span>
        </h1>
      </header>

      {podium.length > 0 && (
        <ol className="grid gap-5 md:grid-cols-3 items-end mb-14" aria-label="Eng yaxshi uchlik">
          {podium.map((p, i) => {
            const first = i === 0;
            return (
              <li
                key={p.rank}
                className={`panel hud pad text-center rise d${i + 1} ${PODIUM_PLACE[i]}`}
                style={first ? { borderColor: 'rgba(255,197,61,.45)' } : undefined}
              >
                <div className={`chip ${first ? 'chip-warn' : 'chip-muted'} mb-5`}>
                  {first && <i className="fas fa-crown"></i>} RANK 0{i + 1}
                </div>
                <Avatar
                  src={p.avatar}
                  name={p.username}
                  className={`mx-auto mb-4 ${first ? 'w-24 h-24 text-4xl' : 'w-20 h-20 text-3xl'}`}
                  style={first ? { borderColor: 'var(--warn)', color: 'var(--warn)' } : undefined}
                />
                <div className="font-mono font-bold text-white truncate">
                  {p.username}
                  {p.is_me && <span className="chip ml-2">SIZ</span>}
                </div>
                <div className={`stat-value ${first ? 'text-warn' : 'acc'}`}>{p.points}</div>
                <div className="stat-label mt-1">ball</div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="panel hud rise d3">
        <TermHead title="leaderboard.db">
          <span>{d.total} agent</span>
        </TermHead>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-20 text-center">#</th>
                <th>Agent</th>
                <th className="text-right">Ball</th>
                <th className="text-right hidden md:table-cell">Oxirgi faollik</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rank} className={r.is_me ? 'me' : ''}>
                  <td className="text-center font-mono font-bold text-dim">{r.rank}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar src={r.avatar} name={r.username} className="w-9 h-9 text-sm" />
                      <span className="font-semibold text-white">{r.username}</span>
                      {r.is_me && <span className="chip">SIZ</span>}
                    </div>
                  </td>
                  <td className="text-right font-mono font-bold text-acc">{r.points}</td>
                  <td className="text-right font-mono text-xs text-muted hidden md:table-cell">{r.last_solved || '—'}</td>
                </tr>
              ))}
              {d.total === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-16 font-mono text-muted">
                    <i className="fas fa-database text-2xl mb-3 block"></i>MA'LUMOT YO'Q
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {d.page.num_pages > 1 && (
          <div className="p-5 border-t border-[color:var(--line)]">
            <Pager page={d.page} />
          </div>
        )}
      </div>
    </div>
  );
}
