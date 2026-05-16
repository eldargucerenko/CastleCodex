import Phaser from 'phaser';
import { ENEMY_STATS } from '../data/enemies';
import { DebugCheatSystem } from '../systems/DebugCheatSystem';
import { SoundBank } from '../systems/SoundBank';
import type { EnemyKind, EnemyState, EnemyStats, WizardState } from '../types/game';
import type { Castle } from './Castle';
import { LOGICAL_W, LOGICAL_H } from '../config/dimensions';

// Animated walk-cycle key per enemy kind. Animations are created in
// BootScene from the `*_walk_strip.png` sprite sheets (8 frames at
// 256x256 each). Wizard variants share the base wizard walk.
const ANIMATED_BY_KIND: Partial<Record<EnemyKind, string>> = {
  basic: 'enemy-knight-walk',
  archer: 'enemy-archer-walk',
  bomber: 'enemy-bomber-walk',
  jumper: 'enemy-jumper-walk',
  raider: 'enemy-raider-walk',
  fat: 'enemy-heavy-knight-walk',
  trunk: 'enemy-log-thrower-walk',
  wizard: 'enemy-wizard-walk',
  wizard_easy: 'enemy-wizard-walk',
  wizard_medium: 'enemy-wizard-walk',
  wizard_hard: 'enemy-wizard-walk',
  cursor_mage: 'enemy-wizard-walk'
};

// Per-kind animation extras for state-driven anim swaps + attack strikes.
// The base prefix matches ANIMATED_BY_KIND (drop the trailing -walk).
interface AnimExtras {
  air?: string;
  getup?: string;
  hurt?: string;
  strikes?: string[];
}
const EXTRAS_BY_KIND: Partial<Record<EnemyKind, AnimExtras>> = {
  basic: {
    air: 'enemy-knight-air', getup: 'enemy-knight-getup', hurt: 'enemy-knight-hurt',
    strikes: ['enemy-knight-strike1', 'enemy-knight-strike2']
  },
  archer: {
    air: 'enemy-archer-air', getup: 'enemy-archer-getup', hurt: 'enemy-archer-hurt',
    strikes: ['enemy-archer-strike2']
  },
  bomber: {
    air: 'enemy-bomber-air', getup: 'enemy-bomber-getup', hurt: 'enemy-bomber-hurt',
    strikes: ['enemy-bomber-strike1']
  },
  raider: {
    air: 'enemy-raider-air', getup: 'enemy-raider-getup', hurt: 'enemy-raider-hurt',
    strikes: ['enemy-raider-strike1', 'enemy-raider-strike2']
  },
  jumper: {
    air: 'enemy-jumper-air', getup: 'enemy-jumper-getup', hurt: 'enemy-jumper-hurt',
    strikes: ['enemy-jumper-strike1', 'enemy-jumper-strike2']
  },
  fat: {
    air: 'enemy-heavy-knight-air', getup: 'enemy-heavy-knight-getup', hurt: 'enemy-heavy-knight-hurt',
    strikes: ['enemy-heavy-knight-strike1', 'enemy-heavy-knight-strike2']
  },
  trunk: {
    air: 'enemy-log-thrower-air', getup: 'enemy-log-thrower-getup', hurt: 'enemy-log-thrower-hurt',
    strikes: ['enemy-log-thrower-strike1', 'enemy-log-thrower-strike2']
  },
  // Wizards only ever fire the strike1 cast anim from their projectile tick;
  // strike2 was dead art so it's dropped from the pool entirely.
  wizard: {
    air: 'enemy-wizard-air', getup: 'enemy-wizard-getup', hurt: 'enemy-wizard-hurt',
    strikes: ['enemy-wizard-strike1']
  },
  wizard_easy:   { air: 'enemy-wizard-air', getup: 'enemy-wizard-getup', hurt: 'enemy-wizard-hurt', strikes: ['enemy-wizard-strike1'] },
  wizard_medium: { air: 'enemy-wizard-air', getup: 'enemy-wizard-getup', hurt: 'enemy-wizard-hurt', strikes: ['enemy-wizard-strike1'] },
  wizard_hard:   { air: 'enemy-wizard-air', getup: 'enemy-wizard-getup', hurt: 'enemy-wizard-hurt', strikes: ['enemy-wizard-strike1'] },
  cursor_mage:   { air: 'enemy-wizard-air', getup: 'enemy-wizard-getup', hurt: 'enemy-wizard-hurt', strikes: ['enemy-wizard-strike1'] }
};

