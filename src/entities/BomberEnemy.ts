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
      if (this.fuseStartedAt === undefined) {
        this.fuseStartedAt = time;
        // Play the bomber's lit-bomb pose once when the fuse starts so
        // the visible animation matches what's about to happen, and kick
        // off a yoyo pulse that runs through the ~1s fuse (5 reps of
        // 80ms yoyo = 800ms, ends just before explode). Used to be
        // re-added every frame, which stacked tweens and left the scale
        // jittering / stuck non-1 after the bomber was thrown.
        this.triggerStrike();
        this.scene.tweens.add({
          targets: this,
          scaleX: 1.18, scaleY: 1.18,
          yoyo: true, repeat: 4, duration: 80
        });
      }
      const fuseLeft = Math.max(0, 1 - (time - this.fuseStartedAt) / 1000);
      this.statusText.setText(fuseLeft > 0 ? fuseLeft.toFixed(1) : 'BOOM');
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
    // New orb-pulse sprite-based blast. Falls back to the legacy colored
    // circle if the spritesheet didn't load (defensive against asset gaps).
    if (this.scene.anims.exists('effect-orb-pulse')) {
      const blast = this.scene.add.sprite(this.x, this.y, 'effect-orb', 0).setDepth(30);
      // Source frame is 128px; bomber blast was ~58px radius (116px wide),
      // so display the orb roughly at that size.
      blast.setDisplaySize(120, 120);
      blast.play('effect-orb-pulse');
      blast.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => blast.destroy());
    } else {
      const blast = this.scene.add.circle(this.x, this.y, 12, 0xf97316, 0.5).setDepth(30);
      this.scene.tweens.add({
        targets: blast,
        radius: 58,
        alpha: 0,
        duration: 260,
        onComplete: () => blast.destroy()
      });
    }
    castle.takeDamage(this.stats.attackDamage);
    this.die();
  }
}
