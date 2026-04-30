import type { UpgradeCostTable } from '../types/game';

export const UPGRADE_COSTS: UpgradeCostTable = {
  walls: [50, 100, 180],
  archers: [60, 130, 220],
  traps: [70, 150, 250],
  mage: [100, 220, 350]
};

export const MAX_UPGRADE_LEVEL = 3;
