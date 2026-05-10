import Phaser from 'phaser';
import { Enemy } from './Enemy';
import type { Castle } from './Castle';
import type { EnemyKind } from '../types/game';
import { Projectile } from './Projectile';

interface RuneButton {
  digit: number;
  x: number;
  y: number;
  circle: Phaser.GameObjects.Arc;
  text: Phaser.GameObjects.Text;
}

export class WizardEnemy extends Enemy {
  readonly runeCount: number;
  private sequence: number[];
  private progress = 0;
  private shield?: Phaser.GameObjects.Arc;
  private runes: RuneButton[] = [];
  private lastShotAt = 0;
  private shieldCastStartedAt?: number;
  private castText?: Phaser.GameObjects.Text;

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
        new Projectile(this.scene, this.x - 8, this.y - 10, castle.width + 14, this.y - 24, 390, 0xa855f7, () => {
          castle.takeDamage(this.stats.projectileDamage ?? 7);
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

  override grab(): void {
    if (this.wizardState === 'CastingShield') {
      this.interruptShieldCast();
    } else {
      this.cancelShieldCast();
    }
    super.grab();
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
    rune.circle.setFillStyle(0x86efac, 0.95);
    rune.circle.setStrokeStyle(3, 0x166534, 1);
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
      rune.circle.setFillStyle(0xffffff, 0.96);
      rune.circle.setStrokeStyle(3, 0x111827, 1);
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
        targets: [rune.circle, rune.text],
        alpha: 0,
        y: rune.y - 14,
        duration: 420,
        onComplete: () => {
          rune.circle.destroy();
          rune.text.destroy();
        }
      });
    }
  }

  private updateShieldCast(time: number): void {
    this.state = 'Stunned';
    this.vx = 0;
    this.vy = 0;
    this.wizardState = 'CastingShield';
    this.shieldCastStartedAt ??= time;
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
    this.shield = this.scene.add.circle(0, 0, this.stats.radius + 13, 0x8b5cf6, 0.18).setStrokeStyle(3, 0xc4b5fd, 0.95);
    this.add(this.shield);
    this.sendToBack(this.shield);
  }

  private createRunes(): void {
    const positions = this.getRunePositions(this.runeCount);
    this.runes = this.sequence.map((digit, index) => {
      const position = positions[index];
      const circle = this.scene.add.circle(position.x, position.y, 20, 0xffffff, 0.96).setStrokeStyle(3, 0x111827, 1);
      const text = this.scene.add
        .text(position.x, position.y + 1, String(digit), { color: '#111827', fontSize: '25px', fontStyle: 'bold' })
        .setOrigin(0.5);
      this.add([circle, text]);
      return { digit, x: position.x, y: position.y, circle, text };
    });
  }

  private getRuneAt(pointerX: number, pointerY: number): RuneButton | undefined {
    const localX = pointerX - this.x;
    const localY = pointerY - this.y;
    return this.runes.find((rune) => Phaser.Math.Distance.Between(localX, localY, rune.x, rune.y) <= 23);
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
