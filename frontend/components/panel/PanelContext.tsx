'use client';

import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';

import type { MeResponse } from '@/lib/panel';

export type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

interface ToastApi {
  toast: (text: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TOAST_ICONS: Record<ToastKind, string> = {
  success: 'fa-circle-check text-acc',
  error: 'fa-triangle-exclamation',
  info: 'fa-circle-info',
};

/** Panel bo'ylab qisqa xabarlar (saqlandi, o'chirildi, xato). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (text: string, kind: ToastKind = 'success') => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, kind, text }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 4500);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="adm-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'success' ? '' : t.kind}`}>
            <i className={`fas ${TOAST_ICONS[t.kind]}`} aria-hidden="true"></i>
            <span style={{ flex: 1 }}>{t.text}</span>
            <button type="button" className="adm-toast-x" onClick={() => dismiss(t.id)} aria-label="Yopish">
              <i className="fas fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast: ToastProvider yo‘q');
  return api.toast;
}

interface PanelApi {
  me: MeResponse;
  /** Sessiya tugagan (401) yoki huquq olingan (403) bo'lsa kirish sahifasiga o'tkazadi. true — javob ishlov berildi. */
  handleAuth: (status: number) => boolean;
  /** Yuqori satrdagi joriy sahifa nomi (masalan tahrirlanayotgan yozuv). */
  setCrumb: (label: string | null) => void;
}

export const PanelContext = createContext<PanelApi | null>(null);

export function usePanel() {
  const api = useContext(PanelContext);
  if (!api) throw new Error('usePanel: PanelShell ichida ishlatilsin');
  return api;
}

/** Faqat panel ichidagi nisbiy manzilga qaytaradi (ochiq redirect bo'lmasin). */
export function safeNext(value: string | null) {
  if (!value || !value.startsWith('/admin/') || value.startsWith('//') || value.includes('\\')) return '/admin/';
  return value;
}
