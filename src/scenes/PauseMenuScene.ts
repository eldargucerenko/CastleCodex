import Phaser from 'phaser';
import { getSdkMuted, setSdkMuted } from '../sdk/gamepush';
import { SaveSystem } from '../systems/SaveSystem';
import { COLORS, FONTS, HEX, makeButton, makePanel } from '../ui/theme';

const MUTED_KEY = 'castle-codex-muted';

interface PauseMenuData {
  fromScene?: string;
}

export class PauseMenuScene extends Phaser.Scene {
  private fromScene = 'GameScene';
  private muted = false;
  private confirmReset = false;
  private soundButton!: ReturnType<typeof makeButton>;
  private resetButton!: ReturnType<typeof makeButton>;

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

    this.add.rectangle(w / 2, h / 2, w, h, COLORS.nightBg, 0.78);

    const panelW = 380;
    const panelH = 360;
    const cx = w / 2;
    const cy = h / 2;
    makePanel(this, cx, cy, panelW, panelH);

    this.add
      .text(cx, cy - panelH / 2 + 38, 'Paused', {
        fontFamily: FONTS.display,
        fontSize: '32px',
        color: HEX.ink900
      })
      .setOrigin(0.5);
    this.add
      .text(cx, cy - panelH / 2 + 70, 'TAKE A BREATH', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        color: HEX.ink500
      })
      .setOrigin(0.5);

    makeButton(this, cx, cy - 30, {
      width: 240,
      height: 48,
      label: 'Continue',
      variant: 'primary',
      size: 'md',
      onClick: () => this.continueGame()
    });

    this.resetButton = makeButton(this, cx, cy + 30, {
      width: 240,
      height: 48,
      label: 'New Game',
      variant: 'danger',
      size: 'md',
      onClick: () => this.handleReset()
    });

    this.soundButton = makeButton(this, cx, cy + 90, {
      width: 240,
      height: 48,
      label: this.soundButtonLabel(),
      variant: 'secondary',
      size: 'md',
      onClick: () => this.toggleSound()
    });

    this.add
      .text(cx, cy + panelH / 2 - 22, 'Press Esc to continue', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        color: HEX.ink500
      })
      .setOrigin(0.5);

    this.input.keyboard?.on('keydown-ESC', () => this.continueGame());
  }

  private soundButtonLabel(): string {
    return this.muted ? 'Sound: Off' : 'Sound: On';
  }

  private toggleSound(): void {
    this.muted = !this.muted;
    PauseMenuScene.saveMuted(this.muted);
    this.soundButton.setLabel(this.soundButtonLabel());
  }

  private handleReset(): void {
    if (!this.confirmReset) {
      this.confirmReset = true;
      this.resetButton.setLabel('Tap again to confirm');
      return;
    }
    SaveSystem.reset();
    this.scene.stop(this.fromScene);
    this.scene.start('GameScene');
  }

  private continueGame(): void {
    this.scene.resume(this.fromScene);
    this.scene.stop();
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
