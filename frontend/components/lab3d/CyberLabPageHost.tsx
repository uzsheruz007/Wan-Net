'use client';

import { CyberLabView } from '@/components/lab3d/CyberLabView';
import { PageHost } from '@/components/PageHost';
import { SiteLayout } from '@/components/SiteLayout';
import { A } from '@/components/ui';
import type { PagePayload } from '@/lib/types';

export function CyberLabPageHost({ initial }: { initial: PagePayload }) {
  return (
    <PageHost initial={initial}>
      {(page) => (
        <SiteLayout user={page.user} year={page.year} messages={page.messages} nav="labs">
          <div className="page">
            <header className="mb-8 rise">
              <nav className="breadcrumb mb-4" aria-label="Yo'l">
                <A href="/labs/">Laboratoriyalar</A> <span aria-hidden="true">/</span> <span className="cur">3D kiber-poligon</span>
              </nav>
              <h1 className="page-title mb-3">
                3D <span className="hl">kiber-poligon</span>
              </h1>
              <p className="page-sub max-w-3xl">
                Kichik korporativ tarmoq: router, WAF, veb-server va ma&apos;lumotlar bazasi. Hujumni qadamma-qadam bajaring va
                paketlar tarmoq bo&apos;ylab qanday yurishini kuzating.
              </p>
            </header>
            <CyberLabView challengeId={51} />
          </div>
        </SiteLayout>
      )}
    </PageHost>
  );
}
