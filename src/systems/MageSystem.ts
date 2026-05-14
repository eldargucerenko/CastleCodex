import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Castle } from '../entities/Castle';
import { Projectile } from '../entities/Projectile';

export class MageSystem {
  private nextCastAt = 0;
  private readonly cooldown = 5100;
  private readonly radius = 106;
  private readonly damage = 13;

  constructor(private scene: Phaser.Scene, private castle: Castle, private level: number, private getEnemies: () => Enemy[]) {}

  update(time: number): void {
    if (this.level <= 0 || !this.castle.hasLivingMage() || time < this.nextCastAt) return;
    const mage = this.castle.getLivingMageTarget();
    if (!mage) return;
    const target = this.getEnemies()
      .filter((enemy) => this.isValidTarget(enemy))
      .sort((a, b) => a.x - b.x)[0];
    if (!target) return;
    this.nextCastAt = time + this.cooldown;
    // Re-validate per frame so a spell already in flight drops its target
    // when the player grabs (or hurls) the enemy -- otherwise the homing
    // callback chases the dragged sprite around like an auto-aim aimbot.
    Projectile.homing(this.scene, mage.x + 10, mage.y + 2, () => (this.isValidTarget(target) ? target : undefined), 560, 0x60a5fa, () => {
      this.resolveSpellHit(time, target, this.radius, this.damage);
    });
  }

  private isValidTarget(enemy: Enemy): boolean {
    if (!enemy.alive) return false;
    if (enemy.state === 'Grabbed' || enemy.state === 'Flying') return false;
    return true;
  }

  private resolveSpellHit(time: number, target: Enemy, radius: number, damage: number): void {
    if (!target.alive) return;
    const ring = this.scene.add.circle(target.x, target.y, 8, 0x60a5fa, 0.16).setStrokeStyle(3, 0x2563eb, 0.65).setDepth(6);
    this.scene.tweens.add({
      targets: ring,
      radius,
      alpha: 0,
      duration: 380,
      onComplete: () => ring.destroy()
    });
    for (const enemy of this.getEnemies()) {
      if (!enemy.alive) continue;
      if (Phaser.Math.Distance.Between(target.x, target.y, enemy.x, enemy.y) <= radius) {
        enemy.takeDamage(damage);
        enemy.isSlowedUntil = time + 1800;
      }
    }
  }
}
