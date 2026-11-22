import type { IconName } from '@/components/Icon';
import type { Mood, Occasion, Singer, TemplateStyle } from '@/api/types';

export const OCCASIONS: { id: Occasion; label: string; icon: IconName; colors: readonly [string, string]; soon?: boolean }[] = [
  { id: 'birthday', label: 'Birthday', icon: 'cake', colors: ['#FF4D8D', '#C2185B'] },
  { id: 'anniversary', label: 'Anniversary', icon: 'heart', colors: ['#FF8A5C', '#E0306E'] },
  { id: 'apology', label: 'Apology', icon: 'chatHeart', colors: ['#6C8CFF', '#4B2BC8'] },
  { id: 'festival', label: 'Festivals', icon: 'diya', colors: ['#FFC857', '#E07A00'], soon: true },
];

const CATEGORY_ICONS: Record<string, IconName> = { birthday: 'cake', anniversary: 'heart', apology: 'chatHeart', festival: 'diya' };
/** Icon for a category slug; new admin-made categories use the sparkle (or their emoji where shown). */
export const categoryIcon = (slug: string): IconName => CATEGORY_ICONS[slug] ?? 'sparkle';

export const occasionLabel = (o: Occasion) => OCCASIONS.find((x) => x.id === o)?.label ?? o;

export const STYLES: { id: TemplateStyle; label: string; icon: IconName; colors: readonly [string, string]; count: number }[] = [
  { id: 'bollywood', label: 'Bollywood', icon: 'star', colors: ['#FFC857', '#E0306E'], count: 48 },
  { id: 'retro', label: 'Retro', icon: 'cassette', colors: ['#FF9E6B', '#7A1E5C'], count: 31 },
  { id: 'genz', label: 'Gen Z', icon: 'bolt', colors: ['#3DF5C8', '#5B2BD8'], count: 40 },
];

export const MOODS: { id: Mood; label: string; icon: IconName }[] = [
  { id: 'happy', label: 'Happy', icon: 'smile' },
  { id: 'filmy', label: 'Filmy', icon: 'star' },
  { id: 'romantic', label: 'Romantic', icon: 'heart' },
  { id: 'party', label: 'Party', icon: 'bolt' },
];

export const SINGERS: { id: Singer; label: string }[] = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
  { id: 'duet', label: 'Duet' },
];
