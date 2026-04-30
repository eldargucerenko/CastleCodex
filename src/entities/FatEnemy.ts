import Phaser from 'phaser';
import type { Castle } from './Castle';
import { Enemy } from './Enemy';

export class FatEnemy extends Enemy {
  private throwAbilityUsed = false;
  private nextThrowCheckAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, groundY?: number) {
    super(scene, x, y, 'fat', groundY);
  }

  override updateEnemy(time: number, delta: number, castle: Castle, enemies: Enemy[] = []): void {
    if (!this.throwAbilityUsed && this.state === 'WalkToCastle' && time >= this.nextThrowCheckAt) {
      this.nextThrowCheckAt = time + 1000;
      this.tryThrowNearbyKnight(castle, enemies);
    }
    super.updateEnemy(time, delta, castle, enemies);
  }

  private tryThrowNearbyKnight(castle: Castle, enemies: Enemy[]): void {
    const knight = enemies.find((enemy) => {
      if (enemy === this || !enemy.alive || enemy.kind !== 'basic') return false;
      if (enemy.state === 'Grabbed' || enemy.state === 'Flying' || enemy.state === 'Dead') return false;
      return Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y) <= 180;
    });
    if (!knight) return;

    if (Math.random() > 0.6) {
      this.showAbilityText('miss');
      return;
    }

    this.throwAbilityUsed = true;
    const targetX = castle.width + knight.stats.radius + 82;
    const flightTime = Phaser.Math.Clamp((knight.x - targetX) / 320, 1.05, 1.7);
    const vx = (targetX - knight.x) / flightTime;
    knight.x = this.x - this.stats.radius - knight.stats.radius;
    knight.y = this.y - 20;
    knight.launch(vx, -430);
    this.showAbilityText('throw');
  }

  private showAbilityText(value: string): void {
    const text = this.scene.add
      .text(this.x, this.y - this.stats.radius - 38, value, {
        color: '#7c2d12',
        fontSize: '14px',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(80);
    this.scene.tweens.add({
      targets: text,
      y: text.y - 24,
      alpha: 0,
      duration: 650,
      onComplete: () => text.destroy()
    });
  }
}
