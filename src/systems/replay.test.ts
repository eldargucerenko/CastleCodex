import { describe, expect, it } from 'vitest';
import { DEFAULT_SAVE } from './SaveSystem';
import { computeReplaySave } from './replay';
import type { SaveData } from '../types/game';

const baseline = (overrides: Partial<SaveData> = {}): SaveData => ({
  ...DEFAULT_SAVE,
  ...overrides
});

describe('computeReplaySave', () => {
  it('rolls back gold to the pre-level snapshot when the level was cleared', () => {
    const beforeLevel = baseline({ currentLevel: 5, gold: 100, currentHp: 165, maxHp: 165 });

    // What the save looks like after clearing level 5: per-kill gold added,
    // level-clear bonus added, currentLevel advanced, currentHp dropped.
    const afterClear = baseline({
      currentLevel: 6,
      completedLevels: 5,
      gold: 100 + 32 /* kills */ + 70 /* level-clear bonus */,
      currentHp: 90,
      maxHp: 165
    });

    const restored = computeReplaySave(beforeLevel, afterClear);

    expect(restored.gold).toBe(100);
    expect(restored.currentLevel).toBe(5);
    expect(restored.currentHp).toBe(165);
  });

  it('also rolls back ad-bonus gold so replay cannot be used to farm rewarded videos', () => {
    const beforeLevel = baseline({ currentLevel: 3, gold: 50 });

    const afterClearAndAd = baseline({
      currentLevel: 4,
      completedLevels: 3,
      gold: 50 + 50 /* level-clear bonus */ + 50 /* +100% ad bonus */
    });

    const restored = computeReplaySave(beforeLevel, afterClearAndAd);

    expect(restored.gold).toBe(50);
  });

  it('preserves tutorialCompleted from the current save when it advanced past the snapshot', () => {
    // Tutorial completes mid-level: snapshot was taken before completion, but
    // we don't want to make the player re-watch it.
    const beforeLevel = baseline({ currentLevel: 1, tutorialCompleted: false });
    const afterClear = baseline({ currentLevel: 2, tutorialCompleted: true });

    const restored = computeReplaySave(beforeLevel, afterClear);

    expect(restored.tutorialCompleted).toBe(true);
  });

  it('replaying multiple times does not let gold drift up', () => {
    const beforeLevel = baseline({ currentLevel: 4, gold: 200 });

    let current = baseline({ currentLevel: 5, completedLevels: 4, gold: 320 });
    for (let i = 0; i < 5; i++) {
      const restored = computeReplaySave(beforeLevel, current);
      // simulate clearing the same level again with the same earnings.
      current = baseline({
        ...restored,
        currentLevel: 5,
        completedLevels: 4,
        gold: restored.gold + 120
      });
    }

    const final = computeReplaySave(beforeLevel, current);
    expect(final.gold).toBe(200);
  });

  it('restores defender HP that took damage during the level', () => {
    const beforeLevel = baseline({
      currentLevel: 6,
      archerLevel: 3,
      archerHp: [20, 20, 20],
      mageLevel: 1,
      mageHp: 32
    });
    const afterClear = baseline({
      ...beforeLevel,
      archerHp: [20, 4, 0],
      mageHp: 12,
      currentLevel: 7,
      completedLevels: 6
    });

    const restored = computeReplaySave(beforeLevel, afterClear);

    expect(restored.archerHp).toEqual([20, 20, 20]);
    expect(restored.mageHp).toBe(32);
    expect(restored.currentLevel).toBe(6);
  });
});
