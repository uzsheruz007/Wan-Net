'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useRef, useState } from 'react';

import { A } from '@/components/ui';
import { type DetailResponse, NETWORK_ERROR, panelPost } from '@/lib/panel';

import { ConfirmDialog, ErrorState, Hint, usePanelData } from './common';
import { FormFieldInput } from './FormFieldInput';
import { usePanel, useToast } from './PanelContext';

type SubmitMode = 'list' | 'stay';

/** Yaratish (id yo'q) yoki tahrirlash formasi. Validatsiya Django formasida, xatolar maydon yonida. */
export function ResourceForm({ slug, id }: { slug: string; id?: string }) {
  const router = useRouter();
  const toast = useToast();
  const { handleAuth, setCrumb } = usePanel();
  const path = id ? `${slug}/${id}/` : `${slug}/new/`;
  const { state, reload, setState } = usePanelData<DetailResponse>(path);

  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [formError, setFormError] = useState('');
  const [formKey, setFormKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const detail = state.kind === 'ready' ? state.data : null;

  // Serverdan yangi forma kelsa (saqlangach yoki xatolar bilan) maydonlar qaytadan chiziladi
  const [shown, setShown] = useState(detail);
  if (shown !== detail) {
    setShown(detail);
    setFormKey((k) => k + 1);
    setDirty(false);
  }
  const listHref = `/admin/${slug}/`;

  useEffect(() => {
    setCrumb(detail ? detail.title : null);
    return () => setCrumb(null);
  }, [detail, setCrumb]);

  // Saqlanmagan o'zgarishlar bilan sahifadan chiqishda ogohlantirish
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  // Xatoli javobdan keyin birinchi xato maydonga fokus
  useEffect(() => {
    if (!formError || !formRef.current) return;
    const invalid = formRef.current.querySelector<HTMLElement>('[aria-invalid="true"], .adm-field.invalid input, .adm-field.invalid select');
    (invalid ?? document.getElementById('adm-form-alert'))?.focus();
  }, [formError, formKey]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const mode: SubmitMode = submitter?.value === 'stay' ? 'stay' : 'list';
    const body = new FormData(event.currentTarget);
    // Bo'sh fayl maydoni "fayl tanlanmagan" degani — yubormaymiz, aks holda Django uni bo'sh fayl deb tushunadi
    for (const [key, value] of [...body.entries()]) {
      if (value instanceof File && value.size === 0 && !value.name) body.delete(key);
    }

    setBusy(true);
    try {
      const { status, data } = await panelPost<DetailResponse>(path, body);
      if (handleAuth(status)) return;
      if (status === 200 && data.ok) {
        setDirty(false);
        toast(data.message ?? 'Saqlandi.');
        if (mode === 'list') router.push(listHref);
        else if (!id && data.id) router.replace(`/admin/${slug}/${data.id}/`);
        else {
          setFormError('');
          reload();
        }
        return;
      }
      if (status === 400 && data.form) {
        // Server qaytargan bog'langan forma: kiritilgan qiymatlar va xatolar bilan
        setState({ kind: 'ready', data });
        setFormError(data.message || 'Formada xatolar bor.');
        return;
      }
      toast(data.message || NETWORK_ERROR, 'error');
    } catch {
      toast(NETWORK_ERROR, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!id) return;
    setDeleting(true);
    try {
      const { status, data } = await panelPost(`${slug}/${id}/delete/`, new FormData());
      if (handleAuth(status)) return;
      if (status === 200) {
        setDirty(false);
        toast(data.message ?? "O'chirildi.");
        router.push(listHref);
        return;
      }
      toast(data.message || NETWORK_ERROR, 'error');
    } catch {
      toast(NETWORK_ERROR, 'error');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (state.kind === 'error') return <ErrorState message={state.message} status={state.status} onRetry={reload} />;
  if (!detail) return <FormSkeleton />;

  const { meta, form } = detail;
  const fields = new Map(form.fields.map((f) => [f.name, f]));
  const fieldErrors = form.fields.filter((f) => f.errors.length).length;
  const showSide = detail.facts.length > 0 || detail.links.length > 0;

  return (
    <>
      <title>{`${detail.title} // Wan-Net panel`}</title>
      <div className="adm-head">
        <div>
          <h1 className="adm-title">{detail.title}</h1>
          <p className="adm-sub">
            <A href={listHref}>← {meta.label}</A>
            {detail.id && <span> · #{detail.id}</span>}
          </p>
        </div>
      </div>

      <Hint text={meta.hint} />

      <div className={showSide ? 'adm-form-layout' : undefined}>
        <form
          key={formKey}
          ref={formRef}
          className="adm-box"
          onSubmit={onSubmit}
          onChange={() => setDirty(true)}
          aria-busy={busy}
          noValidate
          encType="multipart/form-data"
        >
          {(formError || form.non_field_errors.length > 0) && (
            <div className="adm-alert" role="alert" id="adm-form-alert" tabIndex={-1} style={{ margin: '20px 20px 0' }}>
              <i className="fas fa-triangle-exclamation" aria-hidden="true"></i> {formError}
              {fieldErrors > 0 && ` (${fieldErrors} ta maydon)`}
              {form.non_field_errors.map((e) => (
                <div key={e}>{e}</div>
              ))}
            </div>
          )}

          {form.sections.map((section) => (
            <fieldset key={section.title || 'main'} className="adm-section">
              {section.title && <legend className="adm-section-title">{section.title}</legend>}
              {section.fields.map((name) => {
                const field = fields.get(name);
                return field ? <FormFieldInput key={name} field={field} /> : null;
              })}
            </fieldset>
          ))}

          <div className="adm-form-bar">
            <div className="adm-row">
              <button type="submit" value="list" className="btn btn-solid btn-sm" disabled={busy}>
                {busy ? <i className="fas fa-circle-notch fa-spin" aria-hidden="true"></i> : <i className="fas fa-floppy-disk" aria-hidden="true"></i>}{' '}
                SAQLASH
              </button>
              <button type="submit" value="stay" className="btn btn-ghost btn-sm" disabled={busy}>
                SAQLAB, DAVOM ETISH
              </button>
              <A href={listHref} className="btn btn-ghost btn-sm">
                BEKOR
              </A>
            </div>
            {detail.can_delete && (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)} disabled={busy}>
                <i className="fas fa-trash" aria-hidden="true"></i> O‘CHIRISH
              </button>
            )}
          </div>
        </form>

        {showSide && (
          <aside className="adm-side-col">
            {detail.facts.length > 0 && (
              <section className="adm-box">
                <h2 className="adm-box-head">Ma’lumot</h2>
                <dl className="adm-facts">
                  {detail.facts.map((f) => (
                    <div key={f.label}>
                      <dt>{f.label}</dt>
                      <dd>{f.value || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
            {detail.links.length > 0 && (
              <section className="adm-box">
                <h2 className="adm-box-head">Havolalar</h2>
                <div className="adm-links">
                  {detail.links.map((l) =>
                    l.href.startsWith('/admin/') ? (
                      <A key={l.href} href={l.href}>
                        <i className="fas fa-arrow-right" aria-hidden="true"></i> {l.label}
                      </A>
                    ) : (
                      <a key={l.href} href={l.href} target="_blank" rel="noopener">
                        <i className="fas fa-arrow-up-right-from-square" aria-hidden="true"></i> {l.label}
                      </a>
                    ),
                  )}
                </div>
              </section>
            )}
          </aside>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`${meta.singular}ni o‘chirish`}
        text={`«${detail.title}» butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.`}
        confirmLabel="O‘CHIRISH"
        danger
        busy={deleting}
        onConfirm={onDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
      />
    </>
  );
}

function FormSkeleton() {
  return (
    <div aria-busy="true" aria-label="Yuklanmoqda">
      <div className="adm-skel" style={{ width: 280, height: 28, marginBottom: 28 }}></div>
      <div className="adm-box adm-section">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i}>
            <div className="adm-skel" style={{ width: 120, height: 10, marginBottom: 10 }}></div>
            <div className="adm-skel" style={{ height: 42 }}></div>
          </div>
        ))}
      </div>
    </div>
  );
}
