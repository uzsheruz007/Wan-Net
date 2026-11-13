import { ApiForm } from '@/components/ApiForm';
import { TermHead } from '@/components/ui';
import type { Data } from '@/lib/types';

/** ctf/telegram_login.html */
export function Login({ d }: { d: Data }) {
  return (
    <div className="page min-h-[calc(100vh-120px)] flex items-center justify-center">
      <div className="panel hud w-full max-w-md rise">
        <TermHead title="auth_module.exe">
          <i className="fas fa-lock text-acc"></i>
        </TermHead>
        <div className="pad relative">
          <div className="scanbar"></div>
          <div className="text-center mb-8">
            <div className="chal-icon mx-auto mb-5">
              <i className="fas fa-fingerprint"></i>
            </div>
            <h1 className="section-title mb-2">Tizimga kirish</h1>
            <p className="text-dim text-sm">Telegram bot yuborgan 6 xonali kodni kiriting.</p>
          </div>

          <ApiForm>
            {d.error && (
              <div id="code-error" role="alert" className="chip chip-danger w-full justify-center py-3 mb-6 normal-case tracking-normal text-xs">
                [XATO] {d.error}
              </div>
            )}

            <label className="label text-center" htmlFor="access_code">
              access_code
            </label>
            <input
              type="text"
              name="access_code"
              id="access_code"
              className="input text-center text-2xl font-bold mb-6"
              style={{ letterSpacing: '.6em', color: 'var(--acc)', height: 64 }}
              placeholder="••••••"
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-invalid={d.error ? true : undefined}
              aria-describedby={d.error ? 'code-error' : undefined}
              required
              autoFocus
            />

            <button type="submit" className="btn btn-solid btn-block mb-6">
              <i className="fas fa-right-to-bracket"></i> KIRISH
            </button>

            <div className="panel p-4 font-mono text-xs text-dim leading-6">
              <div className="text-acc font-bold mb-1">// YO'RIQNOMA</div>
              1.{' '}
              <a href="https://t.me/Wan_Netbot" target="_blank" rel="noopener" className="text-acc2 underline underline-offset-4">
                @Wan_Netbot
              </a>{' '}
              ga kiring
              <br />
              2. /start ni bosing
              <br />
              3. Kelgan 6 xonali kodni yozing
            </div>
          </ApiForm>
        </div>
      </div>
    </div>
  );
}
