import Phaser from 'phaser';
import type { Castle } from '../entities/Castle';
import type { Enemy } from '../entities/Enemy';
import { WizardEnemy } from '../entities/WizardEnemy';
import { CURSOR_CLOSED, CURSOR_OPEN } from '../config/cursors';
import { CursorDebuff } from './CursorDebuff';
import { SoundBank } from './SoundBank';

interface PointerSample {
  x: number;
  y: number;
  time: number;
}

// Below this hold time, treat the press+release as a tap and skip the
// throw whoosh -- the grab blip already covered the click and a second
// SFX firing 50ms later just sounds noisy.
const TAP_VS_THROW_MS = 150;

export class DragThrowSystem {
  private grabbed?: Enemy;
  private samples: PointerSample[] = [];
  private grabbedAt = 0;

  constructor(
    private scene: Phaser.Scene,
    private castle: Castle,
    private getEnemies: () => Enemy[]
  ) {
    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.on('pointerupoutside', this.onPointerUp, this);
    // 'gameout' fires when the pointer leaves the canvas while still pressed.
    // Phaser stops sending pointermove events past the edge, so without this
    // a grabbed enemy would freeze in place; release it as if the user had
    // let go right at the border.
    scene.input.on('gameout', this.onGameOut, this);
    // Per-frame follow tick: pointermove events only fire when the OS sends
    // a new sample (60-120Hz, capped by mouse polling). Between events the
    // enemy needs to keep lerping toward the last pointer position or it
    // visibly trails behind on fast drags. This re-applies followPointer
    // every render frame using the always-up-to-date activePointer worldX/Y.
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onSceneUpdate, this);
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('pointerupoutside', this.onPointerUp, this);
    this.scene.input.off('gameout', this.onGameOut, this);
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onSceneUpdate, this);
  }

  private onSceneUpdate(): void {
    if (!this.grabbed) return;
    const p = this.scene.input.activePointer;
    this.grabbed.followPointer(p.worldX, p.worldY);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    // CursorDebuff (cast by CursorMage) blocks all grab input for its
    // duration. Wizard rune clicks still pass through -- they're a
    // separate interaction than the drag-throw.
    if (CursorDebuff.isActive(this.scene.time.now)) {
      const runeWizard = this.findWizardRuneTarget(pointer.worldX, pointer.worldY);
      if (runeWizard) runeWizard.tryRuneClick(pointer.worldX, pointer.worldY);
      return;
    }

    const runeWizard = this.findWizardRuneTarget(pointer.worldX, pointer.worldY);
    if (runeWizard) {
      runeWizard.tryRuneClick(pointer.worldX, pointer.worldY);
      return;
    }

    const enemy = this.findTopEnemy(pointer.worldX, pointer.worldY);
    if (!enemy) return;

    if (enemy instanceof WizardEnemy && enemy.isCastingShield()) {
      enemy.interruptShieldCast();
      enemy.grab();
      this.grabbed = enemy;
      this.samples = [{ x: pointer.worldX, y: pointer.worldY, time: pointer.event.timeStamp }];
      this.grabbedAt = this.scene.time.now;
      SoundBank.play(this.scene, 'grab');
      this.scene.input.setDefaultCursor(CURSOR_CLOSED);
      return;
    }

    if (enemy instanceof WizardEnemy && enemy.wizardState !== 'Unlocked') {
      enemy.tryRuneClick(pointer.worldX, pointer.worldY);
      return;
    }

    if (!enemy.canBeGrabbed) return;
    this.grabbed = enemy;
    this.samples = [{ x: pointer.worldX, y: pointer.worldY, time: pointer.event.timeStamp }];
    this.grabbedAt = this.scene.time.now;
    enemy.grab();
    SoundBank.play(this.scene, 'grab');
    this.scene.input.setDefaultCursor(CURSOR_CLOSED);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.grabbed) return;
    // followPointer runs per-frame in onSceneUpdate now; we just record
    // the raw pointer samples here so release() can compute throw velocity.
    this.samples.push({ x: pointer.worldX, y: pointer.worldY, time: pointer.event.timeStamp });
    if (this.samples.length > 6) this.samples.shift();
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.grabbed) return;
    this.samples.push({ x: pointer.worldX, y: pointer.worldY, time: pointer.event.timeStamp });
    this.releaseGrabbed();
  }

  private onGameOut(): void {
    if (!this.grabbed) return;
    this.releaseGrabbed();
  }

  private releaseGrabbed(): void {
    if (!this.grabbed) return;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const elapsed = Math.max(16, last.time - first.time);
    const vx = ((last.x - first.x) / elapsed) * 1000;
    const vy = ((last.y - first.y) / elapsed) * 1000;
    this.grabbed.release(vx, vy);
    this.spawnTrail(this.grabbed.x, this.grabbed.y, vx, vy);
    if (this.scene.time.now - this.grabbedAt >= TAP_VS_THROW_MS) {
      SoundBank.play(this.scene, 'throw');
    }
    // Back to the open hand -- unless a CursorDebuff is up, in which case
    // GameScene is keeping the cursor hidden and owns the restore.
    if (!CursorDebuff.isActive(this.scene.time.now)) {
      this.scene.input.setDefaultCursor(CURSOR_OPEN);
    }
    this.grabbed = undefined;
    this.samples = [];
  }

  private findTopEnemy(x: number, y: number): Enemy | undefined {
    return [...this.getEnemies()].reverse().find((enemy) => enemy.alive && enemy.containsPoint(x, y));
  }

  private findWizardRuneTarget(x: number, y: number): WizardEnemy | undefined {
    return [...this.getEnemies()]
      .reverse()
      .find((enemy): enemy is WizardEnemy => enemy instanceof WizardEnemy && enemy.alive && enemy.hasRuneAt(x, y));
  }

  private spawnTrail(x: number, y: number, vx: number, vy: number): void {
    const angle = Phaser.Math.Angle.Between(0, 0, vx, vy);
    const trail = this.scene.add.rectangle(x, y, 42, 5, 0xffffff, 0.42).setRotation(angle).setDepth(4);
    this.scene.tweens.add({
      targets: trail,
      alpha: 0,
      scaleX: 2.2,
      duration: 180,
      onComplete: () => trail.destroy()
    });
  }
}
