'use client';

import { PageHost } from '@/components/PageHost';
import { SiteLayout } from '@/components/SiteLayout';
import { A } from '@/components/ui';
import type { PagePayload } from '@/lib/types';
import { ScadaHMIView } from './ScadaHMIView';

export function ScadaPageHost({ initial }: { initial: PagePayload }) {
  return (
    <PageHost initial={initial}>
      {(page) => (
        <SiteLayout user={page.user} year={page.year} messages={page.messages} nav="labs">
          <div className="page">
            <header className="mb-6 rise">
              <nav className="breadcrumb mb-3" aria-label="Yo'l">
                <A href="/labs/">Laboratoriyalar</A> <span aria-hidden="true">/</span> <span className="cur">SCADA Sanoat Poligoni</span>
              </nav>
              <h1 className="page-title mb-2">
                SCADA & Kritik Infratuzilma: <span className="hl">Kiber-Fizik Poligon</span>
              </h1>
              <p className="page-sub max-w-3xl">
                Sanoat avtomatlashtirish tizimlari (ICS / SCADA) xavfsizligi: Suv tozalash, 110kV elektr podstansiyasi va
                kimyoviy reaktor. Modbus TCP, DNP3, PLC relelari va kiber-fizik Stuxnet-uslubidagi hodisalar simulyatsiyasi.
              </p>
            </header>
            <ScadaHMIView challengeId={52} />
          </div>
        </SiteLayout>
      )}
    </PageHost>
  );
}
