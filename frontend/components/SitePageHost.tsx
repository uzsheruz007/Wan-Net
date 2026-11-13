'use client';

import type { ComponentType } from 'react';

import { PageHost } from '@/components/PageHost';
import type { Data, PagePayload, PageUser } from '@/lib/types';

import { ChallengeDetail } from './pages/ChallengeDetail';
import { Challenges } from './pages/Challenges';
import { Home } from './pages/Home';
import { Labs } from './pages/Labs';
import { Leaderboard } from './pages/Leaderboard';
import { Login } from './pages/Login';
import { Profile } from './pages/Profile';
import { Team } from './pages/Team';
import { TournamentDetail, TournamentLeaderboard, Tournaments } from './pages/Tournaments';
import { type NavKey, SiteLayout } from './SiteLayout';

interface Entry {
  component: ComponentType<{ d: Data; user: PageUser }>;
  title: (d: Data) => string;
  nav: NavKey;
}

const suffix = (title: string) => `${title} // Wan-Net`;

/** Django `template` nomi → sahifa komponenti (ctf/api/pages.py dagi SERIALIZERS bilan bir xil ro'yxat) */
const PAGES: Record<string, Entry> = {
  'ctf/ctf_home.html': { component: Home, title: () => 'Wan-Net // Kiberxavfsizlik Platformasi', nav: null },
  'ctf/challenges.html': { component: Challenges, title: () => suffix('Mashqlar'), nav: 'challenges' },
  'ctf/challenge_detail.html': { component: ChallengeDetail, title: (d) => suffix(d.challenge.title), nav: 'challenges' },
  'ctf/labs.html': { component: Labs, title: () => suffix('Laboratoriyalar'), nav: 'labs' },
  'ctf/leaderboard_v2.html': { component: Leaderboard, title: () => suffix('Reyting'), nav: 'leaderboard' },
  'ctf/profile.html': { component: Profile, title: (d) => `Profil // ${d.username}`, nav: 'profile' },
  'ctf/team_dashboard.html': { component: Team, title: () => suffix('Jamoa'), nav: 'team' },
  'ctf/tournaments.html': { component: Tournaments, title: () => suffix('Turnirlar'), nav: 'tournaments' },
  'ctf/tournament_detail.html': { component: TournamentDetail, title: (d) => `${d.tournament.title} // Turnir`, nav: 'tournaments' },
  'ctf/tournament_leaderboard.html': {
    component: TournamentLeaderboard,
    title: (d) => `Natijalar // ${d.tournament.title}`,
    nav: 'tournaments',
  },
  'ctf/telegram_login.html': { component: Login, title: () => suffix('Tizimga kirish'), nav: null },
};

export function SitePageHost({ initial }: { initial: PagePayload }) {
  return (
    <PageHost initial={initial}>
      {(page) => {
        const entry = PAGES[page.template];
        if (!entry) throw new Error(`Noma'lum sahifa: ${page.template}`);
        const Component = entry.component;
        return (
          <SiteLayout user={page.user} year={page.year} messages={page.messages} nav={entry.nav}>
            <title>{entry.title(page.data)}</title>
            <Component d={page.data} user={page.user} />
          </SiteLayout>
        );
      }}
    </PageHost>
  );
}
