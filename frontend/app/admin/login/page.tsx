import { Suspense } from 'react';

import { PanelLogin } from '@/components/panel/PanelLogin';

export default function PanelLoginPage() {
  return (
    <Suspense>
      <PanelLogin />
    </Suspense>
  );
}
