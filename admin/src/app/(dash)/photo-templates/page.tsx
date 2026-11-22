import { requireAdmin } from '@/lib/auth';
import { TemplateList } from '@/components/TemplateList';

export default async function PhotoTemplatesPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  await requireAdmin();
  return <TemplateList type="image" basePath="/photo-templates" cat={(await searchParams).cat} />;
}
