import Phaser from 'phaser';
import { ENEMY_STATS } from '../data/enemies';
import type { Enemy } from './Enemy';
import type { Castle } from './Castle';
import { LOGICAL_W, LOGICAL_H } from '../config/dimensions';

export class RollingLog {
  private body: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private rolling = false;
  private destroyed = false;
  private hitEnemies = new WeakSet<Enemy>();
  private readonly damage = Math.ceil(ENEMY_STATS.basic.hp / 3);
  private readonly laneHitHalfHeight = 72;

  constructor(
    private scene: Phaser.Scene,
    private castle: Castle,
    private getEnemies: () => Enemy[],
    private onUse: () => void
  ) {
    this.body = scene.add.rectangle(castle.width / 2, castle.top - 58, castle.width * 0.44, 20, 0x7c3f1d).setStrokeStyle(3, 0x3f1f0f).setDepth(45);
    this.body.setAngle(-8);
    this.body.setInteractive({ useHandCursor: true });
    this.label = scene.add.text(castle.width / 2, castle.top - 84, 'LOG', { color: '#3f1f0f', fontSize: '13px', fontStyle: 'bold' }).setOrigin(0.5).setDepth(46);

    this.body.on('pointerdown', () => this.startRolling());
  }

  update(time: number, delta: number): void {
    if (!this.rolling || this.destroyed) return;

    const dt = delta / 1000;
    this.body.x += 430 * dt;
    this.body.rotation += 8.5 * dt;

    for (const enemy of this.getEnemies()) {
      if (!enemy.alive || enemy.state === 'Dead' || enemy.state === 'Grabbed' || this.hitEnemies.has(enemy)) continue;
      const overlapsX = Math.abs(enemy.x - this.body.x) <= enemy.stats.radius + this.body.width / 2;
      const overlapsY = Math.abs(enemy.y - this.body.y) <= enemy.stats.radius + this.laneHitHalfHeight;
      if (!overlapsX || !overlapsY) continue;

      this.hitEnemies.add(enemy);
      enemy.takeDamage(this.damage);
      enemy.isSlowedUntil = Math.max(enemy.isSlowedUntil, time + 1000);
      this.spawnHit(enemy.x, enemy.y);
    }

    if (this.body.x > LOGICAL_W + 90) {
      this.destroy();
    }
  }

  private startRolling(): void {
    if (this.rolling || this.destroyed) return;
    this.rolling = true;
    this.onUse();
    this.body.disableInteractive();
    this.label.destroy();
    this.body.setAngle(0);
    this.body.x = this.castle.width + this.body.width / 2;
    this.body.y = LOGICAL_H - 92;
    this.scene.tweens.add({
      targets: this.body,
      scaleX: 1.12,
      duration: 90,
      yoyo: true
    });
  }

  private spawnHit(x: number, y: number): void {
    const text = this.scene.add.text(x, y - 24, `-${this.damage} slow`, {
      color: '#78350f',
      fontSize: '13px',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(90);
    this.scene.tweens.add({
      targets: text,
      y: text.y - 22,
      alpha: 0,
      duration: 520,
      onComplete: () => text.destroy()
    });
  }

  private destroy(): void {
    this.destroyed = true;
    this.body.destroy();
  }
}
