export type WhiskersMode = 'coach' | 'challenge' | 'quiz' | 'generation' | 'debugging';

export function isWhiskersMode(s: string): s is WhiskersMode {
  return (
    s === 'coach' ||
    s === 'challenge' ||
    s === 'quiz' ||
    s === 'generation' ||
    s === 'debugging'
  );
}
