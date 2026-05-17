import Phaser from 'phaser';
import { ENEMY_STATS } from '../data/enemies';
import type { Enemy } from './Enemy';
import type { Castle } from './Castle';
import { LOGICAL_W, LOGICAL_H } from '../config/dimensions';

const LOG_HANG_FRAME = 'hanging';
const LOG_ROLL_FRAME = 'rolling';
const LOG_HANG_CROP = { x: 1365, y: 733, width: 185, height: 207 };
const LOG_ROLL_CROP = { x: 1365, y: 826, width: 185, height: 114 };

export class RollingLog {
  private body: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private clickZone?: Phaser.GameObjects.Zone;
  private label?: Phaser.GameObjects.Text;
  private rolling = false;
  private destroyed = false;
  private hitEnemies = new WeakSet<Enemy>();
  private readonly damage = Math.ceil(ENEMY_STATS.basic.hp / 3);
  private readonly laneHitHalfHeight = 72;
  private readonly rollingHalfWidth = 61;

  constructor(
    private scene: Phaser.Scene,
    private castle: Castle,
    private getEnemies: () => Enemy[],
    private onUse: () => void
  ) {
    const rest = castle.getLogRestPosition();
    if (scene.textures.exists('castle-log-trap')) {
      this.ensureLogFrames(scene);
      this.body = scene.add
        .image(rest.x, rest.y, 'castle-log-trap', LOG_HANG_FRAME)
        .setDisplaySize(118, 132)
        .setAngle(-5)
        .setDepth(45);
    } else {
      this.body = scene.add.rectangle(rest.x, rest.y, castle.width * 0.34, 20, 0x7c3f1d).setStrokeStyle(3, 0x3f1f0f).setDepth(45);
      this.body.setAngle(-8);
      this.label = scene.add.text(rest.x, rest.y - 26, 'LOG', { color: '#3f1f0f', fontSize: '13px', fontStyle: 'bold' }).setOrigin(0.5).setDepth(46);
    }

    // The art has ropes and transparent padding, so use a generous explicit
    // hit zone. This keeps the trap clickable even when the visible log sits
    // over detailed castle artwork.
    this.clickZone = scene.add.zone(rest.x, rest.y, 160, 128).setOrigin(0.5).setDepth(48).setInteractive();
    this.clickZone.on('pointerdown', () => this.startRolling());
  }

  update(time: number, delta: number): void {
    if (!this.rolling || this.destroyed) return;

    const dt = delta / 1000;
    this.body.x += 430 * dt;
    this.body.rotation += 8.5 * dt;

    for (const enemy of this.getEnemies()) {
      if (!enemy.alive || enemy.state === 'Dead' || enemy.state === 'Grabbed' || this.hitEnemies.has(enemy)) continue;
      const overlapsX = Math.abs(enemy.x - this.body.x) <= enemy.stats.radius + this.rollingHalfWidth;
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
    this.clickZone?.destroy();
    this.clickZone = undefined;
    this.label?.destroy();
    this.body.setAngle(0);
    if (this.body instanceof Phaser.GameObjects.Image) {
      this.body.setFrame(LOG_ROLL_FRAME).setDisplaySize(this.rollingHalfWidth * 2, 42);
    }
    this.body.x = this.castle.width + this.rollingHalfWidth;
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
    this.clickZone?.destroy();
    this.body.destroy();
  }

  private ensureLogFrames(scene: Phaser.Scene): void {
    const texture = scene.textures.get('castle-log-trap');
    if (!texture.has(LOG_HANG_FRAME)) {
      texture.add(LOG_HANG_FRAME, 0, LOG_HANG_CROP.x, LOG_HANG_CROP.y, LOG_HANG_CROP.width, LOG_HANG_CROP.height);
    }
    if (!texture.has(LOG_ROLL_FRAME)) {
      texture.add(LOG_ROLL_FRAME, 0, LOG_ROLL_CROP.x, LOG_ROLL_CROP.y, LOG_ROLL_CROP.width, LOG_ROLL_CROP.height);
    }
  }
}
