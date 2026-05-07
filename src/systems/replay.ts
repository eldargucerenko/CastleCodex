import type { SaveData } from '../types/game';

// Build the save state to restore when the player taps Replay on the level
// complete modal. We roll back to the snapshot taken at the start of the
// level so per-kill gold, the level-clear bonus, and any rewarded-ad bonus
// all reset together. Without this, clearing a level + replaying lets the
// player grind gold for free. tutorialCompleted is preserved from the current
// save so a finished tutorial doesn't replay.
export function computeReplaySave(saveBeforeLevel: SaveData, currentSave: SaveData): SaveData {
  return {
    ...saveBeforeLevel,
    tutorialCompleted: currentSave.tutorialCompleted || saveBeforeLevel.tutorialCompleted
  };
}
