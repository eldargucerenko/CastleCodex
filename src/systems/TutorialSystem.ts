import Phaser from 'phaser';
import type { Castle } from '../entities/Castle';
import type { Enemy } from '../entities/Enemy';
import { LOGICAL_W, LOGICAL_H } from '../config/dimensions';

type Step = 'castle' | 'enemy' | 'drag' | 'release' | 'done';

const DEPTH_OVERLAY = 1000;
const DEPTH_UI = 1010;

export class TutorialSystem {
  private step: Step = 'castle';
  private overlay: Phaser.GameObjects.Rectangle;
  private maskShape: Phaser.GameObjects.Graphics;
  private pointer: Phaser.GameObjects.Container;
  private pointerTween?: Phaser.Tweens.Tween;
  private banner: Phaser.GameObjects.Container;
  private bannerText: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  private tutorialEnemy?: Enemy;
  private liftThresholdY: number;
  private destroyed = false;

  constructor(
    private scene: Phaser.Scene,
    private castle: Castle,
    private spawnTutorialEnemy: () => Enemy,
    private onComplete: () => void
  ) {
    const width = LOGICAL_W;
    const height = LOGICAL_H;
    this.liftThresholdY = height * 0.45;

    this.maskShape = scene.add.graphics();
    this.maskShape.setVisible(false);

    this.overlay = scene.add
      .rectangle(0, 0, width, height, 0x000000, 0.62)
      .setOrigin(0)
      .setDepth(DEPTH_OVERLAY);

    const mask = new Phaser.Display.Masks.BitmapMask(scene, this.maskShape);
    mask.invertAlpha = true;
    this.overlay.setMask(mask);

    this.pointer = this.createPointer().setDepth(DEPTH_UI).setVisible(false);
    this.banner = this.createBanner().setDepth(DEPTH_UI);
    this.bannerText = this.banner.getByName('text') as Phaser.GameObjects.Text;
    this.hint = scene.add
      .text(width / 2, height - 32, 'Tap to continue', {
        color: '#fef3c7',
        fontSize: '16px',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_UI);

    scene.input.on('pointerdown', this.onPointerDown, this);

    this.setStep('castle');
  }

  update(): void {
    if (this.destroyed) return;
    this.redrawMask();
    if (this.step === 'enemy' && this.tutorialEnemy) {
      this.pointer.x = this.tutorialEnemy.x;
    }
    const e = this.tutorialEnemy;
    if (!e) return;
    if (this.step === 'drag' || this.step === 'release') {
      if (!e.alive || e.hp < e.stats.hp) {
        this.complete();
        return;
      }
    }
    if (this.step === 'drag' && e.isGrabbed && e.y < this.liftThresholdY) {
      this.setStep('release');
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.pointerTween?.stop();
    this.overlay.clearMask(true);
    this.overlay.destroy();
    this.maskShape.destroy();
    this.pointer.destroy();
    this.banner.destroy();
    this.hint.destroy();
  }

  private setStep(step: Step): void {
    this.step = step;
    if (step === 'castle') {
      this.bannerText.setText('Defend the castle');
      this.pointer.setRotation(0);
      this.movePointerTo(this.castle.width / 2 + 6, this.castle.top - 36);
      this.hint.setVisible(true);
      return;
    }
    if (step === 'enemy') {
      this.tutorialEnemy = this.spawnTutorialEnemy();
      this.tutorialEnemy.walkPaused = true;
      this.bannerText.setText('This knight wants to attack');
      const e = this.tutorialEnemy;
      this.pointer.setRotation(Math.PI);
      this.movePointerTo(e.x, e.y - 124);
      this.hint.setVisible(true);
      return;
    }
    if (step === 'drag') {
      this.bannerText.setText('Grab the knight and lift it high');
      this.hint.setVisible(false);
      this.startDragGesture();
      return;
    }
    if (step === 'release') {
      this.bannerText.setText('Release! Watch it fall and take damage');
      this.hint.setVisible(false);
      this.pointer.setVisible(false);
      this.pointerTween?.stop();
    }
  }

  private onPointerDown(): void {
    if (this.step === 'castle') {
      this.setStep('enemy');
      return;
    }
    if (this.step === 'enemy') {
      this.setStep('drag');
    }
  }

  private complete(): void {
    if (this.step === 'done') return;
    this.step = 'done';
    if (this.tutorialEnemy) this.tutorialEnemy.walkPaused = false;
    this.scene.tweens.add({
      targets: [this.overlay, this.pointer, this.banner, this.hint],
      alpha: 0,
      duration: 380,
      onComplete: () => {
        this.onComplete();
        this.destroy();
      }
    });
  }

  private redrawMask(): void {
    this.maskShape.clear();
    this.maskShape.fillStyle(0xffffff, 1);
    if (this.step === 'castle') {
      const top = this.castle.top - 90;
      const bottom = this.castle.bottom + 18;
      this.maskShape.fillRoundedRect(-12, top, this.castle.width + 28, bottom - top, 18);
      return;
    }
    const e = this.tutorialEnemy;
    if (!e || !e.alive) return;
    this.maskShape.fillCircle(e.x, e.y - 18, 72);
  }

  private createPointer(): Phaser.GameObjects.Container {
    const c = this.scene.add.container(0, 0);
    const g = this.scene.add.graphics();
    g.lineStyle(3, 0x111827, 1);
    g.fillStyle(0xfde047, 1);
    g.fillTriangle(-13, -2, 13, -2, 0, 20);
    g.strokeTriangle(-13, -2, 13, -2, 0, 20);
    g.fillRoundedRect(-11, -36, 22, 36, 7);
    g.strokeRoundedRect(-11, -36, 22, 36, 7);
    c.add(g);
    return c;
  }

  private createBanner(): Phaser.GameObjects.Container {
    const width = LOGICAL_W;
    const c = this.scene.add.container(width / 2, 56);
    const bg = this.scene.add
      .rectangle(0, 0, 540, 60, 0x111827, 0.85)
      .setStrokeStyle(2, 0xfde047);
    const text = this.scene.add
      .text(0, 0, '', {
        color: '#fde047',
        fontSize: '22px',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setName('text');
    c.add([bg, text]);
    return c;
  }

  private movePointerTo(x: number, y: number): void {
    this.pointerTween?.stop();
    this.pointer.setVisible(true);
    this.pointer.setAlpha(1);
    this.pointer.setPosition(x, y);
    this.pointerTween = this.scene.tweens.add({
      targets: this.pointer,
      y: y - 12,
      duration: 480,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  private startDragGesture(): void {
    if (!this.tutorialEnemy) return;
    const e = this.tutorialEnemy;
    this.pointerTween?.stop();
    this.pointer.setVisible(true);
    this.pointer.setRotation(Math.PI);
    const startY = e.y - 124;
    const endY = startY - 160;
    this.pointer.setPosition(e.x, startY);
    this.pointer.setAlpha(1);
    this.pointerTween = this.scene.tweens.add({
      targets: this.pointer,
      y: endY,
      alpha: { from: 1, to: 0.05 },
      duration: 950,
      repeat: -1,
      ease: 'Cubic.easeIn',
      onRepeat: () => {
        this.pointer.setPosition(e.x, startY);
        this.pointer.setAlpha(1);
      }
    });
  }
}
