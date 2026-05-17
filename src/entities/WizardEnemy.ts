import Phaser from 'phaser';
import { Enemy } from './Enemy';
import type { Castle } from './Castle';
import type { EnemyKind } from '../types/game';
import { Projectile } from './Projectile';

interface RuneButton {
  digit: number;
  x: number;
  y: number;
  orb: Phaser.GameObjects.Sprite;
  text: Phaser.GameObjects.Text;
}

export class WizardEnemy extends Enemy {
  readonly runeCount: number;
  private sequence: number[];
  private progress = 0;
  private shield?: Phaser.GameObjects.Sprite;
  private runes: RuneButton[] = [];
  private lastShotAt = 0;
  private shieldCastStartedAt?: number;
  private castText?: Phaser.GameObjects.Text;
  private runeHitRadius = 16;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: EnemyKind = 'wizard_easy', groundY?: number) {
    super(scene, x, y, kind, groundY);
    this.wizardState = 'Shielded';
    this.runeCount = this.getRuneCount(kind);
    this.sequence = this.createRuneOrder(this.runeCount);
    this.createShield();
    this.createRunes();
  }

  override updateEnemy(time: number, delta: number, castle: Castle): void {
    if (this.state === 'Dead') return;
    if (this.state === 'Grabbed') {
      this.cancelShieldCast();
      return;
    }
    if (this.state === 'Flying') {
      this.cancelShieldCast();
      this.updateFlying(delta, castle);
      return;
    }

    const range = this.stats.range ?? 370;
    if (this.x <= castle.width + range) {
      this.cancelShieldCast();
      this.state = 'ShootCastle';
      if (time - this.lastShotAt > (this.stats.projectileRateMs ?? 1600)) {
        this.lastShotAt = time;
        this.triggerStrike();
        // Strike2 plays at 14 fps over 8 frames (~571 ms). The wand swings
        // down to horizontal on the last frame -- delay the projectile spawn
        // to match so the bolt visually releases off the wand tip instead
        // of preceding the anim. Skip if the wizard's gone dead/grabbed/
        // flying between cast start and release.
        this.scene.time.delayedCall(430, () => {
          if (this.state === 'Dead' || this.state === 'Grabbed' || this.state === 'Flying') return;
          // Spawn at the wand's end (slightly forward + at hand height).
          // Sprite plays the looping orb-blast pulse; ~32 px display size
          // keeps the glowing orb readable without dominating.
          new Projectile(this.scene, this.x - 8, this.y - 2, castle.width + 14, this.y - 18, 390, 0xa855f7, () => {
            castle.takeDamage(this.stats.projectileDamage ?? 7);
          }, 'effect-blast', 'effect-blast-loop', 32);
        });
        if (this.shield?.active) {
          this.scene.tweens.add({ targets: this.shield, alpha: 0.32, yoyo: true, duration: 120 });
        }
      }
      return;
    }

    if (this.wizardState === 'CastingShield' && this.isOnGround()) {
      this.updateShieldCast(time);
      return;
    }

    if (this.state === 'Stunned' && this.wizardState !== 'Unlocked') {
      return;
    }

    if (this.wizardState === 'Unlocked' && this.isOnGround()) {
      this.updateShieldCast(time);
      return;
    }

    if (this.state === 'Stunned') {
      return;
    }

    this.cancelShieldCast();
    this.state = 'WalkToRange';
    const slow = time < this.isSlowedUntil ? 0.45 : 1;
    this.x -= this.stats.speed * slow * (delta / 1000);
  }

  override grab(clickWorldX?: number, clickWorldY?: number): void {
    if (this.wizardState === 'CastingShield') {
      this.interruptShieldCast();
    } else {
      this.cancelShieldCast();
    }
    super.grab(clickWorldX, clickWorldY);
  }

  override release(vx: number, vy: number): void {
    this.cancelShieldCast();
    super.release(vx, vy);
  }

  tryRuneClick(pointerX: number, pointerY: number): boolean {
    if (this.wizardState === 'Unlocked') return false;
    const rune = this.getRuneAt(pointerX, pointerY);
    if (!rune) return false;

    const expectedDigit = this.progress + 1;
    if (rune.digit !== expectedDigit) {
      this.resetRunes();
      this.scene.tweens.add({ targets: this, x: this.x + 5, duration: 35, yoyo: true, repeat: 2 });
      return true;
    }

    this.wizardState = 'Unlocking';
    this.progress += 1;
    // Tint the orb green for "correct"; the orb texture stays the same.
    rune.orb.setTint(0x86efac);
    rune.text.setText('*');
    if (this.shield?.active) {
      this.scene.tweens.add({ targets: this.shield, alpha: 0.38, yoyo: true, duration: 90 });
    }
    if (this.progress >= this.runeCount) {
      this.unlock();
    }
    return true;
  }

  hasRuneAt(pointerX: number, pointerY: number): boolean {
    return this.wizardState !== 'Unlocked' && this.getRuneAt(pointerX, pointerY) !== undefined;
  }

  isCastingShield(): boolean {
    return this.wizardState === 'CastingShield';
  }

  hasActiveShield(): boolean {
    return this.wizardState === 'Shielded' || this.wizardState === 'Unlocking';
  }

  pulseShield(): void {
    if (!this.shield?.active) return;
    this.scene.tweens.add({ targets: this.shield, alpha: 0.45, yoyo: true, duration: 120 });
  }

  resetRunes(): void {
    this.progress = 0;
    this.wizardState = 'Shielded';
    for (const rune of this.runes) {
      rune.orb.clearTint();
      rune.text.setText(String(rune.digit));
    }
  }

  private unlock(): void {
    this.wizardState = 'Unlocked';
    this.cancelShieldCast();
    this.shield?.destroy();
    this.shield = undefined;
    const runesToHide = this.runes;
    this.runes = [];
    for (const rune of runesToHide) {
      this.scene.tweens.add({
        targets: [rune.orb, rune.text],
        alpha: 0,
        y: rune.y - 14,
        duration: 420,
        onComplete: () => {
          rune.orb.destroy();
          rune.text.destroy();
        }
      });
    }
  }

  private updateShieldCast(time: number): void {
    this.state = 'Stunned';
    this.vx = 0;
    this.vy = 0;
    const justStarted = this.wizardState !== 'CastingShield';
    this.wizardState = 'CastingShield';
    this.shieldCastStartedAt ??= time;
    if (justStarted) {
      this.playLoopAnim('enemy-wizard-shield_cast');
    }
    this.castText ??= this.scene.add
      .text(0, -this.stats.radius - 33, '', { color: '#4c1d95', fontSize: '15px', fontStyle: 'bold' })
      .setOrigin(0.5);
    if (!this.castText.parentContainer) {
      this.add(this.castText);
    }

    const elapsed = time - this.shieldCastStartedAt;
    const remaining = Math.max(0, 2 - elapsed / 1000);
    this.castText.setText(remaining.toFixed(1));

    if (elapsed >= 2000) {
      this.finishShieldCast();
    }
  }

  private finishShieldCast(): void {
    this.cancelShieldCast();
    this.progress = 0;
    this.sequence = this.createRuneOrder(this.runeCount);
    this.wizardState = 'Shielded';
    this.createShield();
    this.createRunes();
    this.state = 'WalkToRange';
    this.scene.tweens.add({ targets: this.shield, alpha: 0.34, yoyo: true, duration: 160, repeat: 2 });
  }

  private cancelShieldCast(): void {
    this.shieldCastStartedAt = undefined;
    if (this.wizardState === 'CastingShield') {
      this.wizardState = 'Unlocked';
    }
    this.castText?.destroy();
    this.castText = undefined;
  }

  interruptShieldCast(): void {
    this.cancelShieldCast();
    const text = this.scene.add
      .text(this.x, this.y - this.stats.radius - 44, 'interrupted', {
        color: '#7c2d12',
        fontSize: '13px',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(60);
    this.scene.tweens.add({
      targets: text,
      y: text.y - 22,
      alpha: 0,
      duration: 520,
      onComplete: () => text.destroy()
    });
  }

  private isOnGround(): boolean {
    return this.y >= this.groundY - this.stats.radius - 1;
  }

  private createShield(): void {
    this.shield?.destroy();
    // Sprite-based aura ring (effect-shield-loop). Sized noticeably larger
    // than the wizard's body so it reads as a halo wrapped around the
    // figure, not a tight ring on the silhouette. Centered on the figure's
    // upper body (lifted up from the container origin) and drawn ON TOP of
    // the wizard so the player reads it as an active barrier, not just a
    // ground decoration.
    const diameter = (this.stats.radius + 46) * 2;
    const shieldY = -this.stats.radius + 2;
    const shield = this.scene.add.sprite(0, shieldY, 'effect-shield', 0).setDisplaySize(diameter, diameter);
    if (this.scene.anims.exists('effect-shield-loop')) shield.play('effect-shield-loop');
    this.shield = shield;
    this.add(shield);
    this.bringToTop(shield);
  }

  private createRunes(): void {
    const positions = this.getRunePositions(this.runeCount);
    // Cropped orb: sphere fills the frame on average ~78 of 128 px (pulses
    // 66 low to 91 peak). At SIZE=48 the visible sphere averages ~29 px.
    const ORB_SIZE = 48;
    // Hit radius matches the FULL displayed sprite (with a small bonus pad)
    // so it stays forgiving even at the low end of the pulse and through
    // the orb's outer glow. Better to over-include than under-click.
    this.runeHitRadius = ORB_SIZE / 2 + 4;
    this.runes = this.sequence.map((digit, index) => {
      const position = positions[index];
      const orb = this.scene.add.sprite(position.x, position.y, 'effect-orb', 0).setDisplaySize(ORB_SIZE, ORB_SIZE);
      orb.play('effect-orb-loop');
      orb.anims.setProgress(Math.random());
      const text = this.scene.add
        .text(position.x, position.y + 1, String(digit), { color: '#111827', fontSize: '20px', fontStyle: 'bold' })
        .setOrigin(0.5);
      this.add([orb, text]);
      return { digit, x: position.x, y: position.y, orb, text };
    });
  }

  private getRuneAt(pointerX: number, pointerY: number): RuneButton | undefined {
    const localX = pointerX - this.x;
    const localY = pointerY - this.y;
    return this.runes.find((rune) => Phaser.Math.Distance.Between(localX, localY, rune.x, rune.y) <= this.runeHitRadius);
  }

  private getRuneCount(kind: EnemyKind): number {
    if (kind === 'wizard_hard') return 5;
    if (kind === 'wizard_medium' || kind === 'wizard') return 4;
    return 3;
  }

  private createRuneOrder(count: number): number[] {
    const ordered = Array.from({ length: count }, (_, index) => index + 1);
    let shuffled = [...ordered];
    do {
      shuffled = Phaser.Utils.Array.Shuffle([...ordered]);
    } while (shuffled.every((digit, index) => digit === ordered[index]));
    return shuffled;
  }

  private getRunePositions(count: number): Array<{ x: number; y: number }> {
    const top = -this.stats.radius - 74;
    if (count === 3) {
      return [
        { x: -58, y: top + 34 },
        { x: 0, y: top },
        { x: 58, y: top + 34 }
      ];
    }
    if (count === 4) {
      return [
        { x: -72, y: top + 38 },
        { x: -24, y: top },
        { x: 24, y: top },
        { x: 72, y: top + 38 }
      ];
    }
    return [
      { x: -88, y: top + 44 },
      { x: -44, y: top + 8 },
      { x: 0, y: top - 8 },
      { x: 44, y: top + 8 },
      { x: 88, y: top + 44 }
    ];
  }
}
