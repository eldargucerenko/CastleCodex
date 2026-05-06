# Debug Cheat System

Date: 2026-05-03

## Goal

In-game debug panel for testing waves and balance: spawn enemies on demand and override per-kind stats (HP, damage, speed, range).

## Decisions

- **Access:** always-available DOM button (top-right, fixed position) plus hotkey `` ` `` (backtick). Visible in production (per user choice) — this is single-player and local, abuse is not a concern.
- **Spawn timing:** instant spawn during a wave. Click an enemy-kind button → enemy spawns at the right edge using `WaveManager.spawnAt`. No queue, no pre-wave mode.
- **Stat overrides:** per-kind, applied to *future* spawns of that kind (existing live enemies keep their original stats). Stats covered: `hp`, `attackDamage`, `speed`, `range` (range only shown for kinds that define it: `archer`, `wizard`, `wizard_easy`, `wizard_medium`, `wizard_hard`).
- **Persistence:** overrides stored in `localStorage` under key `castle-codex-debug-cheats`, separate from the main save. "Reset all" button clears them.
- **Panel UI:** plain DOM overlay (HTML inputs / buttons) styled over the canvas. Phaser doesn't get good text inputs out of the box, and a debug panel doesn't need to share the game's visual style.

## Components

### `src/systems/DebugCheatSystem.ts` (new)

Static-style module owning override state.

```ts
type StatKey = 'hp' | 'attackDamage' | 'speed' | 'range';
type Overrides = Partial<Record<EnemyKind, Partial<Record<StatKey, number>>>>;

class DebugCheatSystem {
  static getAll(): Overrides
  static getFor(kind: EnemyKind): Partial<Record<StatKey, number>>
  static set(kind: EnemyKind, stat: StatKey, value: number | null): void  // null clears
  static resetAll(): void
  static applyTo(stats: EnemyStats): EnemyStats  // returns merged copy; identity if no overrides
}
```

Uses `localStorage` directly (not via `SaveSystem`) under key `castle-codex-debug-cheats`. Bad/missing JSON → empty overrides, swallowed. No migrations needed.

### `src/systems/DebugPanelUI.ts` (new)

DOM-based panel. Constructed once with a `spawnHandler: (kind: EnemyKind) => void` and `getSpawnEnabled: () => boolean` (so spawn buttons disable when not in `GameScene`). Owns:

- A fixed-position `<button>` "DEBUG" in top-right.
- A fixed-position `<div>` panel with two sections:
  - **Spawn**: one button per `EnemyKind`. Disabled if `getSpawnEnabled()` is false.
  - **Overrides**: one row per kind with `<input type="number">` fields for hp, damage, speed, range. Empty input = no override. "Reset all" button at bottom.
- Hotkey listener on `document` for `` ` `` (backtick) toggles panel.
- All elements appended to `document.body` with high `z-index`.
- Public `destroy()` for symmetry, though typically lives the whole session.

### `src/entities/Enemy.ts` (modified)

Constructor changes:
```ts
this.stats = DebugCheatSystem.applyTo(ENEMY_STATS[kind]);
```
Single-line change. `applyTo` returns the original object identity when no overrides apply, so cost is zero in normal play.

### `src/scenes/GameScene.ts` (modified)

In `create()`, wire up the panel:
```ts
DebugPanelUI.ensureMounted({
  spawnHandler: (kind) => this.spawnDebugEnemy(kind),
  getSpawnEnabled: () => this.scene.isActive() && !this.finishing
});
```
Plus a `spawnDebugEnemy(kind)` helper that picks a lane y (matching `WaveManager`'s lane logic) and calls `this.wave.spawnAt(kind, x, y, groundY)`.

`DebugPanelUI` is mounted once per session (idempotent `ensureMounted`) and persists across scene transitions; it just rebinds the spawn handler each time `GameScene.create` runs.

## Data Flow

```
User clicks "Spawn archer" in DOM panel
  → DebugPanelUI.spawnHandler(kind)
  → GameScene.spawnDebugEnemy(kind)
  → WaveManager.spawnAt(kind, x, y, groundY)
  → new ArcherEnemy(...)
  → Enemy constructor calls DebugCheatSystem.applyTo(ENEMY_STATS.archer)
  → enemy spawned with overrides applied

User edits HP override for archer
  → input.onchange → DebugCheatSystem.set('archer', 'hp', 100)
  → localStorage updated
  → next archer spawn picks up the new HP
```

## What we are NOT doing

- No retroactive patching of live enemies (Q2 = A).
- No pre-wave queue (Q1 = A: instant spawn only).
- No production gating (Q3 = C).
- No save migrations — overrides live under their own localStorage key.
- No Phaser-rendered panel — DOM is simpler for inputs.
- No dropping the existing `pause()`/`resume()` in `WaveManager` — that's another agent's work and is unrelated.

## Risks

- **Other agents have uncommitted changes** in `Enemy.ts`, `WaveManager.ts`, `SaveSystem.ts`, `types/game.ts`. The modifications I make to `Enemy.ts` are minimal (one line in the constructor) and unlikely to conflict, but agents working in parallel may produce a messy diff.
- **DOM panel z-index** must clear the Phaser canvas. `position: fixed; z-index: 9999` handles this.
- **Hotkey collision** — backtick is not used by Phaser for game input, but if the user later adds a chat/console feature it could collide. Trivial to change.
