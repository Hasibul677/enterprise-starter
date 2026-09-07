/** Converts a duration string like "30m" / "45m" / "7d" into whole seconds. */
export function durationToSeconds(input: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(input.trim());
  if (!match) throw new Error(`Invalid duration string: ${input}`);
  const [, amountStr, unit] = match;
  const amount = Number(amountStr);
  const multiplier: Record<string, number> = { ms: 0.001, s: 1, m: 60, h: 3600, d: 86400 };
  return Math.round(amount * multiplier[unit]);
}
