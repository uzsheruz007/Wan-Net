export interface PageUser {
  authenticated: boolean;
  username: string;
  avatar: string;
  is_staff: boolean;
}

export interface PageMessage {
  tags: string;
  text: string;
}

/** Django `ctf/api/pages.py` sxemasi; shu yerda takrorlanmaydi, chegara testlari ctf/tests.py da. */
export type Data = any;

export interface PagePayload {
  template: string;
  data: Data;
  user: PageUser;
  year: number;
  messages: PageMessage[];
}

export interface Paging {
  number: number;
  num_pages: number;
  has_previous: boolean;
  has_next: boolean;
}

export interface ChallengeCard {
  id: number;
  title: string;
  category: string;
  points: number;
  is_lab: boolean;
  difficulty: '' | 'easy' | 'medium' | 'hard';
  is_solved: boolean;
  has_failed_attempt: boolean;
}
