import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';

export class CombatSystem {
  static damageEnemy(scene: Phaser.Scene, enemy: Enemy, amount: number): boolean {
    const died = enemy.takeDamage(amount);
    if (died) {
      const burst = scene.add.circle(enemy.x, enemy.y, 8, 0xfacc15, 0.55).setDepth(30);
      scene.tweens.add({ targets: burst, radius: 36, alpha: 0, duration: 260, onComplete: () => burst.destroy() });
    }
    return died;
  }
}
