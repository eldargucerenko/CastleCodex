import Phaser from 'phaser';
import type { CastleProgress } from '../types/game';
import { LOGICAL_W, LOGICAL_H } from '../config/dimensions';
import { SoundBank } from '../systems/SoundBank';

export interface PlayerDefenderTarget {
  kind: 'archer' | 'mage';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export type PlayerArcherTarget = PlayerDefenderTarget;

export class Castle {
  readonly x = 0;
  readonly width = Math.round(LOGICAL_W * 0.2);
  readonly top = 240;
  readonly bottom: number;
  currentHp: number;
  maxHp: number;
  baseDamageReduction: number;
  wallLevel: number;
  archerLevel: number;
  trapLevel: number;
  mageLevel: number;
  logTrapCount: number;
  archerHp: number[];
  mageHp?: number;
  private body: Phaser.GameObjects.Rectangle;
  private playerArchers: Array<
    PlayerDefenderTarget & {
      body: Phaser.GameObjects.Arc | Phaser.GameObjects.Sprite;
      label: Phaser.GameObjects.Text;
      hpBack: Phaser.GameObjects.Rectangle;
      hpBar: Phaser.GameObjects.Rectangle;
      baseScale: number;
    }
  > = [];
  private playerMage?: PlayerDefenderTarget & {
    body: Phaser.GameObjects.Arc;
    label: Phaser.GameObjects.Text;
    hpBack: Phaser.GameObjects.Rectangle;
    hpBar: Phaser.GameObjects.Rectangle;
  };

  constructor(private scene: Phaser.Scene, progress: CastleProgress) {
    this.bottom = LOGICAL_H - 56;
    this.currentHp = progress.currentHp;
    this.maxHp = progress.maxHp;
    this.baseDamageReduction = progress.baseDamageReduction;
    this.wallLevel = progress.wallLevel;
    this.archerLevel = progress.archerLevel;
    this.trapLevel = progress.trapLevel;
    this.mageLevel = progress.mageLevel;
    this.logTrapCount = progress.logTrapCount;
    this.archerHp = progress.archerHp;
    this.mageHp = progress.mageHp;

    const height = this.bottom - this.top;
    this.body = scene.add.rectangle(this.width / 2, this.top + height / 2, this.width, height, 0x8b5e3c);
    this.body.setStrokeStyle(4, 0x4b2f1a);
    scene.add.rectangle(this.width / 2, this.top - 10, this.width - 18, 34, 0x9a6a45).setStrokeStyle(3, 0x4b2f1a);
    for (let x = 18; x < this.width; x += 34) {
      scene.add.rectangle(x, this.top - 36, 20, 32, 0x7a5234).setStrokeStyle(3, 0x4b2f1a);
    }
    scene.add.rectangle(this.width / 2, this.top + height * 0.44, this.width * 0.42, height * 0.46, 0x6f452b).setStrokeStyle(3, 0x4b2f1a);
    scene.add.circle(this.width / 2, this.top + height * 0.44, 18, 0x1f2937, 0.45);

    this.createPlayerArchers();
    this.createPlayerMage();
  }

  takeDamage(rawDamage: number): number {
    const damage = Math.max(1, Math.round(rawDamage * (1 - this.baseDamageReduction)));
    this.currentHp = Math.max(0, this.currentHp - damage);
    this.scene.cameras.main.shake(60, 0.0012);
    SoundBank.play(this.scene, 'castle_damage');
    return damage;
  }

  healFull(): void {
    this.currentHp = this.maxHp;
  }

  getLivingArcherTarget(): PlayerArcherTarget | undefined {
    return this.playerArchers.find((archer) => archer.hp > 0);
  }

  getLivingDefenderTarget(): PlayerDefenderTarget | undefined {
    const targets: PlayerDefenderTarget[] = this.playerArchers.filter((archer) => archer.hp > 0);
    if (this.playerMage && this.playerMage.hp > 0) {
      targets.push(this.playerMage);
    }
    return Phaser.Utils.Array.GetRandom(targets);
  }

  getLivingMageTarget(): PlayerDefenderTarget | undefined {
    return this.playerMage && this.playerMage.hp > 0 ? this.playerMage : undefined;
  }

  getLivingArcherCount(): number {
    return this.playerArchers.filter((archer) => archer.hp > 0).length;
  }

