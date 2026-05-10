export type EnemyKind =
  | 'basic'
  | 'fat'
  | 'archer'
  // | 'burning'  // disabled: not in current enemy roster
  | 'wizard'
  | 'wizard_easy'
  | 'wizard_medium'
  | 'wizard_hard'
  | 'bomber'
  | 'raider'
  | 'jumper'
  | 'trunk'
  | 'cursor_mage';

export type EnemyState =
  | 'Spawn'
  | 'WalkToCastle'
  | 'AttackCastle'
  | 'Grabbed'
  | 'Flying'
  | 'Stunned'
  | 'Dead'
  | 'WalkToRange'
  | 'ShootCastle';

export type BurningState = 'Hot' | 'Cooling' | 'Cooled';
export type WizardState = 'Shielded' | 'Unlocking' | 'Unlocked' | 'CastingShield';

export interface CastleProgress {
  currentHp: number;
  maxHp: number;
  baseDamageReduction: number;
  wallLevel: number;
  archerLevel: number;
  trapLevel: number;
  mageLevel: number;
  logTrapCount: number;
  archerHp: number[];
  mageHp?: number;
}

export interface SaveData extends CastleProgress {
  currentLevel: number;
  gold: number;
  completedLevels: number;
  tutorialCompleted: boolean;
}

export interface EnemyStats {
  kind: EnemyKind;
  hp: number;
  speed: number;
  attackDamage: number;
  attackRateMs: number;
  radius: number;
  mass: number;
  dragFollow: number;
  throwMultiplier: number;
  killReward: number;
  collisionDamageFactor: number;
  color: number;
  label: string;
  range?: number;
  projectileDamage?: number;
  projectileRateMs?: number;
}

export interface LevelWaveEntry {
  kind: EnemyKind;
  count: number;
}

export interface LevelDefinition {
  level: number;
  waves: LevelWaveEntry[];
}

export type UpgradeKey = 'repair' | 'walls' | 'archers' | 'healArchers' | 'traps' | 'mage' | 'healMage' | 'log';

export interface UpgradeCostTable {
  walls: number[];
  archers: number[];
  traps: number[];
  mage: number[];
}
