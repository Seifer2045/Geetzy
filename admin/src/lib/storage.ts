export const TEMPLATE_BUCKET = 'template-media';

export const templateMediaUrl = (path: string | null | undefined) =>
  path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${TEMPLATE_BUCKET}/${path}` : null;
