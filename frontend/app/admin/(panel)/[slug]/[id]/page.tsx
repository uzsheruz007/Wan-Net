import { notFound } from 'next/navigation';

import { ResourceForm } from '@/components/panel/ResourceForm';

export default async function ResourceEditPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <ResourceForm key={`${slug}/${id}`} slug={slug} id={id} />;
}
