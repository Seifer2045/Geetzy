import type { Mood, Occasion } from '@/api/types';

type LyricsInput = { name: string; funFact: string; occasion: Occasion; mood: Mood; version: number };

const clean = (s: string) => s.trim().replace(/\s+/g, ' ');

const lowerFirst = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

const LINES: Record<Occasion, string[][]> = {
  birthday: [
    ['{name}, {name}, the {fact} star,', 'Always shining, the best by far!', 'Candles are lit and the party’s begun,', 'Happy birthday {name}, you’re number one!'],
    ['Hey {name}, it’s your day to glow,', 'The one who {fact}, everybody knows!', 'Cake on the table, music so loud,', 'Happy birthday {name}, make us proud!'],
    ['Dhol is beating, the stars align,', '{name}, the {fact} one, you’re so fine!', 'Another year of laughter and fun,', 'Happy birthday {name}, the chosen one!'],
  ],
  anniversary: [
    ['{name}, my heart still skips a beat,', 'Every day with you is oh so sweet,', 'From the one who {fact} to forever and more,', 'Happy anniversary, you’re the one I adore!'],
    ['Years together, hand in hand,', '{name}, you’re my favourite band,', 'Through every storm and every sun,', 'Happy anniversary, my only one!'],
    ['Filmy love like the movies show,', '{name}, you make my whole world glow,', 'One more year, a million to go,', 'Happy anniversary, I love you so!'],
  ],
  apology: [
    ['{name}, I know I messed it up,', 'Spilled the chai right out the cup,', 'Give me one more chance to say,', 'Sorry {name}, let’s be okay!'],
    ['Sorry sorry, {name}, please don’t frown,', 'Without your smile I’m feeling down,', 'I’ll do better, that’s my vow,', 'Can we be friends again right now?'],
    ['Thoda sa gussa, thoda sa pyaar,', '{name}, you’re my favourite star,', 'I said some things I didn’t mean,', 'Sorry {name}, you’re my queen!'],
  ],
  festival: [
    ['Lights are glowing, sweets are here,', '{name}, the best part of the year,', 'Rangoli colours, joy all around,', 'Happy festival, let love abound!'],
    ['Diyas shining bright tonight,', '{name}, you make everything right,', 'Family, laughter, food and fun,', 'Happy festival to everyone!'],
    ['Drums are rolling, hearts are light,', '{name}, the reason it feels right,', 'Celebrate with all your soul,', 'Happy festival, you make us whole!'],
  ],
};

export const generateLyrics = ({ name, funFact, occasion, version }: LyricsInput): string => {
  const safeName = clean(name) || 'Priya';
  const fact = lowerFirst(clean(funFact)) || 'chai-loving';
  const set = LINES[occasion];
  const lines = set[(version - 1) % set.length] ?? set[0] ?? [];
  return lines.map((l) => l.replaceAll('{name}', safeName).replaceAll('{fact}', fact)).join('\n');
};

export const songTitle = (name: string, occasion: Occasion) => {
  const n = clean(name) || 'Priya';
  const label: Record<Occasion, string> = {
    birthday: 'Birthday Song',
    anniversary: 'Love Song',
    apology: 'Sorry Song',
    festival: 'Festival Song',
  };
  return `${n}’s ${label[occasion]}`;
};
