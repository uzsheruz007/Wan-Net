'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ApiForm } from '@/components/ApiForm';
import { Countdown } from '@/components/Countdown';
import { Difficulty, LEVEL_LABEL, type Level } from '@/components/Difficulty';
import { A, pad4, TermHead } from '@/components/ui';
import type { ChallengeCard, Data, PageUser } from '@/lib/types';

interface LabItem extends ChallengeCard {
  summary: string;
  topic: string;
}

interface ActiveLab {
  url: string;
  short_id: string;
  challenge_id: number;
  title: string;
  started: string;
  expires_ms: number;
}

type Filter = 'all' | Level;

const STEPS = [
  { icon: 'fa-bolt', title: 'Ishga tushiring', text: "Har bir lab sizga alohida, izolyatsiya qilingan Docker konteynerida ochiladi." },
  { icon: 'fa-user-secret', title: 'Zaiflikni toping', text: "Ilovani o'rganing, kirish nuqtalarini sinang va himoyani chetlab o'ting." },
  { icon: 'fa-flag', title: 'Flagni topshiring', text: 'Topilgan WanNet{...} flagini masala sahifasida yuboring va ball oling.' },
];

function ActivePanel({ lab, idle }: { lab: ActiveLab; idle: number }) {
  const router = useRouter();
  return (
    <section className="panel hud mb-10 rise d1" style={{ borderColor: 'rgba(0,209,255,.35)' }} aria-labelledby="active-lab">
      <TermHead title={`lab_${pad4(lab.challenge_id)} // ${lab.short_id}`} className="flex-wrap gap-3">
        <span className="chip chip-cyan">
          <span className="live-dot"></span> ISHLAMOQDA
        </span>
      </TermHead>
      <div className="p-5 md:p-6 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <div className="eyebrow mb-2" style={{ color: 'var(--acc-2)' }}>
            faol laboratoriya
          </div>
          <h2 id="active-lab" className="section-title mb-3">
            {lab.title}
          </h2>
          <a
            href={lab.url}
            target="_blank"
            rel="noopener"
            className="inline-flex max-w-full items-center gap-3 px-4 py-2 bg-black/50 border border-[color:var(--line-strong)] font-mono text-sm text-acc hover:text-white transition-colors break-all"
          >
            {lab.url} <i className="fas fa-up-right-from-square text-xs"></i>
          </a>
          <p className="mt-3 font-mono text-[11px] text-muted">
            {lab.started} da ishga tushgan · {idle} daqiqa ishlatilmasa avtomatik o'chadi
          </p>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          <div className="text-left lg:text-right">
            <div className="stat-label">O'chishiga qoldi</div>
            <div className="font-mono text-3xl font-bold text-white" role="timer">
              <Countdown target={lab.expires_ms} empty="--:--:--" onDone={() => router.refresh()} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <A href={`/challenge/${lab.challenge_id}/`} className="btn btn-ghost btn-sm">
              <i className="fas fa-flag"></i> FLAG YUBORISH
            </A>
            <ApiForm action={`/challenge/${lab.challenge_id}/stop/`}>
              <input type="hidden" name="next" value="labs" />
              <button type="submit" className="btn btn-danger btn-sm" data-confirm="Laboratoriya to'xtatilsinmi? Undagi o'zgarishlar yo'qoladi.">
                <i className="fas fa-power-off"></i> TO'XTATISH
              </button>
            </ApiForm>
          </div>
        </div>
      </div>
    </section>
  );
}

