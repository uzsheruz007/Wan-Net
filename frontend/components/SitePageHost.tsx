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
  nav: NavKey;
  ambient?: boolean;
}

/** Django `template` nomi → sahifa komponenti (ctf/api/pages.py dagi SERIALIZERS bilan bir xil ro'yxat).
 *  Sarlavha va tavsif serverda: lib/seo.ts → [[...path]]/page.tsx generateMetadata. */
const PAGES: Record<string, Entry> = {
  'ctf/ctf_home.html': { component: Home, nav: null, ambient: true },
  'ctf/challenges.html': { component: Challenges, nav: 'challenges' },
  'ctf/challenge_detail.html': { component: ChallengeDetail, nav: 'challenges' },
  'ctf/labs.html': { component: Labs, nav: 'labs' },
  'ctf/leaderboard_v2.html': { component: Leaderboard, nav: 'leaderboard' },
  'ctf/profile.html': { component: Profile, nav: 'profile' },
  'ctf/team_dashboard.html': { component: Team, nav: 'team' },
  'ctf/tournaments.html': { component: Tournaments, nav: 'tournaments' },
  'ctf/tournament_detail.html': { component: TournamentDetail, nav: 'tournaments' },
  'ctf/tournament_leaderboard.html': { component: TournamentLeaderboard, nav: 'tournaments' },
  'ctf/telegram_login.html': { component: Login, nav: null, ambient: true },
};

export function SitePageHost({ initial }: { initial: PagePayload }) {
  return (
    <PageHost initial={initial}>
      {(page) => {
        const entry = PAGES[page.template];
        if (!entry) throw new Error(`Noma'lum sahifa: ${page.template}`);
        const Component = entry.component;
        return (
          <SiteLayout user={page.user} year={page.year} messages={page.messages} nav={entry.nav} ambient={entry.ambient}>
            <Component d={page.data} user={page.user} />
          </SiteLayout>
        );
      }}
    </PageHost>
  );
}
