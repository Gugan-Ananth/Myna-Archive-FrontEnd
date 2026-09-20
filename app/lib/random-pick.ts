/** Inclusive dice range shown in the header picker. */
export const DICE_MIN = 1;
export const DICE_MAX = 10;

/**
 * Uniform integer in `[0, maxExclusive)`.
 * Uses rejection sampling so modulo does not bias low values.
 */
export function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  const cap = 0x1_0000_0000;
  const limit = cap - (cap % maxExclusive);
  const buf = new Uint32Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(buf);
    value = buf[0] ?? 0;
  } while (value >= limit);
  return value % maxExclusive;
}

/** Clamp a typed dice value to 1–10. */
export function clampDiceCount(value: number): number {
  if (!Number.isFinite(value)) return DICE_MIN;
  return Math.min(DICE_MAX, Math.max(DICE_MIN, Math.trunc(value)));
}

/**
 * Partial Fisher–Yates: `count` distinct indices from `0..length-1`,
 * in random order (not sorted).
 */
export function pickUniqueRandomIndices(
  length: number,
  count: number,
): number[] {
  if (length <= 0 || count <= 0) return [];
  const take = Math.min(count, length);
  const indices = Array.from({ length }, (_, index) => index);
  for (let i = 0; i < take; i += 1) {
    const swapWith = i + randomInt(length - i);
    const current = indices[i]!;
    indices[i] = indices[swapWith]!;
    indices[swapWith] = current;
  }
  return indices.slice(0, take);
}

/** Random subset of `items`, up to `count`, in random order. */
export function pickRandomItems<T>(items: readonly T[], count: number): T[] {
  const indices = pickUniqueRandomIndices(items.length, count);
  return indices.map((index) => items[index]!);
}
