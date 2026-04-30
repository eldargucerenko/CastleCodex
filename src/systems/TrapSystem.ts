import Phaser from 'phaser';
import { Trap } from '../entities/Trap';
import type { Enemy } from '../entities/Enemy';

export class TrapSystem {
  private trap?: Trap;
  private cooldownByEnemy = new WeakMap<Enemy, number>();

  constructor(private scene: Phaser.Scene, private level: number, private getEnemies: () => Enemy[]) {
    if (level > 0) this.trap = new Trap(scene, level);
  }

  update(time: number): void {
    if (!this.trap) return;
    const damage = 10 + this.level * 8;
    for (const enemy of this.getEnemies()) {
      if (!enemy.alive || enemy.state === 'Grabbed') continue;
      const readyAt = this.cooldownByEnemy.get(enemy) ?? 0;
      if (time < readyAt) continue;
      if (this.trap.zone.contains(enemy.x, enemy.y)) {
        enemy.takeDamage(damage);
        this.cooldownByEnemy.set(enemy, time + 1800);
        this.trap.pulse(this.scene);
      }
    }
  }
}
