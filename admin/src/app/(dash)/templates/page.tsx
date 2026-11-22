import { requireAdmin } from '@/lib/auth';
import { TemplateList } from '@/components/TemplateList';

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  await requireAdmin();
  return <TemplateList type="song_video" basePath="/templates" cat={(await searchParams).cat} />;
}
