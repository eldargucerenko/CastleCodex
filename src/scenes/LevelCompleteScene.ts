import Phaser from 'phaser';
import { showRewardedAd } from '../sdk/gamepush';
import { SaveSystem } from '../systems/SaveSystem';

interface LevelCompleteData {
  levelCompleted: number;
  baseReward: number;
  elapsedMs: number;
  hasNextLevel: boolean;
}

const AD_BONUS_MULTIPLIER = 1; // +100% on top of base reward when ad is watched

export class LevelCompleteScene extends Phaser.Scene {
  private payload!: LevelCompleteData;
  private bonusClaimed = false;
  private adInFlight = false;
  private rewardText!: Phaser.GameObjects.Text;
  private adRect!: Phaser.GameObjects.Rectangle;
  private adLabel!: Phaser.GameObjects.Text;

  constructor() {
    super('LevelCompleteScene');
  }

  init(data: LevelCompleteData): void {
    this.payload = data;
    this.bonusClaimed = false;
    this.adInFlight = false;
  }

  create(): void {
    const width = Number(this.game.config.width);
    const height = Number(this.game.config.height);

    this.add.rectangle(width / 2, height / 2, width, height, 0x0f172a, 0.78);

    const panelW = 480;
    const panelH = 360;
    const cx = width / 2;
    const cy = height / 2;
    this.add.rectangle(cx, cy, panelW, panelH, 0xfef9c3).setStrokeStyle(3, 0x854d0e);

    this.add
      .text(cx, cy - panelH / 2 + 36, 'Level Complete', {
        color: '#78350f',
        fontSize: '32px',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    this.add
      .text(cx, cy - panelH / 2 + 70, `Level ${this.payload.levelCompleted}`, {
        color: '#92400e',
        fontSize: '18px'
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy - 28, `Time: ${this.formatElapsed(this.payload.elapsedMs)}`, {
        color: '#1f2937',
        fontSize: '22px'
      })
      .setOrigin(0.5);

    this.rewardText = this.add
      .text(cx, cy + 8, this.rewardLine(), {
        color: '#1f2937',
        fontSize: '22px',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    this.makeAdButton(cx, cy + 64);

    const continueLabel = this.payload.hasNextLevel ? 'Continue' : 'Finish';
    this.makeContinueButton(cx, cy + 130, continueLabel, () => this.continue());
  }

  private rewardLine(): string {
    const total = this.payload.baseReward + (this.bonusClaimed ? this.bonusAmount() : 0);
    return this.bonusClaimed
      ? `Gold earned: +${total}g (bonus +${this.bonusAmount()}g)`
      : `Gold earned: +${total}g`;
  }

  private bonusAmount(): number {
    return Math.round(this.payload.baseReward * AD_BONUS_MULTIPLIER);
  }

  private formatElapsed(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  private makeAdButton(x: number, y: number): void {
    this.adRect = this.add
      .rectangle(x, y, 300, 46, 0xfde68a)
      .setStrokeStyle(2, 0xb45309)
      .setInteractive({ useHandCursor: true });
    this.adLabel = this.add
      .text(x, y, `Watch Ad: +${this.bonusAmount()}g bonus`, {
        color: '#78350f',
        fontSize: '17px',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    this.adRect.on('pointerdown', () => void this.claimAd());
  }

  private async claimAd(): Promise<void> {
    if (this.bonusClaimed || this.adInFlight) return;
    this.adInFlight = true;
    this.adRect.disableInteractive();
    this.adRect.setFillStyle(0xfef3c7);
    this.adLabel.setText('Loading ad...');

    const rewarded = await showRewardedAd();
    this.adInFlight = false;

    if (rewarded) {
      const bonus = this.bonusAmount();
      const save = SaveSystem.load();
      save.gold += bonus;
      SaveSystem.save(save);
      this.bonusClaimed = true;
      this.rewardText.setText(this.rewardLine());
      this.adLabel.setText(`Bonus +${bonus}g claimed`);
      this.adRect.setFillStyle(0xa7f3d0).setStrokeStyle(2, 0x047857);
    } else {
      this.adLabel.setText('Ad unavailable');
      this.adRect.setFillStyle(0xe5e7eb).setStrokeStyle(2, 0x9ca3af);
    }
  }

  private makeContinueButton(x: number, y: number, label: string, onClick: () => void): void {
    const rect = this.add
      .rectangle(x, y, 220, 50, 0x10b981)
      .setStrokeStyle(2, 0x064e3b)
      .setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { color: '#ffffff', fontSize: '20px', fontStyle: 'bold' }).setOrigin(0.5);
    rect.on('pointerover', () => rect.setFillStyle(0x059669));
    rect.on('pointerout', () => rect.setFillStyle(0x10b981));
    rect.on('pointerdown', onClick);
  }

  private continue(): void {
    this.scene.start(this.payload.hasNextLevel ? 'UpgradeScene' : 'VictoryScene');
  }
}
