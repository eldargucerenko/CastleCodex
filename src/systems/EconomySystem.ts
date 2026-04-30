export class EconomySystem {
  static levelCompleteReward(level: number): number {
    return 20 + level * 10;
  }

  static repairCost(missingHp: number): number {
    return Math.max(0, Math.ceil(missingHp * 0.5));
  }
}
