'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';

import { A } from '@/components/ui';
import { type Cell, type ColumnKind, type ListResponse, type Meta, NETWORK_ERROR, panelPost } from '@/lib/panel';

import { ConfirmDialog, ErrorState, Hint, usePanelData } from './common';
import { usePanel, useToast } from './PanelContext';

type Row = ListResponse['rows'][number];
type ActionMeta = Meta['actions'][number];

const CELL_CLASS: Partial<Record<ColumnKind, string>> = { number: 'num', mono: 'mono', date: 'date' };

/** Bo'lim ro'yxati: qidiruv, filtrlar, sahifalash va tanlanganlarga ommaviy amal. Holat URL'da saqlanadi. */
export function ResourceList({ slug }: { slug: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.toString();
  const { handleAuth } = usePanel();
  const toast = useToast();
  const { state, reload } = usePanelData<ListResponse>(`${slug}/${query ? `?${query}` : ''}`);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [actionKey, setActionKey] = useState('');
  const [pending, setPending] = useState<ActionMeta | null>(null);
  const [busy, setBusy] = useState(false);

  // Sahifa yoki filtr almashsa tanlov bekor bo'ladi (boshqa ro'yxatdagi yozuvga tasodifan amal qilinmasin)
  const [lastQuery, setLastQuery] = useState(query);
  if (lastQuery !== query) {
    setLastQuery(query);
    setSelected(new Set());
  }

  const update = useCallback(
    (changes: Record<string, string>) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      if (!('page' in changes)) next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  async function runAction(action: ActionMeta) {
    setBusy(true);
    const body = new FormData();
    body.set('action', action.key);
    for (const id of selected) body.append('ids', String(id));
    try {
      const { status, data } = await panelPost(`${slug}/action/`, body);
      if (handleAuth(status)) return;
      if (status === 200) {
        toast(data.message ?? 'Bajarildi.');
        setSelected(new Set());
        setActionKey('');
        reload();
      } else {
        toast(data.message || NETWORK_ERROR, 'error');
      }
    } catch {
      toast(NETWORK_ERROR, 'error');
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  function startAction() {
    if (state.kind !== 'ready') return;
    const action = state.data.meta.actions.find((a) => a.key === actionKey);
    if (!action) return;
    if (action.confirm || action.danger) setPending(action);
    else runAction(action);
  }

  if (state.kind === 'error') return <ErrorState message={state.message} status={state.status} onRetry={reload} />;

  const data = state.kind === 'ready' ? state.data : null;
  const meta = data?.meta;
  const rows = data?.rows ?? [];
  const actions = meta?.actions ?? [];
  const filtersActive = Boolean(params.get('q')) || (meta?.filters ?? []).some((f) => params.get(f.key));
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <title>{`${meta?.label ?? 'Yuklanmoqda'} // Wan-Net panel`}</title>
      <div className="adm-head">
        <div>
          <h1 className="adm-title">
            {meta ? (
              <>
                <i className={`fas ${meta.icon} text-acc`} aria-hidden="true" style={{ fontSize: '0.8em', marginRight: 12 }}></i>
                {meta.label}
              </>
            ) : (
              <span className="adm-skel" style={{ display: 'inline-block', width: 220, height: 28 }}></span>
            )}
          </h1>
          <p className="adm-sub" aria-live="polite">
            {data ? `${data.page.count.toLocaleString('uz-UZ')} ta yozuv${filtersActive ? ' (filtrlangan)' : ''}` : ' '}
          </p>
        </div>
        {meta?.can_create && (
          <A href={`/admin/${slug}/new/`} className="btn btn-solid btn-sm">
            <i className="fas fa-plus" aria-hidden="true"></i> YANGI {meta.singular.toUpperCase()}
          </A>
        )}
      </div>

      {meta && <Hint text={meta.hint} />}

      <section className="adm-box" aria-label={meta?.label}>
        {meta && (meta.searchable || meta.filters.length > 0) && (
          <Toolbar meta={meta} params={params} onChange={update} filtersActive={filtersActive} />
        )}

        {selected.size > 0 && actions.length > 0 && (
          <div className="adm-bulk" role="region" aria-label="Tanlanganlar bilan amal">
            <span>{selected.size} ta tanlandi</span>
            <label className="sr-only" htmlFor="bulk-action">
              Amal
            </label>
            <select id="bulk-action" className="input" style={{ width: 'auto' }} value={actionKey} onChange={(e) => setActionKey(e.target.value)}>
              <option value="">Amalni tanlang…</option>
              {actions.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`btn btn-sm ${actions.find((a) => a.key === actionKey)?.danger ? 'btn-danger' : 'btn-solid'}`}
              disabled={!actionKey || busy}
              onClick={startAction}
            >
              {busy ? <i className="fas fa-circle-notch fa-spin" aria-hidden="true"></i> : <i className="fas fa-bolt" aria-hidden="true"></i>} BAJARISH
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
              BEKOR
            </button>
          </div>
        )}

        {!data ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <div className="adm-empty">
            <i className={`fas ${filtersActive ? 'fa-filter-circle-xmark' : meta!.icon}`} aria-hidden="true"></i>
            <p>{filtersActive ? 'Bu shartlarga mos yozuv topilmadi.' : `Hali ${meta!.label.toLowerCase()} yo‘q.`}</p>
            {filtersActive ? (
              <A href={pathname} className="btn btn-ghost btn-sm">
                <i className="fas fa-xmark" aria-hidden="true"></i> FILTRLARNI TOZALASH
              </A>
            ) : (
              meta!.can_create && (
                <A href={`/admin/${slug}/new/`} className="btn btn-solid btn-sm">
                  <i className="fas fa-plus" aria-hidden="true"></i> BIRINCHISINI QO‘SHISH
                </A>
              )
            )}
          </div>
        ) : (
          <div className="adm-table-wrap" aria-busy={state.kind === 'loading'}>
            <table className="tbl">
              <thead>
                <tr>
                  {actions.length > 0 && (
                    <th scope="col" className="check">
                      <input type="checkbox" className="adm-check" checked={allChecked} onChange={toggleAll} aria-label="Sahifadagi hammasini tanlash" />
                    </th>
                  )}
                  {meta!.columns.map((c) => (
                    <th key={c.key} scope="col" className={c.kind === 'number' ? 'num' : undefined}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={selected.has(row.id) ? 'selected' : undefined}>
                    {actions.length > 0 && (
                      <td className="check">
                        <input
                          type="checkbox"
                          className="adm-check"
                          checked={selected.has(row.id)}
                          onChange={() => toggle(row.id)}
                          aria-label={`#${row.id} ni tanlash`}
                        />
                      </td>
                    )}
                    {meta!.columns.map((c, i) => (
                      <td key={c.key} className={CELL_CLASS[c.kind]}>
                        {meta!.can_edit && i === linkColumn(meta!) ? (
                          <A href={`/admin/${slug}/${row.id}/`} className="row-link">
                            <CellValue value={row[c.key]} kind={c.kind} />
                          </A>
                        ) : (
                          <CellValue value={row[c.key]} kind={c.kind} />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.page.num_pages > 1 && (
          <nav className="adm-foot" aria-label="Sahifalar">
            <span>
              {data.page.number} / {data.page.num_pages} sahifa
            </span>
            <div className="adm-pager">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={data.page.number <= 1}
                onClick={() => update({ page: String(data.page.number - 1) })}
              >
                <i className="fas fa-chevron-left" aria-hidden="true"></i> OLDINGI
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={data.page.number >= data.page.num_pages}
                onClick={() => update({ page: String(data.page.number + 1) })}
              >
                KEYINGI <i className="fas fa-chevron-right" aria-hidden="true"></i>
              </button>
            </div>
          </nav>
        )}
      </section>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.label ?? ''}
        text={pending?.confirm || `Tanlangan ${selected.size} ta yozuvga «${pending?.label}» amali qo‘llansinmi?`}
        confirmLabel={`${pending?.label.toUpperCase() ?? ''} (${selected.size})`}
        danger={pending?.danger}
        busy={busy}
        onConfirm={() => pending && runAction(pending)}
        onClose={() => !busy && setPending(null)}
      />
    </>
  );
}

/** Tahrirlash havolasi qo'yiladigan ustun: '#' dan keyingi birinchi matnli ustun. */
function linkColumn(meta: Meta) {
  const index = meta.columns.findIndex((c) => c.key !== 'id' && (c.kind === 'text' || c.kind === 'chip'));
  return index === -1 ? 0 : index;
}

function CellValue({ value, kind }: { value: Cell; kind: ColumnKind }) {
  if (kind === 'bool') {
    return value ? (
      <span className="adm-bool y">
        <i className="fas fa-check" aria-hidden="true"></i>
        <span className="sr-only">Ha</span>
      </span>
    ) : (
      <span className="adm-bool n">
        <i className="fas fa-minus" aria-hidden="true"></i>
        <span className="sr-only">Yo‘q</span>
      </span>
    );
  }
  if (value === null || value === '') return <span className="text-dim">—</span>;
  if (kind === 'chip') return <span className="chip chip-muted">{String(value)}</span>;
  if (kind === 'number' && typeof value === 'number') return <>{value.toLocaleString('uz-UZ')}</>;
  return <>{String(value)}</>;
}

function Toolbar({
  meta,
  params,
  onChange,
  filtersActive,
}: {
  meta: Meta;
  params: URLSearchParams;
  onChange: (changes: Record<string, string>) => void;
  filtersActive: boolean;
}) {
  const urlQuery = params.get('q') ?? '';
  const [text, setText] = useState(urlQuery);

  // Orqaga/oldinga yoki "tozalash" — maydon URL bilan mos bo'lsin
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);
  if (lastUrlQuery !== urlQuery) {
    setLastUrlQuery(urlQuery);
    setText(urlQuery);
  }

  // Yozish to'xtagach qidiramiz (har harfda so'rov yubormaslik uchun)
  useEffect(() => {
    if (text.trim() === urlQuery) return;
    const timer = window.setTimeout(() => onChange({ q: text.trim() }), 350);
    return () => window.clearTimeout(timer);
  }, [text, urlQuery, onChange]);

  const filterIds = useMemo(() => meta.filters.map((f) => `flt-${meta.slug}-${f.key}`), [meta]);

  return (
    <form className="adm-tools" role="search" onSubmit={(e) => (e.preventDefault(), onChange({ q: text.trim() }))}>
      {meta.searchable && (
        <div className="adm-search">
          <i className="fas fa-magnifying-glass" aria-hidden="true"></i>
          <label htmlFor="adm-q" className="sr-only">
            Qidiruv
          </label>
          <input id="adm-q" type="search" className="input" placeholder="Qidirish…" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
        </div>
      )}
      {meta.filters.map((f, i) => (
        <Fragment key={f.key}>
          <label htmlFor={filterIds[i]} className="sr-only">
            {f.label}
          </label>
          <select id={filterIds[i]} className="input" value={params.get(f.key) ?? ''} onChange={(e) => onChange({ [f.key]: e.target.value })}>
            <option value="">{f.label}: hammasi</option>
            {f.options.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Fragment>
      ))}
      {filtersActive && (
        <A href={`/admin/${meta.slug}/`} className="btn btn-ghost btn-sm">
          <i className="fas fa-xmark" aria-hidden="true"></i> TOZALASH
        </A>
      )}
    </form>
  );
}

function TableSkeleton() {
  return (
    <div aria-busy="true" aria-label="Yuklanmoqda" style={{ padding: '8px 14px' }}>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} style={{ display: 'flex', gap: 18, padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
          <div className="adm-skel" style={{ width: 32 }}></div>
          <div className="adm-skel" style={{ flex: 2 }}></div>
          <div className="adm-skel" style={{ flex: 1 }}></div>
          <div className="adm-skel" style={{ flex: 1 }}></div>
        </div>
      ))}
    </div>
  );
}
