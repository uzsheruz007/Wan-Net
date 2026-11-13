import type { ReactNode } from 'react';

import { ChalCard } from '@/components/ChalCard';
import { A, Pager } from '@/components/ui';
import type { ChallengeCard, Data, PageUser } from '@/lib/types';

function Filter({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <A href={href} className={`filter ${active ? 'active' : ''}`} aria-current={active ? 'true' : undefined}>
      {children}
    </A>
  );
}

/** ctf/challenges.html */
export function Challenges({ d, user }: { d: Data; user: PageUser }) {
  const selected: string = d.selected_category;
  const params: Record<string, string> = {};
  if (selected) params.category = selected;
  if (d.query) params.q = d.query;

  return (
    <div className="page">
      <header className="mb-10 rise">
        <div className="eyebrow mb-4">challenge_db</div>
        <h1 className="page-title mb-4">
          Topshiriqlar <span className="hl">bazasi</span>
        </h1>
        <p className="page-sub max-w-2xl">
          <span className="p">&gt;</span> Topshiriqni tanlang, zaiflikni toping va flagni qo'lga kiriting.
        </p>
      </header>

      <div className="stat-row mb-10 rise d1">
        <div className="panel hud stat">
          <div className="stat-label">Mavjud topshiriqlar</div>
          <div className="stat-value acc">{d.total_challenges}</div>
        </div>
        <div className="panel hud stat">
          <div className="stat-label">Ko'rsatilmoqda</div>
          <div className="stat-value">{d.displayed_count}</div>
        </div>
        <div className="panel hud stat">
          <div className="stat-label">Tizim holati</div>
          <div className="stat-value text-acc flex items-center gap-3" style={{ fontSize: '1.4rem', paddingTop: 6 }}>
            <span className="live-dot"></span> ONLINE
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-8 rise d2">
        <Filter href="?" active={!selected}>
          * BARCHASI
        </Filter>
        {user.authenticated && (
          <>
            <Filter href="?category=solved" active={selected === 'solved'}>
              ✓ YECHILGAN
            </Filter>
            <Filter href="?category=failed" active={selected === 'failed'}>
              ✕ YECHILMAGAN
            </Filter>
          </>
        )}
        {d.categories.map((cat: { code: string; name: string }) => (
          <Filter key={cat.code} href={`?category=${encodeURIComponent(cat.code)}`} active={cat.code === selected}>
            #{cat.name.toUpperCase()}
          </Filter>
        ))}
      </div>

      <div className="card-grid rise d3">
        {d.challenges.length ? (
          d.challenges.map((c: ChallengeCard) => <ChalCard key={c.id} challenge={c} href={`/challenge/${c.id}/`} />)
        ) : (
          <div className="panel hud pad text-center col-span-full">
            <i className="fas fa-ghost text-3xl text-muted mb-4"></i>
            <h3 className="section-title mb-2">Ma'lumot topilmadi</h3>
            <p className="page-sub mb-6">&gt; Tanlangan kategoriyada topshiriqlar mavjud emas.</p>
            <A href="?" className="btn">
              Barchasini ko'rsatish
            </A>
          </div>
        )}
      </div>

      <Pager page={d.page} params={params} className="mt-12" />
    </div>
  );
}
