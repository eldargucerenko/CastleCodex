import Phaser from 'phaser';
import { BurningEnemy } from '../entities/BurningEnemy';
import type { Castle } from '../entities/Castle';
import type { Enemy } from '../entities/Enemy';
import { WizardEnemy } from '../entities/WizardEnemy';

interface PointerSample {
  x: number;
  y: number;
  time: number;
}

export class DragThrowSystem {
  private grabbed?: Enemy;
  private cooling?: BurningEnemy;
  private samples: PointerSample[] = [];

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
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('pointerupoutside', this.onPointerUp, this);
    this.scene.input.off('gameout', this.onGameOut, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
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
      return;
    }

    if (enemy instanceof WizardEnemy && enemy.wizardState !== 'Unlocked') {
      enemy.tryRuneClick(pointer.worldX, pointer.worldY);
      return;
    }

    if (enemy instanceof BurningEnemy && enemy.burningState !== 'Cooled') {
      this.cooling = enemy;
      enemy.startCooling(() => {
        this.scene.add.text(enemy.x, enemy.y - 44, 'cooled', { color: '#0284c7', fontSize: '13px', fontStyle: 'bold' }).setOrigin(0.5);
      });
      this.castle.takeDamage(1);
      return;
    }

    if (!enemy.canBeGrabbed) return;
    this.grabbed = enemy;
    this.samples = [{ x: pointer.worldX, y: pointer.worldY, time: pointer.event.timeStamp }];
    enemy.grab();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.grabbed) return;
    this.grabbed.followPointer(pointer.worldX, pointer.worldY);
    this.samples.push({ x: pointer.worldX, y: pointer.worldY, time: pointer.event.timeStamp });
    if (this.samples.length > 6) this.samples.shift();
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    this.cancelCoolingIfAny();
    if (!this.grabbed) return;
    this.samples.push({ x: pointer.worldX, y: pointer.worldY, time: pointer.event.timeStamp });
    this.releaseGrabbed();
  }

  private onGameOut(): void {
    this.cancelCoolingIfAny();
    if (!this.grabbed) return;
    this.releaseGrabbed();
  }

  private cancelCoolingIfAny(): void {
    if (this.cooling && this.cooling.burningState === 'Cooling') {
      this.cooling.cancelCooling();
    }
    this.cooling = undefined;
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
