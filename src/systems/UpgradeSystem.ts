import { MAX_UPGRADE_LEVEL, UPGRADE_COSTS } from '../data/upgrades';
import type { SaveData, UpgradeKey } from '../types/game';
import { EconomySystem } from './EconomySystem';

const LOG_TRAP_COST = 45;
const ARCHER_MAX_HP = 20;
const MAGE_MAX_HP = 32;
const DEFENDER_REPAIR_COST_FACTOR = 0.75;

export class UpgradeSystem {
  static getCost(save: SaveData, key: UpgradeKey): number {
    if (key === 'repair') return EconomySystem.repairCost(save.maxHp - save.currentHp);
    if (key === 'log') return save.logTrapCount >= 1 ? Infinity : LOG_TRAP_COST;
    if (key === 'healArchers') return this.defenderRepairCost(this.missingArcherHp(save));
    if (key === 'healMage') return this.defenderRepairCost(this.missingMageHp(save));
    const levelKey =
      key === 'walls' ? 'wallLevel' : key === 'archers' ? 'archerLevel' : key === 'traps' ? 'trapLevel' : 'mageLevel';
    const currentLevel = save[levelKey as keyof SaveData] as number;
    if (currentLevel >= MAX_UPGRADE_LEVEL) return Infinity;
    return UPGRADE_COSTS[key][currentLevel];
  }

  static buy(save: SaveData, key: UpgradeKey): SaveData {
    const cost = this.getCost(save, key);
    if (!Number.isFinite(cost) || save.gold < cost) return save;
    const next = { ...save, gold: save.gold - cost };
    if (key === 'repair') {
      next.currentHp = next.maxHp;
      return next;
    }
    if (key === 'walls') {
      next.wallLevel += 1;
      next.maxHp += 45;
      next.currentHp += 45;
      next.baseDamageReduction = Math.min(0.3, next.wallLevel * 0.08);
      return next;
    }
    if (key === 'archers') {
      next.archerLevel += 1;
      next.archerHp = this.normalizedArcherHp(next).concat(ARCHER_MAX_HP).slice(0, next.archerLevel);
    }
    if (key === 'healArchers') {
      next.archerHp = Array.from({ length: next.archerLevel }, () => ARCHER_MAX_HP);
    }
    if (key === 'traps') next.trapLevel += 1;
    if (key === 'mage') {
      next.mageLevel += 1;
      next.mageHp = next.mageHp ?? MAGE_MAX_HP;
    }
    if (key === 'healMage') {
      next.mageHp = MAGE_MAX_HP;
    }
    if (key === 'log') next.logTrapCount = 1;
    return next;
  }

  private static defenderRepairCost(missingHp: number): number {
    return missingHp > 0 ? Math.ceil(missingHp * DEFENDER_REPAIR_COST_FACTOR) : Infinity;
  }

  private static normalizedArcherHp(save: SaveData): number[] {
    return Array.from({ length: save.archerLevel }, (_, index) => Math.min(ARCHER_MAX_HP, Math.max(0, save.archerHp[index] ?? ARCHER_MAX_HP)));
  }

  private static missingArcherHp(save: SaveData): number {
    if (save.archerLevel <= 0) return 0;
    return this.normalizedArcherHp(save).reduce((missing, hp) => missing + ARCHER_MAX_HP - hp, 0);
  }

  private static missingMageHp(save: SaveData): number {
    if (save.mageLevel <= 0) return 0;
    return MAGE_MAX_HP - Math.min(MAGE_MAX_HP, Math.max(0, save.mageHp ?? MAGE_MAX_HP));
  }
}
