import type { SaveData } from '../types/game';

const SAVE_KEY = 'castle-codex-save-v1';

export const DEFAULT_SAVE: SaveData = {
  currentLevel: 1,
  completedLevels: 0,
  gold: 0,
  currentHp: 120,
  maxHp: 120,
  baseDamageReduction: 0,
  wallLevel: 0,
  archerLevel: 0,
  trapLevel: 0,
  mageLevel: 0,
  logTrapCount: 0
};

export class SaveSystem {
  static load(): SaveData {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    try {
      return { ...DEFAULT_SAVE, ...JSON.parse(raw) } as SaveData;
    } catch {
      return { ...DEFAULT_SAVE };
    }
  }

  static save(data: SaveData): void {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  static reset(): SaveData {
    window.localStorage.removeItem(SAVE_KEY);
    return { ...DEFAULT_SAVE };
  }
}