function LabCard({ lab, user, active }: { lab: LabItem; user: PageUser; active: ActiveLab | null }) {
  const running = active?.challenge_id === lab.id;
  return (
    <article className={`panel hud flex flex-col ${running ? 'panel-interactive' : ''}`} style={running ? { borderColor: 'rgba(0,209,255,.45)' } : undefined}>
      <div className="p-5 md:p-6 flex-1 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <Difficulty level={lab.difficulty} />
          <span className="chip chip-muted">{lab.points} PTS</span>
        </div>
        <h3 className="chal-title mb-2">
          <A href={`/challenge/${lab.id}/`} className="hover:text-acc transition-colors">
            {lab.title}
          </A>
        </h3>
        <div className="flex flex-wrap gap-2 mb-4">
          <span className={`chip ${lab.category === 'Crypto' ? 'chip-violet' : ''}`}>{lab.category}</span>
          {lab.topic && <span className="chip chip-muted">{lab.topic}</span>}
        </div>
        <p className="text-sm text-dim leading-relaxed mb-6 flex-1">{lab.summary}</p>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[color:var(--line-soft)]">
          <span className="font-mono text-[11px]">
            {lab.is_solved ? (
              <span className="text-acc">
                <i className="fas fa-check mr-1"></i>YECHILGAN
              </span>
            ) : lab.has_failed_attempt ? (
              <span className="text-danger">
                <i className="fas fa-xmark mr-1"></i>URINILGAN
              </span>
            ) : (
              <span className="text-muted">#{pad4(lab.id)}</span>
            )}
          </span>
          <div className="flex gap-2">
            <A href={`/challenge/${lab.id}/`} className="btn btn-ghost btn-sm">
              BATAFSIL
            </A>
            {!user.authenticated ? null : running ? (
              <a href={active!.url} target="_blank" rel="noopener" className="btn btn-cyan btn-sm">
                <i className="fas fa-up-right-from-square"></i> OCHISH
              </a>
            ) : (
              <ApiForm action={`/challenge/${lab.id}/start/`}>
                <input type="hidden" name="next" value="labs" />
                <button
                  type="submit"
                  className="btn btn-cyan btn-sm"
                  disabled={Boolean(active)}
                  title={active ? "Avval ishlab turgan labni to'xtating" : undefined}
                  aria-disabled={Boolean(active)}
                >
                  <i className="fas fa-bolt"></i> ISHGA TUSHIRISH
                </button>
              </ApiForm>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/** ctf/labs.html — Docker laboratoriyalar */
export function Labs({ d, user }: { d: Data; user: PageUser }) {
  const labs: LabItem[] = d.labs;
  const active: ActiveLab | null = d.active;
  const [filter, setFilter] = useState<Filter>('all');
  const shown = filter === 'all' ? labs : labs.filter((lab) => lab.difficulty === filter);
  const counts = { easy: 0, medium: 0, hard: 0 } as Record<Level, number>;
  labs.forEach((lab) => {
    if (lab.difficulty in counts) counts[lab.difficulty as Level] += 1;
  });

  return (
    <div className="page">
      <header className="mb-10 rise">
        <div className="eyebrow mb-4">attack_labs</div>
        <h1 className="page-title mb-4">
          Virtual <span className="hl">laboratoriyalar</span>
        </h1>
        <p className="page-sub max-w-2xl">
          <span className="p">&gt;</span> Haqiqiy zaif ilovalar — har biri sizga alohida konteynerda. Hujum qiling, flagni oling.
        </p>
      </header>

      <div className="stat-row mb-10 rise d1">
        <div className="panel hud stat">
          <div className="stat-label">Laboratoriyalar</div>
          <div className="stat-value acc">{labs.length}</div>
        </div>
        <div className="panel hud stat">
          <div className="stat-label">Yechilgan</div>
          <div className="stat-value">
            {user.authenticated ? (
              <>
                {d.solved}
                <span className="text-muted text-base"> / {labs.length}</span>
              </>
            ) : (
              '—'
            )}
          </div>
        </div>
        <div className="panel hud stat">
          <div className="stat-label">Bitta lab muddati</div>
          <div className="stat-value text-acc2">
            {d.lifetime}
            <span className="text-muted text-base"> daq</span>
          </div>
        </div>
      </div>

      {active && <ActivePanel lab={active} idle={d.idle} />}

      {!user.authenticated && (
        <div className="panel p-5 mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rise d1">
          <p className="text-dim text-sm">
            <i className="fas fa-lock text-acc mr-2"></i>Laboratoriyani ishga tushirish uchun tizimga kiring.
          </p>
          <A href="/login/?next=/labs/" className="btn btn-sm">
            <i className="fab fa-telegram"></i> KIRISH
          </A>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-8 rise d2" role="group" aria-label="Qiyinlik bo'yicha saralash">
        {(['all', 'easy', 'medium', 'hard'] as Filter[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`filter ${filter === key ? 'active' : ''}`}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {key === 'all' ? `* BARCHASI (${labs.length})` : `#${LEVEL_LABEL[key].toUpperCase()} (${counts[key]})`}
          </button>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 rise d3">
        {shown.map((lab) => (
          <LabCard key={lab.id} lab={lab} user={user} active={active} />
        ))}
        {!shown.length && (
          <div className="panel hud pad text-center col-span-full">
            <i className="fas fa-server text-3xl text-muted mb-4"></i>
            <h3 className="section-title mb-2">Laboratoriya topilmadi</h3>
            <p className="page-sub">&gt; {labs.length ? "Bu darajada hozircha lab yo'q." : "Laboratoriyalar tez orada qo'shiladi."}</p>
          </div>
        )}
      </div>

      <section className="mt-16 grid gap-5 md:grid-cols-3" aria-label="Qanday ishlaydi">
        {STEPS.map((step, i) => (
          <div key={step.title} className="panel p-5">
            <div className="font-mono text-[10px] tracking-[0.2em] text-muted mb-3">QADAM 0{i + 1}</div>
            <h3 className="font-display text-lg font-bold text-white mb-2">
              <i className={`fas ${step.icon} text-acc mr-2`}></i>
              {step.title}
            </h3>
            <p className="text-sm text-dim leading-relaxed">{step.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
