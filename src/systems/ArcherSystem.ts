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
    // Quick recoil pulse on the firing archer so the player can read who shot.
    this.castle.animateArcherShot(shooter);
    // Straight-line shot at the target's CURRENT position. Non-homing so the
    // arrow doesn't curve toward an enemy that walks while the arrow is in
    // flight ("self-aiming"). Damage still applies to the target object on
    // arrival -- the target may have moved by then; this keeps the gameplay
    // simple while losing the visually awkward homing curve.
    new Projectile(this.scene, shooter.x + 12, shooter.y - 8, target.x, target.y, 620, 0xf59e0b, () => {
      if (!this.canShootTarget(target, this.range)) return;
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
