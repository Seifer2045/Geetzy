// Same rules as backend/app/placeholders.py — used for the live "example" under the prompt boxes.
export const PLACEHOLDERS = [
  { key: 'name', hint: 'the person the gift is for' },
  { key: 'sender', hint: 'the person sending it' },
  { key: 'fun_fact', hint: 'the fun fact the user typed' },
  { key: 'occasion', hint: 'Birthday, Anniversary…' },
] as const;

export const SAMPLE = { name: 'Priya', sender: 'Rahul', fun_fact: 'loves chai and old Hindi songs', occasion: 'Birthday' };

export function fillExample(text: string, values: Record<string, string> = SAMPLE): string {
  return text.replace(/\{(name|sender|fun_fact|occasion)\}/g, (_, k: string) => values[k] ?? '');
}