export class Enemy extends Phaser.GameObjects.Container {
  readonly stats: EnemyStats;
  readonly kind: EnemyKind;
  hp: number;
  state: EnemyState = 'Spawn';
  wizardState?: WizardState;
  isSlowedUntil = 0;
  vx = 0;
  vy = 0;
  lastAttackAt = 0;
  isGrabbed = false;
  justDied = false;
  walkPaused = false;
  readonly groundY: number;
  protected shape: Phaser.GameObjects.Graphics;
  protected labelText: Phaser.GameObjects.Text;
  protected chibiSprite?: Phaser.GameObjects.Sprite;
  protected chibiAnimKey?: string;
  // Display half-extents of the figure (walk anim bbox), in container-local
  // coords. containsPoint uses these instead of `radius` so the hit area
  // matches the visible figure. Unset for kinds without a chibi sprite.
  protected figHalfW?: number;
  protected figHalfH?: number;
  protected figCenterY?: number;
  // Container-local offset of the grab pixel relative to container origin,
  // captured at grab() time. followPointer uses it (scaled by the grab pop)
  // so the exact pixel the player clicked stays under the cursor.
  protected grabOffsetX?: number;
  protected grabOffsetY?: number;
  // Chibi texture key seen on the last followPointer tick, used to detect
  // anim swaps mid-grab so we can re-anchor the offset to the new figure
  // center (otherwise heavy_knight's air anim, whose figure sits ~90 px
  // higher than walk's, would shoot up out of the cursor when grabbed).
  protected lastGrabChibiTex?: string;
  // Chibi sprite's display scale captured at creation. Used by
  // figCenterYForTex so the re-anchor math doesn't get thrown off if
  // anything ever tweens the sprite's local scaleY directly.
  protected chibiBaseScale?: number;
  protected statusText: Phaser.GameObjects.Text;
  protected hpBar: Phaser.GameObjects.Rectangle;
  protected hpBack: Phaser.GameObjects.Rectangle;
  protected groundShadow: Phaser.GameObjects.Ellipse;
  protected lastWalkX = 0;
  protected lastWalkY = 0;
  protected oneShotPlaying = false;
  protected oneShotCompleteHandler?: () => void;
  protected groundedThisFlight = false;
  protected prevStateForAnims: EnemyState = 'Spawn';

  constructor(scene: Phaser.Scene, x: number, y: number, kind: EnemyKind, groundY?: number) {
    super(scene, x, y);
    this.kind = kind;
    this.stats = DebugCheatSystem.applyTo(ENEMY_STATS[kind]);
    this.hp = this.stats.hp;
    this.groundY = groundY ?? LOGICAL_H - 72;

    // Procedural ground shadow lives outside the container so it stays at
    // groundY when the enemy is launched into the air. Its alpha and size
    // ease as the enemy gains altitude (drawn via updateGroundShadow).
    const shadowW = this.stats.radius * 2.6;
    const shadowH = Math.max(4, this.stats.radius * 0.7);
    this.groundShadow = scene.add
      .ellipse(x, this.groundY - 2, shadowW, shadowH, 0x000000, 0.32)
      .setDepth(2);

    this.shape = scene.add.graphics();
    this.labelText = scene.add.text(0, 0, this.stats.label, { color: '#ffffff', fontSize: '12px', fontStyle: 'bold' }).setOrigin(0.5);
    this.statusText = scene.add.text(0, -this.stats.radius - 26, '', { color: '#111827', fontSize: '12px', fontStyle: 'bold' }).setOrigin(0.5);
    this.hpBack = scene.add.rectangle(0, -this.stats.radius - 11, this.stats.radius * 2, 4, 0x111827).setOrigin(0.5);
    this.hpBar = scene.add.rectangle(0, -this.stats.radius - 11, this.stats.radius * 2, 4, 0x22c55e).setOrigin(0.5);
    this.add([this.shape, this.labelText, this.statusText, this.hpBack, this.hpBar]);
    scene.add.existing(this);
    this.setDepth(10);
    this.setSize(this.stats.radius * 2, this.stats.radius * 2);
    this.state = 'WalkToCastle';
    this.draw();
    this.refreshDepth();
    this.maybeAttachChibiSprite();
  }

