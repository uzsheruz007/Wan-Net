'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { NETWORK_ERROR, panelGet } from '@/lib/panel';

import { usePanel } from './PanelContext';

export type Load<T> =
  | { kind: 'loading' }
  | { kind: 'ready'; data: T }
  | { kind: 'error'; message: string; status: number };

/** GET /api/panel/<path>: 401/403 karkasga beriladi, qolgan xatolar ekranda ko'rsatiladi. */
export function usePanelData<T>(path: string) {
  const { handleAuth } = usePanel();
  const [state, setState] = useState<Load<T>>({ kind: 'loading' });
  const [version, setVersion] = useState(0);
  const loaded = useRef(false);

  useEffect(() => {
    let alive = true;
    // Avval yuklangan ma'lumot qayta so'rov paytida ham ko'rinib tursin (filtr almashganda sakramasin)
    if (!loaded.current) setState({ kind: 'loading' });
    panelGet<T>(path)
      .then(({ status, data }) => {
        if (!alive || handleAuth(status)) return;
        if (status === 200) {
          loaded.current = true;
          setState({ kind: 'ready', data });
        } else {
          setState({ kind: 'error', status, message: data.message || NETWORK_ERROR });
        }
      })
      .catch(() => alive && setState({ kind: 'error', status: 0, message: NETWORK_ERROR }));
    return () => {
      alive = false;
    };
  }, [path, version, handleAuth]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { state, reload, setState };
}

/** Matndagi `kod` qismlarini <code> qiladi (bo'lim izohlari uchun). */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/g).map((part, i) =>
        part.startsWith('`') && part.endsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part,
      )}
    </>
  );
}

export function Hint({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p className="adm-hint">
      <i className="fas fa-circle-info" aria-hidden="true"></i>
      <span>
        <RichText text={text} />
      </span>
    </p>
  );
}

export function ErrorState({ message, status, onRetry }: { message: string; status: number; onRetry?: () => void }) {
  const missing = status === 404;
  return (
    <div className="adm-box adm-empty" role="alert">
      <i className={`fas ${missing ? 'fa-ghost' : 'fa-plug-circle-xmark'}`} aria-hidden="true"></i>
      <p>{message}</p>
      {missing ? (
        <a href="/admin/" className="btn btn-ghost btn-sm">
          BOSH SAHIFA
        </a>
      ) : (
        onRetry && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
            <i className="fas fa-rotate-right" aria-hidden="true"></i> QAYTA URINISH
          </button>
        )
      )}
    </div>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}

/** Tasdiqlash oynasi (<dialog>): fokus ichida qoladi, Esc yopadi. */
export function ConfirmDialog({ open, title, text, confirmLabel, danger, busy, onConfirm, onClose }: ConfirmProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="adm-dialog panel" onClose={onClose} aria-labelledby="adm-dialog-title">
      <h2 id="adm-dialog-title" className="adm-dialog-title">
        <i className={`fas ${danger ? 'fa-triangle-exclamation' : 'fa-circle-question'}`} aria-hidden="true"></i> {title}
      </h2>
      <p className="adm-dialog-text">{text}</p>
      <div className="adm-row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy} autoFocus>
          BEKOR QILISH
        </button>
        <button type="button" className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-solid'}`} onClick={onConfirm} disabled={busy}>
          {busy && <i className="fas fa-circle-notch fa-spin" aria-hidden="true"></i>} {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

const TIME = new Intl.DateTimeFormat('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** ISO vaqt → "5 daqiqa oldin" (bir kundan eski bo'lsa sana). */
export function ago(iso: string, now = Date.now()) {
  const date = new Date(iso);
  const seconds = Math.round((now - date.getTime()) / 1000);
  if (seconds < 60) return 'hozirgina';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} daqiqa oldin`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} soat oldin`;
  return TIME.format(date);
}
