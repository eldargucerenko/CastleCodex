import Phaser from 'phaser';
import type { CastleProgress } from '../types/game';

export interface PlayerArcherTarget {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export class Castle {
  readonly x = 0;
  readonly width = 112;
  readonly top = 120;
  readonly bottom: number;
  currentHp: number;
  maxHp: number;
  baseDamageReduction: number;
  wallLevel: number;
  archerLevel: number;
  trapLevel: number;
  mageLevel: number;
  logTrapCount: number;
  private body: Phaser.GameObjects.Rectangle;
  private hpBar: Phaser.GameObjects.Rectangle;
  private hpBack: Phaser.GameObjects.Rectangle;
  private playerArchers: Array<
    PlayerArcherTarget & {
      body: Phaser.GameObjects.Arc;
      label: Phaser.GameObjects.Text;
      hpBack: Phaser.GameObjects.Rectangle;
      hpBar: Phaser.GameObjects.Rectangle;
    }
  > = [];

  constructor(private scene: Phaser.Scene, progress: CastleProgress) {
    this.bottom = Number(scene.game.config.height) - 56;
    this.currentHp = progress.currentHp;
    this.maxHp = progress.maxHp;
    this.baseDamageReduction = progress.baseDamageReduction;
    this.wallLevel = progress.wallLevel;
    this.archerLevel = progress.archerLevel;
    this.trapLevel = progress.trapLevel;
    this.mageLevel = progress.mageLevel;
    this.logTrapCount = progress.logTrapCount;

    const height = this.bottom - this.top;
    this.body = scene.add.rectangle(this.width / 2, this.top + height / 2, this.width, height, 0x8b5e3c);
    this.body.setStrokeStyle(4, 0x4b2f1a);
    scene.add.rectangle(58, this.top - 24, 78, 44, 0x9a6a45).setStrokeStyle(3, 0x4b2f1a);
    scene.add.rectangle(58, this.top - 62, 48, 42, 0x7a5234).setStrokeStyle(3, 0x4b2f1a);
    scene.add.text(19, this.top + 24, 'CASTLE', { color: '#fff7ed', fontSize: '16px', fontStyle: 'bold' }).setAngle(-90);

    this.hpBack = scene.add.rectangle(14, 28, 250, 14, 0x1f2937).setOrigin(0, 0.5);
    this.hpBar = scene.add.rectangle(14, 28, 250, 14, 0x22c55e).setOrigin(0, 0.5);
    this.createPlayerArchers();
    this.refreshHpBar();
  }

  takeDamage(rawDamage: number): number {
    const damage = Math.max(1, Math.round(rawDamage * (1 - this.baseDamageReduction)));
    this.currentHp = Math.max(0, this.currentHp - damage);
    this.scene.cameras.main.shake(90, 0.0025);
    this.refreshHpBar();
    return damage;
  }

  healFull(): void {
    this.currentHp = this.maxHp;
    this.refreshHpBar();
  }

  getLivingArcherTarget(): PlayerArcherTarget | undefined {
    return this.playerArchers.find((archer) => archer.hp > 0);
  }

  getLivingArcherCount(): number {
    return this.playerArchers.filter((archer) => archer.hp > 0).length;
  }

  damageArcher(target: PlayerArcherTarget, amount: number): void {
    const archer = this.playerArchers.find((candidate) => candidate === target);
    if (!archer || archer.hp <= 0) return;
    archer.hp = Math.max(0, archer.hp - amount);
    this.refreshArcher(archer);
    this.scene.tweens.add({ targets: archer.body, scaleX: 1.25, scaleY: 1.25, yoyo: true, duration: 90 });
  }

  toProgress(): CastleProgress {
    return {
      currentHp: this.currentHp,
      maxHp: this.maxHp,
      baseDamageReduction: this.baseDamageReduction,
      wallLevel: this.wallLevel,
      archerLevel: this.archerLevel,
      trapLevel: this.trapLevel,
      mageLevel: this.mageLevel,
      logTrapCount: this.logTrapCount
    };
  }

  private refreshHpBar(): void {
    const ratio = Phaser.Math.Clamp(this.currentHp / this.maxHp, 0, 1);
    this.hpBar.width = 250 * ratio;
    this.hpBar.fillColor = ratio > 0.45 ? 0x22c55e : ratio > 0.2 ? 0xf59e0b : 0xef4444;
    this.hpBack.setVisible(true);
  }

  private createPlayerArchers(): void {
    const count = Math.min(3, this.archerLevel);
    for (let i = 0; i < count; i += 1) {
      const x = 84;
      const y = 140 + i * 42;
      const maxHp = 20;
      const body = this.scene.add.circle(x, y, 8, 0xfef3c7).setStrokeStyle(2, 0x78350f);
      const label = this.scene.add.text(x, y - 4, 'A', { color: '#78350f', fontSize: '10px', fontStyle: 'bold' }).setOrigin(0.5);
      const hpBack = this.scene.add.rectangle(x, y + 13, 22, 4, 0x1f2937).setOrigin(0.5);
      const hpBar = this.scene.add.rectangle(x, y + 13, 22, 4, 0x22c55e).setOrigin(0.5);
      this.playerArchers.push({ x, y, hp: maxHp, maxHp, body, label, hpBack, hpBar });
    }
  }

  private refreshArcher(
    archer: PlayerArcherTarget & {
      body: Phaser.GameObjects.Arc;
      label: Phaser.GameObjects.Text;
      hpBack: Phaser.GameObjects.Rectangle;
      hpBar: Phaser.GameObjects.Rectangle;
    }
  ): void {
    const ratio = Phaser.Math.Clamp(archer.hp / archer.maxHp, 0, 1);
    archer.hpBar.width = 22 * ratio;
    archer.hpBar.x = archer.x - (22 - archer.hpBar.width) / 2;
    if (archer.hp <= 0) {
      archer.body.setFillStyle(0x6b7280);
      archer.body.setAlpha(0.35);
      archer.label.setAlpha(0.35);
      archer.hpBack.setVisible(false);
      archer.hpBar.setVisible(false);
    }
  }
}