  // Swap the colored-circle primitive for the chibi sprite if a texture for
  // this kind has been loaded. For the basic knight we use the animated walk
  // sheet (when available) and fall back to the static knight.png otherwise.
  // Sprite scales so its height matches roughly 4x the gameplay radius, then
  // flips horizontally because the source art faces right but enemies walk
  // leftward toward the castle.
  private maybeAttachChibiSprite(): void {
    const animKey = ANIMATED_BY_KIND[this.kind];
    if (!animKey || !this.scene.anims.exists(animKey)) return;
    this.shape.setVisible(false);
    this.labelText.setVisible(false);
    // Source frames are 256x256 but the figure inside fills wildly different
    // portions per kind (knight walk ~138 tall, archer walk ~226 tall). If we
    // scaled by the frame, the figure ends up at very different sizes. Read
    // frame 0's opaque bbox once per spritesheet and scale by the FIGURE's
    // height so radius * 4.2 = figure height across all kinds. Origin moves
    // to the figure center so the figure lands at the same container offset.
    const FRAME = 256;
    const bbox = Enemy.getFigureBbox(this.scene, animKey, FRAME);
    const targetH = this.stats.radius * 4.2;
    const scale = targetH / bbox.h;
    const sprite = this.scene.add.sprite(0, -this.stats.radius * 0.6, animKey);
    sprite.setOrigin((bbox.x + bbox.w / 2) / FRAME, (bbox.y + bbox.h / 2) / FRAME);
    sprite.setScale(scale);
    sprite.setFlipX(true);
    sprite.play(animKey);
    this.chibiSprite = sprite;
    this.chibiAnimKey = animKey;
    this.chibiBaseScale = scale;
    // Cache the figure's display half-extents + y-offset so containsPoint
    // can hit-test the visible figure instead of a circle on `radius`.
    this.figHalfW = (bbox.w / 2) * scale;
    this.figHalfH = (bbox.h / 2) * scale;
    this.figCenterY = -this.stats.radius * 0.6;
    this.addAt(sprite, 0);
  }

  // Cache of figure-bbox per spritesheet texture, computed lazily on first
  // sight. Reads pixel data from frame 0 of the strip and finds the opaque
  // bbox so the renderer can scale by the figure size, not the frame size.
  private static figureBboxCache = new Map<string, { x: number; y: number; w: number; h: number }>();

