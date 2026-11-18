import type { LibraryItem, Template } from './types';

export const templates: Template[] = [
  {
    id: 'TPL-BD-0142', name: 'Filmy Gold', occasion: 'birthday', style: 'bollywood', price: 49, originalPrice: 99,
    currency: 'INR', durationSec: 15, photosMin: 3, photosMax: 5, madeCount: 2140, trending: true, previewUrl: null,
    description: 'Golden filmy frames, slow-motion zooms and a dhol-pop birthday song with their name in the chorus.',
    tags: ['Bollywood', 'Birthday', 'Trending'], colors: ['#FFC857', '#B8410E'],
  },
  {
    id: 'TPL-BD-0151', name: 'Dil Se Hearts', occasion: 'birthday', style: 'bollywood', price: 49, originalPrice: null,
    currency: 'INR', durationSec: 15, photosMin: 3, photosMax: 5, madeCount: 1410, trending: false, previewUrl: null,
    description: 'Soft pink hearts, shimmer and a sweet melody that sings their name twice.',
    tags: ['Bollywood', 'Birthday'], colors: ['#FF7AA8', '#8E1650'],
  },
  {
    id: 'TPL-BD-0163', name: 'Sitara Night', occasion: 'birthday', style: 'bollywood', price: 39, originalPrice: 79,
    currency: 'INR', durationSec: 15, photosMin: 3, photosMax: 5, madeCount: 640, trending: false, previewUrl: null,
    description: 'Starry night sky, sparkles and a dreamy filmy chorus.',
    tags: ['Bollywood', 'Birthday'], colors: ['#B39DFF', '#2E1A6B'],
  },
  {
    id: 'TPL-BD-0207', name: 'Neon Pop', occasion: 'birthday', style: 'genz', price: 49, originalPrice: null,
    currency: 'INR', durationSec: 15, photosMin: 3, photosMax: 5, madeCount: 1630, trending: true, previewUrl: null,
    description: 'Fast cuts, neon stickers and bold captions on a hyperpop beat.',
    tags: ['Gen Z', 'Birthday', 'Trending'], colors: ['#3DF5C8', '#5B2BD8'],
  },
  {
    id: 'TPL-BD-0311', name: 'VHS ’90s', occasion: 'birthday', style: 'retro', price: 39, originalPrice: null,
    currency: 'INR', durationSec: 15, photosMin: 3, photosMax: 5, madeCount: 980, trending: true, previewUrl: null,
    description: 'Tape grain, scan lines and a 90s synth birthday jingle.',
    tags: ['Retro', 'Birthday', 'Trending'], colors: ['#FF9E6B', '#7A1E5C'],
  },
  {
    id: 'TPL-AN-0102', name: 'Shaadi Lights', occasion: 'anniversary', style: 'bollywood', price: 99, originalPrice: 149,
    currency: 'INR', durationSec: 15, photosMin: 3, photosMax: 5, madeCount: 860, trending: true, previewUrl: null,
    description: 'Fairy lights, marigold petals and a romantic duet with both your names.',
    tags: ['Bollywood', 'Anniversary'], colors: ['#FF9E3D', '#5B1E8C'],
  },
  {
    id: 'TPL-AN-0118', name: 'Golden Years', occasion: 'anniversary', style: 'retro', price: 49, originalPrice: null,
    currency: 'INR', durationSec: 15, photosMin: 3, photosMax: 5, madeCount: 420, trending: false, previewUrl: null,
    description: 'Polaroid frames and a warm vintage love song.',
    tags: ['Retro', 'Anniversary'], colors: ['#FF8A5C', '#E0306E'],
  },
  {
    id: 'TPL-AP-0104', name: 'Sorry Na', occasion: 'apology', style: 'genz', price: 29, originalPrice: 49,
    currency: 'INR', durationSec: 15, photosMin: 3, photosMax: 5, madeCount: 1210, trending: true, previewUrl: null,
    description: 'Cute stickers, puppy-eyes zooms and a funny sorry song.',
    tags: ['Gen Z', 'Apology'], colors: ['#6C8CFF', '#4B2BC8'],
  },
  {
    id: 'TPL-AP-0122', name: 'Maaf Karo', occasion: 'apology', style: 'bollywood', price: 49, originalPrice: null,
    currency: 'INR', durationSec: 15, photosMin: 3, photosMax: 5, madeCount: 530, trending: false, previewUrl: null,
    description: 'Rain, slow-mo and a dramatic filmy apology track.',
    tags: ['Bollywood', 'Apology'], colors: ['#7FB2FF', '#24306E'],
  },
];

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

export const libraryItems: LibraryItem[] = [
  { id: 'LIB-1', kind: 'video', title: 'For Priya', subtitle: 'Birthday · Filmy Gold', status: 'hd', progress: 1, colors: ['#FFC857', '#B8410E'], giftId: 'GFT-1001', createdAt: hoursAgo(5) },
  { id: 'LIB-2', kind: 'video', title: 'For Neha', subtitle: 'Anniversary · Dil Se', status: 'preview', progress: 1, colors: ['#FF8A5C', '#E0306E'], giftId: 'GFT-1002', createdAt: hoursAgo(20) },
  { id: 'LIB-3', kind: 'video', title: 'For Aman', subtitle: 'Apology · Neon Pop', status: 'making', progress: 0.68, colors: ['#3DF5C8', '#5B2BD8'], giftId: 'GFT-1003', createdAt: hoursAgo(1) },
  { id: 'LIB-4', kind: 'photo', title: 'Cover art · Priya', subtitle: 'Generated image', status: 'photo', progress: 1, colors: ['#B39DFF', '#2E1A6B'], giftId: null, createdAt: hoursAgo(5) },
  { id: 'LIB-5', kind: 'video', title: 'For Mom', subtitle: 'Birthday · Sitara Night', status: 'hd', progress: 1, colors: ['#B39DFF', '#2E1A6B'], giftId: 'GFT-0990', createdAt: hoursAgo(72) },
  { id: 'LIB-6', kind: 'draft', title: 'For Riya', subtitle: 'Birthday · VHS ’90s', status: 'draft', progress: 0, colors: ['#FF9E6B', '#7A1E5C'], giftId: null, createdAt: hoursAgo(30) },
];

export const recentDeviceAudio = [
  { id: 'a1', name: 'Our song.mp3', durationSec: 222, sizeMb: 5.1, colors: ['#FF8A5C', '#E0306E'] as const },
  { id: 'a2', name: 'Voice note – Rahul.m4a', durationSec: 48, sizeMb: 0.9, colors: ['#6C8CFF', '#4B2BC8'] as const },
  { id: 'a3', name: 'Holi mix 2025.mp3', durationSec: 250, sizeMb: 6.3, colors: ['#3DF5C8', '#1C8C6E'] as const },
  { id: 'a4', name: 'Recording 014.m4a', durationSec: 72, sizeMb: 1.4, colors: ['#B39DFF', '#2E1A6B'] as const },
];
