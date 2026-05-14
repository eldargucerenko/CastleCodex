// Cursor debuff: a global timer that, while active, blocks the player
// from grabbing enemies. DragThrowSystem checks isActive() on pointerdown
// and refuses to grab; GameScene swaps the OS cursor and shows an
// overlay while it's running. Set/refresh from any caster (CursorMage).

let expiresAt = 0;
let startedAt = 0;
let totalDurationMs = 0;

export const CursorDebuff = {
  // Apply (or refresh) the grab-block. durationMs typically 3000.
  apply(durationMs: number, now: number): void {
    const newExpiry = now + durationMs;
    if (newExpiry > expiresAt) {
      expiresAt = newExpiry;
      startedAt = now;
      totalDurationMs = durationMs;
    }
  },
  isActive(now: number): boolean {
    return now < expiresAt;
  },
  // Milliseconds until the block clears (0 if already clear).
  remainingMs(now: number): number {
    return Math.max(0, expiresAt - now);
  },
  // 0..1 fraction of debuff still remaining (1 = just applied, 0 = expired).
  progress(now: number): number {
    if (totalDurationMs <= 0) return 0;
    return Math.max(0, Math.min(1, (expiresAt - now) / totalDurationMs));
  },
  expiryTime(): number {
    return expiresAt;
  }
};