  private static getFigureBbox(scene: Phaser.Scene, textureKey: string, frame: number): { x: number; y: number; w: number; h: number } {
    const cached = Enemy.figureBboxCache.get(textureKey);
    if (cached) return cached;
    const fallback = { x: 0, y: 0, w: frame, h: frame };
    try {
      const tex = scene.textures.get(textureKey);
      const src = tex.getSourceImage(0) as CanvasImageSource;
      if (!src) { Enemy.figureBboxCache.set(textureKey, fallback); return fallback; }
      const canvas = document.createElement('canvas');
      canvas.width = frame;
      canvas.height = frame;
      const ctx = canvas.getContext('2d');
      if (!ctx) { Enemy.figureBboxCache.set(textureKey, fallback); return fallback; }
      ctx.drawImage(src, 0, 0, frame, frame, 0, 0, frame, frame);
      const data = ctx.getImageData(0, 0, frame, frame).data;
      let minX = frame, minY = frame, maxX = 0, maxY = 0;
      for (let y = 0; y < frame; y++) {
        const row = y * frame * 4;
        for (let x = 0; x < frame; x++) {
          if (data[row + x * 4 + 3] > 40) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
      // maxX/Y stay below minX/Y if NO opaque pixel was found (initial
       // sentinels). Otherwise inclusive span = maxX - minX + 1 etc.
      const bbox = maxX >= minX && maxY >= minY
        ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
        : fallback;
      Enemy.figureBboxCache.set(textureKey, bbox);
      return bbox;
    } catch {
      Enemy.figureBboxCache.set(textureKey, fallback);
      return fallback;
    }
  }

  // Resume the walk animation when the enemy is actually moving and freeze
  // on frame 0 when stopped. Driven by position-delta so that subclasses that
  // override updateEnemy without delegating (Archer, Jumper, Bomber, ...)
  // still freeze correctly when their state stops moving them.
  updateWalkAnimation(): void {
    if (!this.chibiSprite || !this.chibiAnimKey) return;
    // Defer to one-shot / state-driven anims while they're playing.
    const currentKey = this.chibiSprite.anims.currentAnim?.key;
    if (this.oneShotPlaying || (currentKey && currentKey !== this.chibiAnimKey && this.chibiSprite.anims.isPlaying)) {
      // Still update last-pos so we don't "jump" when the override ends.
      this.lastWalkX = this.x;
      this.lastWalkY = this.y;
      return;
    }
    const dx = this.x - this.lastWalkX;
    const dy = this.y - this.lastWalkY;
    this.lastWalkX = this.x;
    this.lastWalkY = this.y;
    // 0.05 px/frame threshold filters out subpixel jitter while still
    // catching slow walks. Dead/grabbed/flying always counts as not walking.
    // Anything 12 px or more above ground level is "in the air" -- jumper
    // mid-arc, fat-thrown knight, anything launched. Walk cycle should freeze.
    const altitude = (this.groundY - this.stats.radius) - this.y;
    const stationary =
      this.state === 'Dead' ||
      this.state === 'Grabbed' ||
      this.state === 'Flying' ||
      this.state === 'Stunned' ||
      this.walkPaused ||
      this.isGrabbed ||
      altitude > 12;
    const moving = !stationary && Math.abs(dx) > 0.05;
    const isPlaying = this.chibiSprite.anims.isPlaying;
    const onWalkSheet = this.chibiSprite.texture.key === this.chibiAnimKey;
    if (moving && !isPlaying) {
      this.chibiSprite.play(this.chibiAnimKey);
    } else if (!moving && isPlaying) {
      this.chibiSprite.anims.stop();
      this.chibiSprite.setFrame(0);
    } else if (!moving && !isPlaying && !onWalkSheet) {
      // A one-shot anim (strike / hurt / getup) just ended -- the sprite is
      // sitting on the last frame of THAT sheet, so it visibly stays in a
      // strike pose (and inherits whatever mirror direction the anim's
      // source art had) until the enemy moves again. Snap back to the walk
      // sheet's first frame so the enemy returns to its idle pose.
      this.chibiSprite.setTexture(this.chibiAnimKey, 0);
    }
  }

  // Drop any pending one-shot completion handler so it can't fire later
  // against an unrelated animation and prematurely flip oneShotPlaying off.
  private clearOneShotHandler(): void {
    if (this.chibiSprite && this.oneShotCompleteHandler) {
      this.chibiSprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.oneShotCompleteHandler);
    }
    this.oneShotCompleteHandler = undefined;
  }

  // Play a one-shot animation on the chibi sprite (strike, hurt, getup).
  // updateWalkAnimation defers while it's playing; on completion the walk
  // anim resumes automatically next tick.
  protected playOneShotAnim(animKey: string): void {
    if (!this.chibiSprite || !this.scene.anims.exists(animKey)) return;
    this.clearOneShotHandler();
    this.oneShotPlaying = true;
    this.chibiSprite.play({ key: animKey, repeat: 0 });
    const handler = () => {
      this.oneShotPlaying = false;
      this.oneShotCompleteHandler = undefined;
    };
    this.oneShotCompleteHandler = handler;
    this.chibiSprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, handler);
  }

