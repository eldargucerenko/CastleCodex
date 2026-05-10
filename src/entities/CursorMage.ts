import Phaser from 'phaser';
import { LOGICAL_W } from '../config/dimensions';
import { CursorDebuff } from '../systems/CursorDebuff';
import type { Castle } from './Castle';
import { Enemy } from './Enemy';

const STOP_X = LOGICAL_W * 0.5;
const CAST_INTERVAL_MS = 4000;
const DEBUFF_DURATION_MS = 3000; // 3-second grab block per cast.

// Debug-only mage that walks to half-map then sits there casting a recurring
// drag-throw debuff. Useful for sanity-checking the CursorDebuff plumbing.
export class CursorMage extends Enemy {
  private lastCastAt = 0;
  private aura: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, x: number, y: number, groundY?: number) {
    super(scene, x, y, 'cursor_mage', groundY);
    // Faint purple aura that grows when a cast lands; lives outside the
    // container so it can pulse independent of the sprite's bob.
    this.aura = scene.add
      .circle(this.x, this.y, this.stats.radius * 1.6, 0x9333ea, 0)
      .setStrokeStyle(2, 0xa855f7, 0)
      .setDepth(4);
  }

  override updateEnemy(time: number, delta: number, castle: Castle, enemies: Enemy[] = []): void {
    if (this.state === 'Dead' || this.state === 'Grabbed') return;
    if (this.state === 'Flying' || this.state === 'Stunned') {
      this.updateFlying(delta, castle);
      return;
    }

    if (this.x <= STOP_X) {
      // Anchored at half-map: cast on a fixed interval.
      this.state = 'AttackCastle';
      this.vx = 0;
      if (time - this.lastCastAt > CAST_INTERVAL_MS) {
        this.lastCastAt = time;
        this.castDebuff(time);
      }
    } else {
      this.state = 'WalkToCastle';
      this.x -= this.stats.speed * (delta / 1000);
    }

    this.refreshDepth();
    this.updateAura(time);
    void enemies;
  }

  private castDebuff(time: number): void {
    CursorDebuff.apply(DEBUFF_DURATION_MS, time);
    // Pulse the aura: a short ring expansion that matches the cast.
    this.aura.setPosition(this.x, this.y);
    this.scene.tweens.killTweensOf(this.aura);
    this.aura.setScale(1).setAlpha(0).setStrokeStyle(3, 0xa855f7, 0.9);
    this.scene.tweens.add({
      targets: this.aura,
      scale: 2.6,
      alpha: 0,
      duration: 600,
      ease: 'Cubic.easeOut'
    });
    // Floating "slow" text so the test isn't invisible.
    const tag = this.scene.add
      .text(this.x, this.y - this.stats.radius - 28, 'NO GRAB!', {
        fontSize: '14px',
        color: '#fca5a5',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(80);
    this.scene.tweens.add({
      targets: tag,
      y: tag.y - 24,
      alpha: 0,
      duration: 700,
      onComplete: () => tag.destroy()
    });
  }

  private updateAura(time: number): void {
    // Track the mage so the ring stays attached if pushed around.
    this.aura.setPosition(this.x, this.y);
    // Subtle ambient ring while debuff is active.
    if (CursorDebuff.isActive(time)) {
      const t = (time % 1000) / 1000;
      this.aura.setStrokeStyle(2, 0xa855f7, 0.25 + 0.25 * Math.sin(t * Math.PI * 2));
    }
  }

  override destroy(fromScene?: boolean): void {
    this.aura.destroy();
    super.destroy(fromScene);
  }
}
