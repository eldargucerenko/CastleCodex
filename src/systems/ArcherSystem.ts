import Phaser from 'phaser';
import type { Castle } from '../entities/Castle';
import type { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { WizardEnemy } from '../entities/WizardEnemy';

export class ArcherSystem {
  private nextShotAt = 0;
  private readonly fireRate = 1032;
  private readonly damage = 3;
  private readonly range = 500;

  constructor(private scene: Phaser.Scene, private castle: Castle, private getEnemies: () => Enemy[]) {}

  update(time: number): void {
    const livingArchers = this.castle.getLivingArcherCount();
    if (livingArchers <= 0 || time < this.nextShotAt) return;
    const shooter = this.castle.getLivingArcherTarget();
    const targets = this.getEnemies().filter((enemy) => this.canShootTarget(enemy, this.range));
    const target = Phaser.Utils.Array.GetRandom(targets);
    if (!target || !shooter) return;
    this.nextShotAt = time + this.fireRate;
    Projectile.homing(this.scene, shooter.x + 12, shooter.y - 8, () => (this.canShootTarget(target, this.range) ? target : undefined), 620, 0xf59e0b, () => {
      if (target instanceof WizardEnemy && target.hasActiveShield()) {
        target.pulseShield();
        return;
      }
      if (target.alive) target.takeDamage(this.damage);
    }, 'arrow-castle');
  }

  private canShootTarget(enemy: Enemy, range: number): boolean {
    if (!enemy.alive) return false;
    if (enemy.state === 'Flying' || enemy.state === 'Grabbed') return false;
    return enemy.x - this.castle.width <= range;
  }
}
