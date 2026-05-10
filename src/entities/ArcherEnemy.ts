import Phaser from 'phaser';
import { Enemy } from './Enemy';
import type { Castle } from './Castle';
import { Projectile } from './Projectile';

export class ArcherEnemy extends Enemy {
  private lastShotAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, groundY?: number) {
    super(scene, x, y, 'archer', groundY);
  }

  override updateEnemy(time: number, delta: number, castle: Castle): void {
    if (this.state === 'Dead' || this.state === 'Grabbed') return;
    if (this.state === 'Flying' || this.state === 'Stunned') {
      this.updateFlying(delta, castle);
      return;
    }

    const range = this.stats.range ?? 320;
    if (this.x <= castle.width + range) {
      this.state = 'ShootCastle';
      if (time - this.lastShotAt > (this.stats.projectileRateMs ?? 1500)) {
        this.lastShotAt = time;
        this.triggerStrike();
        const defender = castle.getLivingDefenderTarget();
        if (defender) {
          new Projectile(this.scene, this.x, this.y - 6, defender.x, defender.y, 420, 0xffd166, () => {
            castle.damageDefender(defender, Math.ceil(defender.maxHp / 2));
          });
        } else {
          new Projectile(this.scene, this.x, this.y - 6, castle.width + 12, this.y - 20, 420, 0xffd166, () => {
            castle.takeDamage(this.stats.projectileDamage ?? 4);
          });
        }
      }
      return;
    }

    this.state = 'WalkToRange';
    this.x -= this.stats.speed * (delta / 1000);
  }
}
