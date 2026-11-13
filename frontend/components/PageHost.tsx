'use client';

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import type { PageMessage, PagePayload } from '@/lib/types';

interface PageApi {
  /** POST javobidagi sahifa (masalan, forma xatolari bilan) */
  applyPayload: (payload: PagePayload) => void;
  addMessage: (message: PageMessage) => void;
}

const PageContext = createContext<PageApi | null>(null);

export function usePageApi() {
  const api = useContext(PageContext);
  if (!api) throw new Error('PageHost tashqarisida');
  return api;
}

export function PageHost({ initial, children }: { initial: PagePayload; children: (payload: PagePayload) => ReactNode }) {
  const [current, setCurrent] = useState(initial);
  const [seen, setSeen] = useState(initial);

  // Serverdan yangi sahifa keldi (o'tish yoki refresh)
  if (seen !== initial) {
    setSeen(initial);
    setCurrent(initial);
  }

  const addMessage = useCallback(
    (message: PageMessage) => setCurrent((page) => ({ ...page, messages: [...page.messages, message] })),
    [],
  );
  const api = useMemo(() => ({ applyPayload: setCurrent, addMessage }), [addMessage]);

  return <PageContext.Provider value={api}>{children(current)}</PageContext.Provider>;
}
