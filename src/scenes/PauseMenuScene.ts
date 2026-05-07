import Phaser from 'phaser';
import { getSdkMuted, setSdkMuted } from '../sdk/gamepush';
import { SaveSystem } from '../systems/SaveSystem';

const MUTED_KEY = 'castle-codex-muted';

interface PauseMenuData {
  fromScene?: string;
}

export class PauseMenuScene extends Phaser.Scene {
  private fromScene = 'GameScene';
  private muted = false;
  private confirmReset = false;
  private soundLabel!: Phaser.GameObjects.Text;
  private resetLabel!: Phaser.GameObjects.Text;
  private resetRect!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('PauseMenuScene');
  }

  init(data: PauseMenuData): void {
    this.fromScene = data?.fromScene ?? 'GameScene';
    this.muted = PauseMenuScene.loadMuted();
    this.confirmReset = false;
  }

  create(): void {
    const w = Number(this.game.config.width);
    const h = Number(this.game.config.height);

    this.add.rectangle(w / 2, h / 2, w, h, 0x0f172a, 0.78);

    const panelW = 380;
    const panelH = 360;
    this.add.rectangle(w / 2, h / 2, panelW, panelH, 0xfef9c3).setStrokeStyle(3, 0x854d0e);

    this.add
      .text(w / 2, h / 2 - panelH / 2 + 36, 'Paused', {
        color: '#78350f',
        fontSize: '32px',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    this.makeButton(w / 2, h / 2 - 50, 240, 48, 'Continue', 0x10b981, 0x059669, '#ffffff', () =>
      this.continue()
    );

    const resetBtn = this.makeButton(
      w / 2,
      h / 2 + 10,
      240,
      48,
      'New Game',
      0xdc2626,
      0xb91c1c,
      '#ffffff',
      () => this.handleReset()
    );
    this.resetLabel = resetBtn;
    this.resetRect = resetBtn.getData('rect') as Phaser.GameObjects.Rectangle;

    this.soundLabel = this.makeButton(
      w / 2,
      h / 2 + 70,
      240,
      48,
      this.soundButtonLabel(),
      0x6366f1,
      0x4f46e5,
      '#ffffff',
      () => this.toggleSound()
    );

    this.add
      .text(w / 2, h / 2 + panelH / 2 - 28, 'Press Esc to continue', {
        color: '#78350f',
        fontSize: '13px'
      })
      .setOrigin(0.5);

    this.input.keyboard?.on('keydown-ESC', () => this.continue());
  }

  private soundButtonLabel(): string {
    return this.muted ? 'Sound: Off' : 'Sound: On';
  }

  private toggleSound(): void {
    this.muted = !this.muted;
    PauseMenuScene.saveMuted(this.muted);
    this.soundLabel.setText(this.soundButtonLabel());
  }

  private handleReset(): void {
    if (!this.confirmReset) {
      this.confirmReset = true;
      this.resetLabel.setText('Confirm? Tap again');
      this.resetRect.setFillStyle(0xb91c1c);
      return;
    }
    SaveSystem.reset();
    this.scene.stop(this.fromScene);
    this.scene.start('GameScene');
    this.scene.stop();
  }

  private continue(): void {
    this.scene.resume(this.fromScene);
    this.scene.stop();
  }

  private makeButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    fillIdle: number,
    fillHover: number,
    textColor: string,
    onClick: () => void
  ): Phaser.GameObjects.Text {
    const rect = this.add
      .rectangle(x, y, w, h, fillIdle)
      .setStrokeStyle(2, 0x0f172a)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(x, y, label, { color: textColor, fontSize: '20px', fontStyle: 'bold' })
      .setOrigin(0.5);
    rect.on('pointerover', () => rect.setFillStyle(fillHover));
    rect.on('pointerout', () => rect.setFillStyle(fillIdle));
    rect.on('pointerdown', onClick);
    text.setData('rect', rect);
    return text;
  }

  static loadMuted(): boolean {
    const sdk = getSdkMuted();
    if (sdk !== null) return sdk;
    try {
      return window.localStorage.getItem(MUTED_KEY) === '1';
    } catch {
      return false;
    }
  }

  static saveMuted(muted: boolean): void {
    try {
      window.localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    setSdkMuted(muted);
  }
}
