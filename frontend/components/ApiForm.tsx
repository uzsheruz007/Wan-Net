'use client';

import { useRouter } from 'next/navigation';
import { type ComponentProps, type FormEvent, useRef } from 'react';

import { goTo, postPage } from '@/lib/client-api';

import { usePageApi } from './PageHost';

const NETWORK_ERROR = "So'rov bajarilmadi. Internet aloqasini tekshirib, qayta urinib ko'ring.";

type Props = Omit<ComponentProps<'form'>, 'action' | 'onSubmit' | 'method'> & { action?: string };

/** POST forma: mavjud Django view'iga yuboradi. Tugmadagi data-confirm — tasdiqlash so'rovi. */
export function ApiForm({ action, children, ...rest }: Props) {
  const router = useRouter();
  const { applyPayload, addMessage } = usePageApi();
  const busy = useRef(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const question = submitter?.getAttribute('data-confirm');
    if (question && !window.confirm(question)) return;
    if (busy.current) return;

    busy.current = true;
    form.setAttribute('aria-busy', 'true');
    try {
      const target = action ?? window.location.pathname + window.location.search;
      const result = await postPage(target, new FormData(form, submitter));
      if ('redirect' in result) goTo(router, result.redirect);
      else applyPayload(result);
    } catch {
      addMessage({ tags: 'error', text: NETWORK_ERROR });
    } finally {
      busy.current = false;
      form.removeAttribute('aria-busy');
    }
  }

  return (
    <form method="post" onSubmit={onSubmit} {...rest}>
      {children}
    </form>
  );
}
