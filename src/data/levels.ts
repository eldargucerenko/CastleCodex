import type { LevelDefinition } from '../types/game';

export const LEVELS: LevelDefinition[] = [
  { level: 1, waves: [{ kind: 'basic', count: 5 }, { kind: 'fat', count: 1 }, { kind: 'raider', count: 1 }, { kind: 'jumper', count: 1 }, { kind: 'archer', count: 1 }, { kind: 'wizard_easy', count: 1 }, { kind: 'bomber', count: 1 }] },
  { level: 2, waves: [{ kind: 'basic', count: 7 }] },
  { level: 3, waves: [{ kind: 'basic', count: 8 }, { kind: 'fat', count: 1 }] },
  { level: 4, waves: [{ kind: 'basic', count: 10 }, { kind: 'fat', count: 2 }] },
  { level: 5, waves: [{ kind: 'basic', count: 8 }, { kind: 'fat', count: 2 }, { kind: 'archer', count: 1 }] },
  { level: 6, waves: [{ kind: 'basic', count: 10 }, { kind: 'fat', count: 2 }, { kind: 'archer', count: 2 }] },
  { level: 7, waves: [{ kind: 'basic', count: 10 }, { kind: 'fat', count: 3 }, { kind: 'archer', count: 2 }, { kind: 'trunk', count: 1 }] },
  { level: 8, waves: [{ kind: 'basic', count: 12 }, { kind: 'fat', count: 3 }, { kind: 'archer', count: 2 }, { kind: 'trunk', count: 2 }] },
  { level: 9, waves: [{ kind: 'basic', count: 10 }, { kind: 'fat', count: 4 }, { kind: 'archer', count: 3 }, { kind: 'trunk', count: 2 }, { kind: 'wizard_medium', count: 1 }] },
  { level: 10, waves: [{ kind: 'basic', count: 12 }, { kind: 'fat', count: 5 }, { kind: 'archer', count: 3 }, { kind: 'trunk', count: 3 }, { kind: 'wizard_medium', count: 1 }, { kind: 'wizard_hard', count: 1 }] }
];

export const getLevel = (level: number): LevelDefinition => LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level - 1))];
