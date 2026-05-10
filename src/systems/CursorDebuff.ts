// Cursor debuff: a global timer that, while active, blocks the player
// from grabbing enemies. DragThrowSystem checks isActive() on pointerdown
// and refuses to grab; GameScene swaps the OS cursor and shows an
// overlay while it's running. Set/refresh from any caster (CursorMage).

let expiresAt = 0;

export const CursorDebuff = {
  // Apply (or refresh) the grab-block. durationMs typically 3000.
  apply(durationMs: number, now: number): void {
    expiresAt = Math.max(expiresAt, now + durationMs);
  },
  isActive(now: number): boolean {
    return now < expiresAt;
  },
  // Milliseconds until the block clears (0 if already clear).
  remainingMs(now: number): number {
    return Math.max(0, expiresAt - now);
  },
  expiryTime(): number {
    return expiresAt;
  }
};
