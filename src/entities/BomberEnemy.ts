import Phaser from 'phaser';
import type { Castle } from './Castle';
import { Enemy } from './Enemy';

export class BomberEnemy extends Enemy {
  private fuseStartedAt?: number;

  constructor(scene: Phaser.Scene, x: number, y: number, groundY?: number) {
    super(scene, x, y, 'bomber', groundY);
    this.statusText.setText('BOOM');
  }

  override updateEnemy(time: number, delta: number, castle: Castle): void {
    if (this.state === 'Dead' || this.state === 'Grabbed') return;
    if (this.state === 'Flying' || this.state === 'Stunned') {
      this.fuseStartedAt = undefined;
      this.updateFlying(delta, castle);
      return;
    }

    const attackX = castle.width + this.stats.radius + 4;
    if (this.x <= attackX) {
      this.state = 'AttackCastle';
      this.vx = 0;
      this.fuseStartedAt ??= time;
      const fuseLeft = Math.max(0, 1 - (time - this.fuseStartedAt) / 1000);
      this.statusText.setText(fuseLeft > 0 ? fuseLeft.toFixed(1) : 'BOOM');
      this.scene.tweens.add({ targets: this, scaleX: 1.18, scaleY: 1.18, yoyo: true, duration: 80 });
      if (time - this.fuseStartedAt >= 1000) {
        this.explode(castle);
      }
      return;
    }

    this.fuseStartedAt = undefined;
    this.statusText.setText('BOOM');
    this.state = 'WalkToCastle';
    const slow = time < this.isSlowedUntil ? 0.45 : 1;
    this.x -= this.stats.speed * slow * (delta / 1000);
  }

  private explode(castle: Castle): void {
    const blast = this.scene.add.circle(this.x, this.y, 12, 0xf97316, 0.5).setDepth(30);
    this.scene.tweens.add({
      targets: blast,
      radius: 58,
      alpha: 0,
      duration: 260,
      onComplete: () => blast.destroy()
    });
    castle.takeDamage(this.stats.attackDamage);
    this.die();
  }
}
