import { ResourceForm } from '@/components/panel/ResourceForm';

export default async function ResourceNewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ResourceForm key={`${slug}/new`} slug={slug} />;
}
