'use client';

import { useSyncExternalStore } from 'react';

type Theme = 'dark' | 'light';
const KEY = 'wn-theme';
const EVENT = 'wn-theme-change';

/** <head> ichida bo'yashdan oldin ishlaydi: saqlangan tanlov, bo'lmasa tizim sozlamasi */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${KEY}');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}})();`;

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

const current = (): Theme => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, current, () => 'dark' as Theme);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  function toggle() {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // saqlab bo'lmasa ham rejim shu sahifada ishlaydi
    }
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-ghost btn-icon theme-toggle"
      aria-label={next === 'light' ? 'Kunduzgi rejimga o‘tish' : 'Tungi rejimga o‘tish'}
      title={next === 'light' ? 'Kunduzgi rejim' : 'Tungi rejim'}
    >
      <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`} aria-hidden="true"></i>
    </button>
  );
}
