import Phaser from 'phaser';
import type { Castle } from '../entities/Castle';
import type { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { WizardEnemy } from '../entities/WizardEnemy';

export class ArcherSystem {
  private nextShotAt = 0;

  constructor(private scene: Phaser.Scene, private castle: Castle, private getEnemies: () => Enemy[]) {}

  update(time: number): void {
    const livingArchers = this.castle.getLivingArcherCount();
    if (livingArchers <= 0 || time < this.nextShotAt) return;
    const fireRate = Math.max(430, (1050 - livingArchers * 190) * 1.2);
    const damage = 2 + livingArchers;
    const range = 420 + livingArchers * 80;
    const shooter = this.castle.getLivingArcherTarget();
    const targets = this.getEnemies().filter((enemy) => this.canShootTarget(enemy, range));
    const target = Phaser.Utils.Array.GetRandom(targets);
    if (!target || !shooter) return;
    this.nextShotAt = time + fireRate;
    Projectile.homing(this.scene, shooter.x + 12, shooter.y - 8, () => (this.canShootTarget(target, range) ? target : undefined), 620, 0xf59e0b, () => {
      if (target instanceof WizardEnemy && target.hasActiveShield()) {
        target.pulseShield();
        return;
      }
      if (target.alive) target.takeDamage(damage);
    });
  }

  private canShootTarget(enemy: Enemy, range: number): boolean {
    if (!enemy.alive) return false;
    if (enemy.state === 'Flying' || enemy.state === 'Grabbed') return false;
    return enemy.x - this.castle.width <= range;
  }
}
