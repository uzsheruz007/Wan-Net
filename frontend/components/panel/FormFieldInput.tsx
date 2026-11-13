'use client';

import { useState } from 'react';

import type { FormField } from '@/lib/panel';

/** Django forma maydoni (views.form_json sxemasi). Qiymat formaning o'zida — yuborishda FormData olinadi. */
export function FormFieldInput({ field }: { field: FormField }) {
  const id = `f-${field.name}`;
  const helpId = field.help ? `${id}-help` : undefined;
  const errId = field.errors.length ? `${id}-err` : undefined;
  const describedBy = [errId, helpId].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    name: field.name,
    'aria-invalid': field.errors.length ? true : undefined,
    'aria-describedby': describedBy,
  } as const;

  if (field.type === 'checkbox') {
    return (
      <div className={`adm-field ${field.errors.length ? 'invalid' : ''}`}>
        <label className="adm-toggle" htmlFor={id}>
          <input type="checkbox" {...common} defaultChecked={field.value === true} />
          {field.label}
        </label>
        <FieldNotes field={field} helpId={helpId} errId={errId} />
      </div>
    );
  }

  return (
    <div className={`adm-field ${field.errors.length ? 'invalid' : ''}`}>
      {field.type === 'multiselect' ? (
        <span className="label" id={`${id}-label`}>
          {field.label}
          {field.required && <Req />}
        </span>
      ) : (
        <label className="label" htmlFor={id}>
          {field.label}
          {field.required && <Req />}
        </label>
      )}
      <Control field={field} common={common} />
      <FieldNotes field={field} helpId={helpId} errId={errId} />
    </div>
  );
}

function Req() {
  return (
    <span className="req" aria-hidden="true">
      *
    </span>
  );
}

function FieldNotes({ field, helpId, errId }: { field: FormField; helpId?: string; errId?: string }) {
  return (
    <>
      {errId && (
        <div className="err" id={errId}>
          <i className="fas fa-circle-exclamation" aria-hidden="true"></i>
          <span>{field.errors.join(' ')}</span>
        </div>
      )}
      {helpId && (
        <p className="help" id={helpId}>
          {field.help}
        </p>
      )}
    </>
  );
}

type Common = {
  id: string;
  name: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
};

function text(value: FormField['value']) {
  return typeof value === 'string' ? value : '';
}

function Control({ field, common }: { field: FormField; common: Common }) {
  const required = field.required;
  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          {...common}
          className={`input ${field.mono ? 'mono' : ''}`}
          rows={field.rows ?? 5}
          defaultValue={text(field.value)}
          required={required}
          spellCheck={field.mono ? false : undefined}
        />
      );
    case 'select':
      return (
        <select {...common} className="input" defaultValue={text(field.value)} required={required}>
          {(field.choices ?? []).map(([value, label]) => (
            <option key={value} value={value}>
              {value === '' ? label || '— tanlanmagan —' : label}
            </option>
          ))}
        </select>
      );
    case 'multiselect':
      return <MultiSelect field={field} common={common} />;
    case 'file':
    case 'image':
      return <FileInput field={field} common={common} />;
    case 'password':
      return <input {...common} type="password" className="input" autoComplete="new-password" />;
    case 'number':
      return <input {...common} type="number" className="input" defaultValue={text(field.value)} required={required} inputMode="numeric" />;
    case 'datetime':
      return <input {...common} type="datetime-local" className="input" defaultValue={text(field.value)} required={required} />;
    case 'email':
      return <input {...common} type="email" className="input" defaultValue={text(field.value)} required={required} autoComplete="off" />;
    default:
      return <input {...common} type="text" className="input" defaultValue={text(field.value)} required={required} autoComplete="off" />;
  }
}

/** Ko'p tanlov: belgilash ro'yxati + qidiruv. Yashirilgan bandlar ham formaga kiradi. */
function MultiSelect({ field, common }: { field: FormField; common: Common }) {
  const initial = Array.isArray(field.value) ? field.value : [];
  const [checked, setChecked] = useState(() => new Set(initial));
  const [filter, setFilter] = useState('');
  const choices = field.choices ?? [];
  const needle = filter.trim().toLowerCase();

  function toggle(value: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  return (
    <div className="adm-multi" role="group" aria-labelledby={`${common.id}-label`} aria-describedby={common['aria-describedby']}>
      {choices.length > 8 && (
        <input
          type="search"
          className="input"
          placeholder={`Qidirish… (${checked.size} ta tanlangan)`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label={`${field.label}: qidirish`}
        />
      )}
      <ul>
        {choices.map(([value, label]) => (
          <li key={value} hidden={Boolean(needle) && !label.toLowerCase().includes(needle)}>
            <label>
              <input
                type="checkbox"
                className="adm-check"
                name={common.name}
                value={value}
                checked={checked.has(value)}
                onChange={() => toggle(value)}
              />
              {label}
            </label>
          </li>
        ))}
        {choices.length === 0 && <li className="help" style={{ padding: '8px 12px' }}>Tanlash uchun hech narsa yo‘q.</li>}
      </ul>
    </div>
  );
}

/** Fayl/rasm: joriy fayl ko'rinadi; majburiy bo'lmasa o'chirish belgisi (Django ClearableFileInput: <nom>-clear). */
function FileInput({ field, common }: { field: FormField; common: Common }) {
  const current = field.value && typeof field.value === 'object' && !Array.isArray(field.value) ? field.value : null;
  return (
    <>
      {current && (
        <div className="adm-file-cur">
          {field.type === 'image' && <img src={current.url} alt="" />}
          <a href={current.url} target="_blank" rel="noopener noreferrer">
            {current.name}
          </a>
          {!field.required && (
            <label className="adm-toggle" style={{ minHeight: 32, fontSize: 12 }}>
              <input type="checkbox" name={`${field.name}-clear`} /> o‘chirish
            </label>
          )}
        </div>
      )}
      <input {...common} type="file" className="input-file" accept={field.type === 'image' ? 'image/*' : undefined} />
    </>
  );
}