  // Switch the persistent looping animation (e.g. swap walk for an "in air"
  // panic loop while flying). Stays playing until something else replaces it.
  protected playLoopAnim(animKey: string): void {
    if (!this.chibiSprite || !this.scene.anims.exists(animKey)) return;
    this.clearOneShotHandler();
    this.oneShotPlaying = false;
    this.chibiSprite.play(animKey);
  }

  // Hard cancel whatever's playing and freeze on a neutral idle frame.
  // Used when the enemy enters a state we don't have art for (Dead) --
  // otherwise the previous strike / walk would keep playing.
  protected cancelChibiAnim(): void {
    if (!this.chibiSprite) return;
    this.clearOneShotHandler();
    this.oneShotPlaying = false;
    this.chibiSprite.anims.stop();
    this.chibiSprite.setFrame(0);
  }

  get canBeGrabbed(): boolean {
    if (this.state === 'Dead' || this.state === 'Grabbed') return false;
    if (this.kind.startsWith('wizard') && (this.wizardState === 'Shielded' || this.wizardState === 'Unlocking')) return false;
    return true;
  }

  get alive(): boolean {
    return this.state !== 'Dead';
  }

  containsPoint(x: number, y: number): boolean {
    // Prefer the visible-figure rect (walk anim bbox) so the grab area
    // matches what the player sees. Half-extent multiplier inflates each
    // side, so 1.05 = 10% wider/taller total. Falls back to the legacy
    // radius circle for kinds without a chibi sprite (no figure metrics).
    if (this.figHalfW !== undefined && this.figHalfH !== undefined && this.figCenterY !== undefined) {
      const halfExtentMul = 1.05;
      const cx = this.x;
      const cy = this.y + this.figCenterY;
      return Math.abs(x - cx) <= this.figHalfW * halfExtentMul
          && Math.abs(y - cy) <= this.figHalfH * halfExtentMul;
    }
    return Phaser.Math.Distance.Between(this.x, this.y, x, y) <= this.stats.radius + 12;
  }

  grab(clickWorldX?: number, clickWorldY?: number): void {
    this.isGrabbed = true;
    this.state = 'Grabbed';
    this.vx = 0;
    this.vy = 0;
    // Lock the grab pixel under the cursor: store the click offset relative
    // to the container origin (unscaled). If no click point was passed,
    // fall back to (0, 0) which puts the container origin on the cursor.
    this.grabOffsetX = clickWorldX !== undefined ? clickWorldX - this.x : 0;
    this.grabOffsetY = clickWorldY !== undefined ? clickWorldY - this.y : 0;
    // Snapshot the anim playing at grab time so the next followPointer
    // tick can detect if updateStateAnimations has swapped to air panic.
    this.lastGrabChibiTex = this.chibiSprite?.texture.key;
    // Smaller pop for already-big figures (heavy_knight, raider) so they
    // don't balloon awkwardly; full 12% for smaller ones where the pop
    // reads as satisfying juice.
    const pop = (this.figHalfH ?? 0) > 35 ? 1.06 : 1.12;
    this.setScale(pop);
    this.setDepth(50);
    this.draw();
  }

