import type { EnemyKind, EnemyStats } from '../types/game';

export type DebugStatKey = 'hp' | 'attackDamage' | 'speed' | 'range';

type Overrides = Partial<Record<EnemyKind, Partial<Record<DebugStatKey, number>>>>;

const STORAGE_KEY = 'castle-codex-debug-cheats';

let cache: Overrides | null = null;

function read(): Overrides {
  if (cache !== null) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as Overrides) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function write(next: Overrides): void {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / disabled storage
  }
}

export class DebugCheatSystem {
  static getAll(): Overrides {
    return read();
  }

  static getFor(kind: EnemyKind): Partial<Record<DebugStatKey, number>> {
    return read()[kind] ?? {};
  }

  static set(kind: EnemyKind, stat: DebugStatKey, value: number | null): void {
    const all = { ...read() };
    const forKind = { ...(all[kind] ?? {}) };
    if (value === null || Number.isNaN(value)) {
      delete forKind[stat];
    } else {
      forKind[stat] = value;
    }
    if (Object.keys(forKind).length === 0) {
      delete all[kind];
    } else {
      all[kind] = forKind;
    }
    write(all);
  }

  static resetAll(): void {
    write({});
  }

  static applyTo(stats: EnemyStats): EnemyStats {
    const overrides = read()[stats.kind];
    if (!overrides || Object.keys(overrides).length === 0) return stats;
    return { ...stats, ...overrides };
  }
}
