'use client';

import { A } from '@/components/ui';
import type { DashboardResponse } from '@/lib/panel';

import { ago, ErrorState, usePanelData } from './common';
import { usePanel } from './PanelContext';

const STAT_LINKS: Record<string, string> = {
  users: '/admin/users/',
  challenges: '/admin/challenges/?active=1',
  solves: '/admin/solves/',
  attempts: '/admin/attempts/',
  labs: '/admin/labs/',
  tournaments: '/admin/tournaments/?active=1',
};

export function Dashboard() {
  const { me } = usePanel();
  const { state, reload } = usePanelData<DashboardResponse>('');

  return (
    <>
      <title>Bosh sahifa // Wan-Net panel</title>
      <div className="adm-head">
        <div>
          <h1 className="adm-title">Bosh sahifa</h1>
          <p className="adm-sub">Salom, {me.user.username}. Platformadagi so‘nggi holat.</p>
        </div>
        <A href="/admin/challenges/new/" className="btn btn-solid btn-sm">
          <i className="fas fa-plus" aria-hidden="true"></i> YANGI MASALA
        </A>
      </div>

      {state.kind === 'error' && <ErrorState message={state.message} status={state.status} onRetry={reload} />}

      {state.kind === 'loading' && (
        <div className="adm-stats" aria-busy="true" aria-label="Yuklanmoqda">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="adm-box adm-stat">
              <div className="adm-skel" style={{ width: '60%' }}></div>
              <div className="adm-skel" style={{ width: '40%', height: 28, marginTop: 12 }}></div>
            </div>
          ))}
        </div>
      )}

      {state.kind === 'ready' && <DashboardBody data={state.data} />}
    </>
  );
}

function DashboardBody({ data }: { data: DashboardResponse }) {
  return (
    <>
      <ul className="adm-stats">
        {data.stats.map((s) => (
          <li key={s.key}>
            <A href={STAT_LINKS[s.key] ?? '/admin/'} className="adm-box adm-stat adm-stat-link">
              <span className="label" style={{ marginBottom: 0 }}>
                {s.label}
              </span>
              <span className="v">{s.value.toLocaleString('uz-UZ')}</span>
              <span className="n">{s.note}</span>
            </A>
          </li>
        ))}
      </ul>

      <div className="adm-grid-2">
        <section className="adm-box" aria-labelledby="recent-title">
          <h2 className="adm-box-head" id="recent-title">
            So‘nggi yechimlar
            <A href="/admin/solves/" className="text-acc2">
              hammasi →
            </A>
          </h2>
          {data.recent.length === 0 ? (
            <div className="adm-empty">
              <i className="fas fa-hourglass-half" aria-hidden="true"></i>
              <p>Hali hech kim masala yechmagan.</p>
            </div>
          ) : (
            <div className="adm-table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Foydalanuvchi</th>
                    <th scope="col">Masala</th>
                    <th scope="col" className="num">
                      Ball
                    </th>
                    <th scope="col">Vaqti</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((r, i) => (
                    <tr key={`${r.time}-${i}`}>
                      <td>
                        <A href={`/admin/users/?q=${encodeURIComponent(r.user)}`} className="row-link">
                          {r.user}
                        </A>
                      </td>
                      <td>
                        <A href={`/admin/challenges/${r.challenge_id}/`} className="row-link">
                          {r.challenge}
                        </A>
                      </td>
                      <td className="num">{r.points}</td>
                      <td className="date">
                        <time dateTime={r.time}>{ago(r.time)}</time>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="adm-box" aria-labelledby="top-title">
          <h2 className="adm-box-head" id="top-title">
            Reyting: top 5
          </h2>
          {data.top.length === 0 ? (
            <div className="adm-empty">
              <i className="fas fa-ranking-star" aria-hidden="true"></i>
              <p>Ball to‘plaganlar hali yo‘q.</p>
            </div>
          ) : (
            <ol className="adm-top5">
              {data.top.map((u, i) => (
                <li key={u.id}>
                  <span className="rank">{String(i + 1).padStart(2, '0')}</span>
                  <A href={`/admin/users/${u.id}/`} className="row-link">
                    {u.username}
                  </A>
                  <span className="pts">{u.points.toLocaleString('uz-UZ')}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
