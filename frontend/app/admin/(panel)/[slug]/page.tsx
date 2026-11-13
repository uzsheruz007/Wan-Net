import { Suspense } from 'react';

import { ResourceList } from '@/components/panel/ResourceList';

export default async function ResourceListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <Suspense>
      <ResourceList key={slug} slug={slug} />
    </Suspense>
  );
}