  followPointer(x: number, y: number): void {
    // Re-anchor when the chibi swaps anim mid-grab (walk -> air panic): the
    // figure-center container-local Y differs per texture, so shift
    // grabOffsetY by the difference to keep the cursor on the figure.
    const curTex = this.chibiSprite?.texture.key;
    if (curTex && this.lastGrabChibiTex && curTex !== this.lastGrabChibiTex) {
      const oldFigCY = this.figCenterYForTex(this.lastGrabChibiTex);
      const newFigCY = this.figCenterYForTex(curTex);
      this.grabOffsetY = (this.grabOffsetY ?? 0) + (newFigCY - oldFigCY);
      this.lastGrabChibiTex = curTex;
    }
    // Keep the exact pixel the player grabbed under the cursor: at grab time
    // we stored (clickWorld - containerOrigin) in container-local UNSCALED
    // coords. The grab pop scales the container, so multiply by scaleX/Y to
    // get the equivalent world delta now.
    const offsetX = (this.grabOffsetX ?? 0) * this.scaleX;
    const offsetY = (this.grabOffsetY ?? 0) * this.scaleY;
    const targetX = x - offsetX;
    const targetY = y - offsetY;
    const liftPenalty = targetY < this.y ? 0.68 / this.stats.mass : 1;
    const follow = this.stats.dragFollow;
    this.x += (targetX - this.x) * follow;
    this.y += (targetY - this.y) * follow * liftPenalty;
  }

  private figCenterYForTex(texKey: string): number {
    if (!this.chibiSprite) return this.figCenterY ?? 0;
    if (texKey === this.chibiAnimKey) return this.figCenterY ?? 0;
    const bbox = Enemy.getFigureBbox(this.scene, texKey, 256);
    const figCy = bbox.y + bbox.h / 2;
    const originPxY = this.chibiSprite.originY * 256;
    const scale = this.chibiBaseScale ?? this.chibiSprite.scaleY;
    return this.chibiSprite.y + (figCy - originPxY) * scale;
  }

  release(vx: number, vy: number): void {
    this.isGrabbed = false;
    const scaledVx = vx * this.stats.throwMultiplier;
    const scaledVy = vy * this.stats.throwMultiplier;
    const speed = Math.sqrt(scaledVx * scaledVx + scaledVy * scaledVy);
    const maxThrowSpeed = 780 / Math.sqrt(this.stats.mass);
    const clamp = speed > maxThrowSpeed ? maxThrowSpeed / speed : 1;
    this.launch(scaledVx * clamp, scaledVy * clamp);
  }

  launch(vx: number, vy: number): void {
    this.isGrabbed = false;
    this.state = 'Flying';
    this.vx = vx;
    this.vy = vy;
    // Reset so the next ground touch fires onGroundHit again -- otherwise
    // a re-thrown enemy would never re-trigger its landing animation.
    this.groundedThisFlight = false;
    this.setScale(1);
    this.setDepth(10);
    this.refreshDepth();
    this.scene.tweens.add({
      targets: this,
      alpha: 0.6,
      duration: 80,
      yoyo: true,
      repeat: 1
    });
  }

  // Hook fired once the first time this enemy touches ground while Flying.
  // Default plays the kind's getup anim if one exists.
  protected onGroundHit(_impactSpeed: number): void {
    const extras = EXTRAS_BY_KIND[this.kind];
    if (extras?.getup) this.playOneShotAnim(extras.getup);
  }

  // Public so subclasses can call from their attack/shoot ticks. Picks a
  // random strike variant if multiple are configured for this kind.
  triggerStrike(): void {
    const strikes = EXTRAS_BY_KIND[this.kind]?.strikes;
    if (!strikes || strikes.length === 0) return;
    const key = strikes[Math.floor(Math.random() * strikes.length)];
    this.playOneShotAnim(key);
  }

  // Called from GameScene each tick after updateEnemy. Reads the kind's
  // EXTRAS map and swaps anims when state transitions warrant it.
  updateStateAnimations(): void {
    const extras = EXTRAS_BY_KIND[this.kind];
    if (!extras) return;
    if (this.state !== this.prevStateForAnims) {
      if ((this.state === 'Flying' || this.state === 'Grabbed') && extras.air) {
        this.playLoopAnim(extras.air);
      } else if (this.state === 'Dead') {
        this.cancelChibiAnim();
      } else if (
        (this.state === 'WalkToCastle' || this.state === 'AttackCastle' || this.state === 'WalkToRange' || this.state === 'ShootCastle') &&
        this.prevStateForAnims !== 'WalkToCastle' &&
        this.prevStateForAnims !== 'AttackCastle' &&
        this.prevStateForAnims !== 'WalkToRange' &&
        this.prevStateForAnims !== 'ShootCastle' &&
        this.chibiAnimKey
      ) {
        this.playLoopAnim(this.chibiAnimKey);
      }
      this.prevStateForAnims = this.state;
    }
  }