  // Play the firing archer's draw/release animation. When the multi-frame
  // shoot anim is available it gets played and snapped back to frame 0 on
  // complete; otherwise (legacy Arc body or static-image fallback) a quick
  // scale-yoyo serves as a stand-in shoot cue.
  animateArcherShot(target: PlayerArcherTarget): void {
    const entry = this.playerArchers.find((a) => a === target);
    if (!entry) return;
    const body = entry.body;
    if ('play' in body && this.scene.anims.exists('defender-archer-shoot-play')) {
      body.play('defender-archer-shoot-play');
      body.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        if (body.active) body.setFrame(0);
      });
      return;
    }
    // Fallback scale-yoyo for Arc body / non-anim sprite.
    this.scene.tweens.killTweensOf(body);
    body.setScale(entry.baseScale);
    const peak = entry.baseScale * 1.15;
    this.scene.tweens.add({
      targets: body,
      scaleX: peak, scaleY: peak,
      yoyo: true,
      duration: 90,
      ease: 'Quad.easeOut',
      onComplete: () => body.setScale(entry.baseScale)
    });
  }

  hasLivingMage(): boolean {
    return (this.playerMage?.hp ?? 0) > 0;
  }

  damageDefender(target: PlayerDefenderTarget, amount: number): void {
    const defender =
      target.kind === 'mage' ? (this.playerMage === target ? this.playerMage : undefined) : this.playerArchers.find((candidate) => candidate === target);
    if (!defender || defender.hp <= 0) return;
    defender.hp = Math.max(0, defender.hp - amount);
    this.refreshDefender(defender);
    this.scene.tweens.add({ targets: defender.body, scaleX: 1.25, scaleY: 1.25, yoyo: true, duration: 90 });
  }

  damageArcher(target: PlayerArcherTarget, amount: number): void {
    this.damageDefender(target, amount);
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
      logTrapCount: this.logTrapCount,
      archerHp: this.playerArchers.map((archer) => archer.hp),
      mageHp: this.playerMage?.hp
    };
  }

  private createPlayerArchers(): void {
    const count = Math.min(3, this.archerLevel);
    // Prefer the animated shoot strip: frame 0 = aiming idle pose, the full
    // 8-frame anim plays on each shot. Fall back to the static defender-
    // archer image, then to the legacy yellow circle.
    const useShootSprite = this.scene.textures.exists('defender-archer-shoot');
    const useStaticImage = !useShootSprite && this.scene.textures.exists('defender-archer');
    for (let i = 0; i < count; i += 1) {
      const x = this.width - 34;
      const y = this.top + 26 + i * 42;
      const maxHp = 20;
      const hp = Phaser.Math.Clamp(this.archerHp[i] ?? maxHp, 0, maxHp);
      // Defender body: chibi sprite when art is loaded, else yellow circle.
      // Sized to ~36px tall so 3 archers fit in the 42-px slot spacing.
      let body: Phaser.GameObjects.Arc | Phaser.GameObjects.Sprite;
      let label: Phaser.GameObjects.Text;
      if (useShootSprite) {
        // Source art faces left; flipX so the archer aims right at incoming
        // enemies. Sits on frame 0 (aiming pose) until ArcherSystem calls
        // animateArcherShot which plays the full draw/release anim.
        const spr = this.scene.add.sprite(x, y, 'defender-archer-shoot', 0).setDisplaySize(31, 36).setFlipX(true);
        body = spr;
        label = this.scene.add.text(x, y - 4, '', { fontSize: '1px' }).setOrigin(0.5).setVisible(false);
      } else if (useStaticImage) {
        // Legacy path: pre-flipped static PNG, no setFlipX needed.
        const spr = this.scene.add.sprite(x, y, 'defender-archer').setDisplaySize(31, 36);
        body = spr;
        label = this.scene.add.text(x, y - 4, '', { fontSize: '1px' }).setOrigin(0.5).setVisible(false);
      } else {
        body = this.scene.add.circle(x, y, 8, 0xfef3c7).setStrokeStyle(2, 0x78350f);
        label = this.scene.add.text(x, y - 4, 'A', { color: '#78350f', fontSize: '10px', fontStyle: 'bold' }).setOrigin(0.5);
      }
      const hpBack = this.scene.add.rectangle(x, y + 13, 22, 4, 0x1f2937).setOrigin(0.5);
      const hpBar = this.scene.add.rectangle(x, y + 13, 22, 4, 0x22c55e).setOrigin(0.5);
      // Capture base scale AFTER setDisplaySize/circle so the recoil tween
      // can yoyo around it without sending the figure back to its native
      // 128x128 source size.
      const baseScale = body.scaleX;
      const archer = { kind: 'archer' as const, x, y, hp, maxHp, body, label, hpBack, hpBar, baseScale };
      this.playerArchers.push(archer);
      this.refreshDefender(archer);
    }
  }

  private createPlayerMage(): void {
    if (this.mageLevel <= 0) return;
    const x = this.width / 2;
    const y = this.top - 54;
    const maxHp = 32;
    const hp = Phaser.Math.Clamp(this.mageHp ?? maxHp, 0, maxHp);
    const body = this.scene.add.circle(x, y, 14, 0x60a5fa).setStrokeStyle(2, 0x1e3a8a);
    const label = this.scene.add.text(x, y - 3, 'M', { color: '#eff6ff', fontSize: '12px', fontStyle: 'bold' }).setOrigin(0.5);
    const hpBack = this.scene.add.rectangle(x, y + 18, 28, 4, 0x1f2937).setOrigin(0.5);
    const hpBar = this.scene.add.rectangle(x, y + 18, 28, 4, 0x22c55e).setOrigin(0.5);
    this.playerMage = { kind: 'mage', x, y, hp, maxHp, body, label, hpBack, hpBar };
    this.refreshDefender(this.playerMage);
  }

  private refreshDefender(
    defender: PlayerDefenderTarget & {
      body: Phaser.GameObjects.Arc | Phaser.GameObjects.Sprite;
      label: Phaser.GameObjects.Text;
      hpBack: Phaser.GameObjects.Rectangle;
      hpBar: Phaser.GameObjects.Rectangle;
    }
  ): void {
    const maxWidth = defender.kind === 'mage' ? 28 : 22;
    const ratio = Phaser.Math.Clamp(defender.hp / defender.maxHp, 0, 1);
    defender.hpBar.width = maxWidth * ratio;
    defender.hpBar.x = defender.x - (maxWidth - defender.hpBar.width) / 2;
    if (defender.hp <= 0) {
      // Arc supports setFillStyle (legacy circle defender); Image does not.
      // Alpha drop alone reads as "down" for the sprite-bodied archer.
      if ('setFillStyle' in defender.body) defender.body.setFillStyle(0x6b7280);
      defender.body.setAlpha(0.35);
      defender.label.setAlpha(0.35);
      defender.hpBack.setVisible(false);
      defender.hpBar.setVisible(false);
    }
  }
}
