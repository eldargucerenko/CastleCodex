// Cursor debuff: a global multiplier applied to Enemy.followPointer's
// snap factor. Anything below 1 makes the dragged enemy lag behind the
// pointer, mimicking a "slow / heavy / drunk" cursor without touching
// the OS cursor itself. Set/refresh from any caster (e.g. CursorMage).

let multiplier = 1;
let expiresAt = 0;

export const CursorDebuff = {
  // Apply (or refresh) the debuff. Caller passes a normalized factor
  // (0.2 = very laggy, 0.5 = noticeably slower) and a duration in ms.
  apply(factor: number, durationMs: number, now: number): void {
    multiplier = factor;
    expiresAt = now + durationMs;
  },
  // Read the current multiplier; auto-clears when expired so callers
  // don't need to remember to tick it.
  factor(now: number): number {
    if (now >= expiresAt) {
      multiplier = 1;
      expiresAt = 0;
    }
    return multiplier;
  },
  isActive(now: number): boolean {
    return now < expiresAt;
  },
  expiryTime(): number {
    return expiresAt;
  }
};