  takeDamage(amount: number): boolean {
    if (this.state === 'Dead') return false;
    this.hp -= amount;
    this.scene.tweens.add({ targets: this, scaleX: 1.18, scaleY: 1.18, yoyo: true, duration: 70 });
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    this.draw();
    // Hurt anim (skipped while in air -- the air panic loop already reads
    // as "I'm getting hit"). Each kind opts in via EXTRAS_BY_KIND.
    if (this.state !== 'Flying' && this.state !== 'Stunned') {
      const extras = EXTRAS_BY_KIND[this.kind];
      if (extras?.hurt) this.playOneShotAnim(extras.hurt);
    }
    return false;
  }

  die(): void {
    if (this.state === 'Dead') return;
    this.state = 'Dead';
    this.justDied = true;
    this.visible = false;
    this.active = false;
    this.groundShadow.setVisible(false);
    SoundBank.play(this.scene, 'death');
  }

  // The ground shadow lives outside the container so we have to clean it up
  // explicitly when the Enemy is destroyed by GameScene.collectDeadEnemies.
  override destroy(fromScene?: boolean): void {
    this.groundShadow.destroy();
    super.destroy(fromScene);
  }

  // Update the procedural ground shadow: anchor x to the enemy, keep y at
  // groundY, and shrink + fade as altitude increases so a thrown knight
  // visually "drifts up" while a small landing dot stays on the ground.
  updateGroundShadow(): void {
    if (!this.groundShadow.visible) return;
    this.groundShadow.x = this.x;
    this.groundShadow.y = this.groundY - 2;
    const altitude = Math.max(0, this.groundY - this.stats.radius - this.y);
    const heightFactor = Math.min(1, altitude / 220);
    const scale = 1 - 0.5 * heightFactor;
    this.groundShadow.setScale(scale);
    this.groundShadow.setAlpha(0.32 * (1 - 0.6 * heightFactor));
  }

  updateEnemy(time: number, delta: number, castle: Castle, _enemies: Enemy[] = []): void {
    // updateWalkAnimation + updateGroundShadow are driven by GameScene.update
    // after this call so position-delta detection sees this frame's movement.
    if (this.state === 'Dead' || this.state === 'Grabbed') return;
    if (this.state === 'Flying' || this.state === 'Stunned') {
      this.updateFlying(delta, castle);
      return;
    }

    const attackX = castle.width + this.stats.radius + 4;
    if (this.x <= attackX) {
      this.state = 'AttackCastle';
      this.vx = 0;
      if (time - this.lastAttackAt > this.stats.attackRateMs) {
        this.lastAttackAt = time;
        castle.takeDamage(this.stats.attackDamage);
        this.triggerStrike();
      }
      return;
    }

    this.state = 'WalkToCastle';
    if (this.walkPaused) {
      this.refreshDepth();
      return;
    }
    const slow = time < this.isSlowedUntil ? 0.45 : 1;
    this.x -= this.stats.speed * slow * (delta / 1000);
    this.refreshDepth();
  }

