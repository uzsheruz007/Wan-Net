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
  const level: string = d.selected_level ?? '';
  const params: Record<string, string> = {};
  if (selected) params.category = selected;
  if (level) params.level = level;
  if (d.query) params.q = d.query;
  // filtr havolasi: bitta qiymat almashadi, boshqasi saqlanadi
  const link = (next: { category?: string; level?: string }) => {
    const q = new URLSearchParams();
    const cat = 'category' in next ? next.category : selected;
    const lvl = 'level' in next ? next.level : level;
    if (cat) q.set('category', cat);
    if (lvl) q.set('level', lvl);
    return `?${q.toString()}`;
  };

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
      </div>

      <div className="flex flex-col gap-3 mb-8 rise d2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <span className="filter-label">Kategoriya</span>
          <Filter href={link({ category: '' })} active={!selected}>
            Barchasi
          </Filter>
          {user.authenticated && (
            <>
              <Filter href={link({ category: 'solved' })} active={selected === 'solved'}>
                ✓ Yechilgan
              </Filter>
              <Filter href={link({ category: 'failed' })} active={selected === 'failed'}>
                Yechilmagan
              </Filter>
            </>
          )}
          {d.categories.map((cat: { code: string; name: string }) => (
            <Filter key={cat.code} href={link({ category: cat.code })} active={cat.code === selected}>
              {cat.name}
            </Filter>
          ))}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <span className="filter-label">Qiyinlik</span>
          {[
            ['', 'Hammasi'],
            ['easy', 'Oson'],
            ['medium', "O'rta"],
            ['hard', 'Qiyin'],
          ].map(([code, name]) => (
            <Filter key={code || 'all'} href={link({ level: code })} active={level === code}>
              {name}
            </Filter>
          ))}
        </div>
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
