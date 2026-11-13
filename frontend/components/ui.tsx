import Link from 'next/link';
import type { ComponentProps, CSSProperties, ReactNode } from 'react';

import type { Paging } from '@/lib/types';

/** Ichki havola. Prefetch o'chiq: sahifa so'rovi Django xabarlarini (toast) sarflaydi. */
export function A(props: ComponentProps<typeof Link>) {
  return <Link prefetch={false} {...props} />;
}

/** Django `linebreaks` bilan xavfsiz qilingan HTML (matn ekranlangan). */
export function Html({ html, className }: { html: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Terminal oynasi sarlavhasi: uchta nuqta, nom va o'ng tomondagi belgi. */
export function TermHead({ title, children, className = '' }: { title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={`term-head ${className}`}>
      <div className="term-dots">
        <i></i>
        <i></i>
        <i></i>
      </div>
      <div className="term-title">{title}</div>
      {children}
    </div>
  );
}

/** Rasm bo'lsa rasm, bo'lmasa nomning birinchi harfi. */
export function Avatar({ src, name, className = '', style }: { src?: string; name: string; className?: string; style?: CSSProperties }) {
  return (
    <span className={`avatar ${className}`} style={style}>
      {src ? <img src={src} alt="" /> : name.charAt(0)}
    </span>
  );
}

export const pad4 = (n: number) => String(n).padStart(4, '0');

/** Sahifalash: joriy so'rov parametrlari saqlanadi, faqat `page` almashadi. */
export function Pager({ page, params, className = '' }: { page: Paging; params?: Record<string, string>; className?: string }) {
  if (page.num_pages <= 1) return null;
  const href = (n: number) => `?${new URLSearchParams({ ...params, page: String(n) }).toString()}`;
  return (
    <nav className={`flex justify-center items-center gap-3 font-mono ${className}`} aria-label="Sahifalar">
      {page.has_previous && (
        <A href={href(page.number - 1)} className="btn btn-ghost btn-sm">
          <i className="fas fa-chevron-left"></i> OLDINGI
        </A>
      )}
      <span className="chip" aria-current="page">
        {page.number} / {page.num_pages}
      </span>
      {page.has_next && (
        <A href={href(page.number + 1)} className="btn btn-ghost btn-sm">
          KEYINGI <i className="fas fa-chevron-right"></i>
        </A>
      )}
    </nav>
  );
}
