import { MAX_UPGRADE_LEVEL, UPGRADE_COSTS } from '../data/upgrades';
import type { SaveData, UpgradeKey } from '../types/game';
import { EconomySystem } from './EconomySystem';

const LOG_TRAP_COST = 45;

export class UpgradeSystem {
  static getCost(save: SaveData, key: UpgradeKey): number {
    if (key === 'repair') return EconomySystem.repairCost(save.maxHp - save.currentHp);
    if (key === 'log') return save.logTrapCount >= 1 ? Infinity : LOG_TRAP_COST;
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
    if (key === 'archers') next.archerLevel += 1;
    if (key === 'traps') next.trapLevel += 1;
    if (key === 'mage') next.mageLevel += 1;
    if (key === 'log') next.logTrapCount = 1;
    return next;
  }
}
