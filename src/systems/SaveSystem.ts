import { cloudSave } from '../sdk/gamepush';
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
  logTrapCount: 0,
  archerHp: [],
  mageHp: undefined,
  tutorialCompleted: false
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
    void cloudSave(data as unknown as Record<string, unknown>);
  }

  static reset(): SaveData {
    window.localStorage.removeItem(SAVE_KEY);
    void cloudSave({ ...DEFAULT_SAVE } as unknown as Record<string, unknown>);
    return { ...DEFAULT_SAVE };
  }

  // Hydrate localStorage from a cloud-loaded payload at boot. We trust the
  // cloud copy if it has progressed further than local (more completed
  // levels), otherwise we keep local. This avoids overwriting fresh local
  // progress with a stale cloud snapshot that hasn't synced yet.
  static applyCloudData(cloud: Record<string, unknown>): void {
    const local = SaveSystem.load();
    const cloudCompleted = typeof cloud.completedLevels === 'number' ? cloud.completedLevels : -1;
    if (cloudCompleted < local.completedLevels) return;
    const merged: SaveData = { ...DEFAULT_SAVE, ...local, ...cloud } as SaveData;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(merged));
  }
}
