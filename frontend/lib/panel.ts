import { csrfToken } from './client-api';

/** Boshqaruv paneli API'si (/api/panel/...) javob turlari — ctf/panel/views.py bilan bir xil. */

export interface PanelUser {
  username: string;
  avatar: string;
  is_superuser: boolean;
}

export interface NavItem {
  slug: string;
  label: string;
  icon: string;
}

export interface MeResponse {
  user: PanelUser;
  resources: NavItem[];
}

export type ColumnKind = 'text' | 'mono' | 'number' | 'bool' | 'chip' | 'date';

export interface Meta {
  slug: string;
  label: string;
  singular: string;
  icon: string;
  hint: string;
  columns: { key: string; label: string; kind: ColumnKind }[];
  filters: { key: string; label: string; options: [string, string][] }[];
  actions: { key: string; label: string; danger: boolean; confirm: string }[];
  can_create: boolean;
  can_edit: boolean;
  searchable: boolean;
}

export type Cell = string | number | boolean | null;

export interface ListResponse {
  meta: Meta;
  rows: (Record<string, Cell> & { id: number })[];
  page: { number: number; num_pages: number; count: number };
}

export type FieldType =
  | 'text' | 'email' | 'password' | 'number' | 'textarea' | 'checkbox'
  | 'select' | 'multiselect' | 'datetime' | 'file' | 'image';

export interface FormField {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  help: string;
  value: string | boolean | string[] | { url: string; name: string } | null;
  errors: string[];
  choices?: [string, string][];
  rows?: number;
  mono?: boolean;
}

export interface DetailResponse {
  meta: Meta;
  id: number | null;
  title: string;
  links: { label: string; href: string }[];
  facts: { label: string; value: string }[];
  can_delete: boolean;
  form: {
    fields: FormField[];
    sections: { title: string; fields: string[] }[];
    non_field_errors: string[];
  };
}

export interface DashboardResponse {
  stats: { key: string; label: string; value: number; note: string }[];
  recent: { user: string; challenge: string; challenge_id: number; points: number; time: string }[];
  top: { id: number; username: string; points: number }[];
}

export interface ApiError {
  error: string;
  message: string;
}

export interface Reply<T> {
  status: number;
  data: T & Partial<ApiError> & { ok?: boolean; message?: string; id?: number };
}

export const NETWORK_ERROR = "Server bilan aloqa yo'q. Internetni tekshirib, qayta urinib ko'ring.";

async function call<T>(path: string, init: RequestInit): Promise<Reply<T>> {
  const response = await fetch(`/api/panel/${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
    headers: { accept: 'application/json', ...init.headers },
  });
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) throw new Error(`panel: ${response.status}`);
  return { status: response.status, data: await response.json() };
}

export function panelGet<T>(path: string) {
  return call<T>(path, { method: 'GET' });
}

export async function panelPost<T>(path: string, body: FormData) {
  return call<T>(path, { method: 'POST', body, headers: { 'X-CSRFToken': await csrfToken() } });
}
