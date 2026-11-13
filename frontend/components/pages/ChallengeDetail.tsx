import { ApiForm } from '@/components/ApiForm';
import { Countdown } from '@/components/Countdown';
import { Difficulty } from '@/components/Difficulty';
import { A, Html, pad4, TermHead } from '@/components/ui';
import type { Data } from '@/lib/types';

/** ctf/challenge_detail.html */
export function ChallengeDetail({ d }: { d: Data }) {
  const c = d.challenge;
  const container = d.container;

  return (
    <div className="page" style={{ maxWidth: '64rem' }}>
      <div className="breadcrumb mb-6 rise">
        <A href="/challenges/">
          <i className="fas fa-chevron-left mr-2"></i>mashqlar
        </A>
        <span className="mx-2">/</span>
        <span className="cur">CHALL-{pad4(c.id)}</span>
      </div>

      <article className="panel hud rise d1">
        <TermHead title={`~/ctf/${c.category.toLowerCase()}/chall_${pad4(c.id)}`}>
          <span className="text-acc">●</span>
        </TermHead>

        <div className="pad">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8">
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="chip">{c.category_display}</span>
                {c.is_lab && (
                  <span className="chip chip-cyan">
                    <i className="fas fa-server"></i> LAB
                  </span>
                )}
                {c.difficulty && (
                  <span className="chip chip-muted">
                    <Difficulty level={c.difficulty} />
                  </span>
                )}
                {d.is_solved && (
                  <span className="chip">
                    <i className="fas fa-check"></i> YECHILGAN
                  </span>
                )}
              </div>
              <h1 className="page-title" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)' }}>
                {c.title}
              </h1>
            </div>
            <div className="panel stat text-center shrink-0 min-w-[140px]">
              <div className="stat-value acc" style={{ marginTop: 0 }}>
                {c.points}
              </div>
              <div className="stat-label mt-1">Ball</div>
            </div>
          </div>

          <Html
            html={c.description_html}
            className="text-[15px] leading-relaxed text-[color:var(--text)] border-l-2 border-[color:var(--line-strong)] pl-5 mb-10 [&_p]:mb-3"
          />

          {(c.file_url || c.has_target) && (
            <>
              <div className="label">// resurslar</div>
              <div className="grid-2 mb-10">
                {c.file_url && (
                  <a href={c.file_url} download className="panel panel-interactive flex items-center gap-4 p-4">
                    <span className="avatar w-11 h-11">
                      <i className="fas fa-download text-sm"></i>
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-white">Biriktirilgan fayl</span>
                      <span className="block font-mono text-xs text-muted break-all">{c.file_name}</span>
                    </span>
                  </a>
                )}
                {c.has_target && (
                  <a href={`/challenge/${c.id}/render/`} target="_blank" rel="noopener" className="panel panel-interactive flex items-center gap-4 p-4">
                    <span className="avatar w-11 h-11" style={{ color: 'var(--acc-2)' }}>
                      <i className="fas fa-globe text-sm"></i>
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-white">Nishon sahifa</span>
                      <span className="block font-mono text-xs text-muted">HTTP · yangi oynada ochiladi</span>
                    </span>
                  </a>
                )}
              </div>
            </>
          )}

          {c.is_lab && (
            <div className="panel mb-10" style={{ borderColor: 'rgba(0,209,255,.25)' }}>
              <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="section-title text-base mb-1">
                    <i className="fas fa-server text-acc2 mr-2"></i>Virtual laboratoriya
                  </h3>
                  <p className="text-dim text-sm max-w-md">Bu masala uchun alohida izolyatsiya qilingan Docker konteyner ishga tushiriladi.</p>
                </div>
                {container ? (
                  <div className="flex flex-col gap-3 md:items-end w-full md:w-auto">
                    <a
                      href={container.url}
                      target="_blank"
                      rel="noopener"
                      className="flex items-center gap-3 px-4 py-2 bg-black/50 border border-[color:var(--line-strong)] font-mono text-sm text-acc hover:text-white transition-colors break-all"
                    >
                      <span className="live-dot"></span> {container.url} <i className="fas fa-up-right-from-square text-xs"></i>
                    </a>
                    <ApiForm action={`/challenge/${c.id}/stop/`} className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-muted">
                        ID: {container.short_id} · qoldi{' '}
                        <span role="timer">
                          <Countdown target={container.expires_ms} empty="--:--" />
                        </span>
                      </span>
                      <button type="submit" className="btn btn-danger btn-sm">
                        <i className="fas fa-power-off"></i> TO'XTATISH
                      </button>
                    </ApiForm>
                  </div>
                ) : (
                  <ApiForm action={`/challenge/${c.id}/start/`} className="flex flex-col md:items-end gap-2">
                    <button type="submit" className="btn btn-cyan">
                      <i className="fas fa-bolt"></i> LABNI ISHGA TUSHIRISH
                    </button>
                    <span className="font-mono text-[10px] text-muted">{d.lifetime} daqiqa · 128MB RAM</span>
                  </ApiForm>
                )}
              </div>
            </div>
          )}

          <div className="divider mb-8"></div>
          {d.is_solved ? (
            <div className="panel p-8 text-center" style={{ borderColor: 'var(--line-strong)' }}>
              <i className="fas fa-flag-checkered text-3xl text-acc mb-4"></i>
              <h3 className="section-title text-acc mb-1">Tizim buzildi</h3>
              <p className="font-mono text-xs text-dim">Flag muvaffaqiyatli qo'lga kiritildi va tasdiqlandi.</p>
            </div>
          ) : (
            <ApiForm>
              <label htmlFor="flag" className="prompt mb-3 block">
                <span className="u">root@wan-net</span>:<span className="c">~/submit</span># ./flag --check
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <i className="fas fa-flag absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true"></i>
                  <input
                    type="text"
                    id="flag"
                    name="flag"
                    required
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="FLAG{...}"
                    className="input"
                    style={{ paddingLeft: 42, height: 48 }}
                  />
                </div>
                <button type="submit" className="btn btn-solid" style={{ height: 48 }}>
                  YUBORISH <i className="fas fa-arrow-right"></i>
                </button>
              </div>
            </ApiForm>
          )}
        </div>
      </article>
    </div>
  );
}