  protected updateFlying(delta: number, castle: Castle): void {
    const dt = delta / 1000;
    this.vy += 900 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.refreshDepth();

    if (this.y < -20) {
      const frameScale = delta / 16.666;
      this.vx *= Math.pow(0.88, frameScale);
      if (this.vy < 0) {
        this.vy *= Math.pow(0.72, frameScale);
      }
    }

    // Total speed at moment of contact -- used by every wall/floor branch
    // so a horizontal slam into the castle deals damage just like a
    // vertical drop does. Threshold scales with mass.
    const impactThreshold = 520 + this.stats.mass * 55;

    const castleWallX = castle.width + this.stats.radius + 2;
    if (this.x < castleWallX) {
      this.x = castleWallX;
      const wallSpeed = Math.abs(this.vx) + Math.abs(this.vy);
      this.vx = Math.abs(this.vx) * 0.42;
      if (wallSpeed > impactThreshold) {
        const damage = Math.round((wallSpeed - impactThreshold) * this.stats.collisionDamageFactor);
        if (damage > 0) this.takeDamage(damage);
        this.scene.cameras.main.shake(80, 0.0014);
        this.spawnImpact();
        // Skip the impact thud if the impact also killed the enemy --
        // the death SFX is about to play and stacking both reads as mud.
        if (this.state !== 'Dead') SoundBank.play(this.scene, 'fall');
      }
    }

    const rightWallX = LOGICAL_W - this.stats.radius - 4;
    if (this.x > rightWallX) {
      this.x = rightWallX;
      const wallSpeed = Math.abs(this.vx) + Math.abs(this.vy);
      this.vx = -Math.abs(this.vx) * 0.42;
      if (wallSpeed > impactThreshold) {
        const damage = Math.round((wallSpeed - impactThreshold) * this.stats.collisionDamageFactor);
        if (damage > 0) this.takeDamage(damage);
        this.scene.cameras.main.shake(60, 0.0012);
        this.spawnImpact();
        if (this.state !== 'Dead') SoundBank.play(this.scene, 'fall');
      }
    }

    if (this.y >= this.groundY - this.stats.radius) {
      this.y = this.groundY - this.stats.radius;
      // Combine vy with a fraction of vx so a fast skidding belly-flop
      // hurts roughly as much as a hard vertical drop.
      const impactSpeed = Math.abs(this.vy) + Math.abs(this.vx) * 0.6;
      if (impactSpeed > impactThreshold) {
        const damage = Math.round((impactSpeed - impactThreshold) * this.stats.collisionDamageFactor);
        this.takeDamage(damage);
        this.scene.cameras.main.shake(Math.min(160, impactSpeed / 6), Math.min(0.0035, impactSpeed / 200000));
        this.spawnImpact();
        if (this.state !== 'Dead') SoundBank.play(this.scene, 'fall');
      }
      if (!this.groundedThisFlight) {
        this.groundedThisFlight = true;
        this.onGroundHit(impactSpeed);
      }
      this.vy *= -0.34;
      this.vx *= 0.72;
      if (Math.abs(this.vy) < 80 && Math.abs(this.vx) < 35) {
        this.state = 'Stunned';
        this.scene.time.delayedCall(520, () => {
          if (this.state === 'Stunned') this.state = 'WalkToCastle';
        });
      }
    }

    if (this.y > LOGICAL_H + 180) {
      this.die();
    }
  }

  protected spawnImpact(): void {
    const ring = this.scene.add.circle(this.x, this.groundY, 4, 0xffffff, 0.45).setDepth(3);
    this.scene.tweens.add({
      targets: ring,
      radius: 32,
      alpha: 0,
      duration: 220,
      onComplete: () => ring.destroy()
    });
  }

  protected refreshDepth(): void {
    if (this.state === 'Grabbed') return;
    this.setDepth(10 + this.y / 10);
  }

  protected draw(extraColor?: number): void {
    this.shape.clear();
    const radius = this.stats.radius;
    const color = extraColor ?? this.stats.color;
    this.shape.lineStyle(3, 0x111827, 1);
    this.shape.fillStyle(color, 1);
    this.shape.fillCircle(0, 0, radius);
    this.shape.lineBetween(-radius * 0.65, radius * 0.9, -radius * 0.25, radius * 1.7);
    this.shape.lineBetween(radius * 0.65, radius * 0.9, radius * 0.25, radius * 1.7);
    this.shape.lineBetween(-radius * 0.9, radius * 0.1, -radius * 1.35, radius * 0.8);
    this.shape.lineBetween(radius * 0.9, radius * 0.1, radius * 1.35, radius * 0.8);
    this.hpBar.width = Math.max(0, (this.hp / this.stats.hp) * this.stats.radius * 2);
    this.hpBar.x = -(this.stats.radius - this.hpBar.width / 2);
  }
}
