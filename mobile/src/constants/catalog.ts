import type { IconName } from '@/components/Icon';
import type { Language, Mood, MusicStyle, Occasion, Relationship, Singer, TemplateStyle, Trait } from '@/api/types';

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

// ---- Personal song choices (ids match backend/app/schemas.py and services/song_prompt.py)
export const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'hinglish', label: 'Hinglish' },
  { id: 'hindi', label: 'Hindi' },
  { id: 'english', label: 'English' },
  { id: 'punjabi', label: 'Punjabi' },
  { id: 'tamil', label: 'Tamil' },
  { id: 'telugu', label: 'Telugu' },
];

export const MUSIC_STYLES: { id: MusicStyle; label: string }[] = [
  { id: 'bollywood_pop', label: 'Bollywood pop' },
  { id: 'punjabi_bhangra', label: 'Punjabi bhangra' },
  { id: 'acoustic', label: 'Acoustic' },
  { id: 'lofi', label: 'Lo-fi chill' },
  { id: 'edm_party', label: 'EDM party' },
  { id: 'sufi', label: 'Sufi / Qawwali' },
  { id: 'ballad', label: 'Slow ballad' },
];

export const RELATIONSHIPS: { id: Relationship; label: string }[] = [
  { id: 'friend', label: 'Friend' },
  { id: 'partner', label: 'Partner' },
  { id: 'mom', label: 'Mom' },
  { id: 'dad', label: 'Dad' },
  { id: 'sibling', label: 'Brother / Sister' },
  { id: 'colleague', label: 'Colleague' },
  { id: 'relative', label: 'Relative' },
];

export const TRAITS: { id: Trait; label: string }[] = [
  { id: 'funny', label: 'Funny' },
  { id: 'caring', label: 'Caring' },
  { id: 'foodie', label: 'Foodie' },
  { id: 'always_late', label: 'Always late' },
  { id: 'dancer', label: 'Loves dancing' },
  { id: 'traveller', label: 'Traveller' },
  { id: 'gamer', label: 'Gamer' },
  { id: 'bookworm', label: 'Bookworm' },
  { id: 'sporty', label: 'Sporty' },
  { id: 'shy', label: 'Shy and sweet' },
];

export const MAX_TRAITS = 3;
export const MAX_IDEA = 150;
