export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const formatMs = (value: number) => `${Math.round(value)} ms`;
export const formatPct = (value: number) => `${value.toFixed(1)}%`;
export const formatCompact = (value: number) => Intl.NumberFormat('en', { notation: 'compact' }).format(value);
