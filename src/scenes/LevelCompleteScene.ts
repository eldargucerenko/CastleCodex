import Phaser from 'phaser';
import { showRewardedAd } from '../sdk/gamepush';
import { SaveSystem } from '../systems/SaveSystem';
import { computeReplaySave } from '../systems/replay';
import type { SaveData } from '../types/game';
import { COLORS, FONTS, HEX, drawStar, makeButton, makePanel } from '../ui/theme';
import { LOGICAL_W, LOGICAL_H } from '../config/dimensions';
import { SoundBank } from '../systems/SoundBank';

interface LevelCompleteData {
  levelCompleted: number;
  baseReward: number;
  elapsedMs: number;
  hasNextLevel: boolean;
  hpRemaining?: number;
  hpMax?: number;
  saveBeforeLevel?: SaveData;
}

const AD_BONUS_MULTIPLIER = 1; // +100% on top of base reward when ad is watched
const TOTAL_LEVELS = 10;

export class LevelCompleteScene extends Phaser.Scene {
  private payload!: LevelCompleteData;
  private bonusClaimed = false;
  private adInFlight = false;
  private earnedText!: Phaser.GameObjects.Text;
  private adButton!: ReturnType<typeof makeButton>;
  private adSubtext!: Phaser.GameObjects.Text;

  constructor() {
    super('LevelCompleteScene');
  }

  init(data: LevelCompleteData): void {
    this.payload = data;
    this.bonusClaimed = false;
    this.adInFlight = false;
  }

  create(): void {
    const w = LOGICAL_W;
    const h = LOGICAL_H;

    SoundBank.syncMute(this);
    SoundBank.play(this, 'victory');
    this.drawBackdrop(w, h);
    this.drawSparks(w, h);
    this.drawBanner(w);
    this.drawMainPanel(w, h);
    this.drawCornerCopy(w, h);
  }

  private drawBackdrop(w: number, h: number): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(COLORS.azure500, COLORS.azure500, COLORS.nightBg, COLORS.nightBg, 1, 1, 1, 1);
    bg.fillRect(0, 0, w, h);
    this.add.rectangle(w / 2, h / 2, w, h, COLORS.nightBg, 0.55);
  }

  private drawSparks(w: number, h: number): void {
    const sparks: Array<{ x: number; y: number; c: number; s: number }> = [
      { x: 120, y: 80, c: COLORS.gold400, s: 4 },
      { x: 800, y: 100, c: COLORS.gold400, s: 6 },
      { x: 200, y: 200, c: COLORS.bone100, s: 3 },
      { x: 760, y: 240, c: COLORS.gold400, s: 5 },
      { x: 80, y: 320, c: COLORS.bone100, s: 4 },
      { x: 880, y: 360, c: COLORS.gold400, s: 4 },
      { x: 160, y: 440, c: COLORS.bone100, s: 3 },
      { x: 820, y: 460, c: COLORS.gold400, s: 5 },
      { x: 480, y: 60, c: COLORS.bone100, s: 4 },
      { x: 320, y: 120, c: COLORS.gold400, s: 3 },
      { x: 640, y: 80, c: COLORS.bone100, s: 5 }
    ];
    for (const p of sparks) {
      const dot = this.add.rectangle(p.x, p.y, p.s, p.s, p.c);
      dot.setBlendMode(Phaser.BlendModes.ADD);
      // tween a soft pulse so the panel feels alive
      this.tweens.add({
        targets: dot,
        alpha: { from: 1, to: 0.3 },
        duration: 800 + Math.random() * 800,
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 600
      });
    }
  }

  private drawBanner(w: number): void {
    const cx = w / 2;
    const top = 30;
    const bw = 460;
    const bh = 110;

    // Pennon-style banner (top rectangle + bottom V cutout)
    const banner = this.add.graphics();
    banner.fillStyle(COLORS.ember500, 1);
    banner.lineStyle(3, COLORS.ink900, 1);
    banner.beginPath();
    banner.moveTo(cx - bw / 2, top);
    banner.lineTo(cx + bw / 2, top);
    banner.lineTo(cx + bw / 2, top + bh * 0.75);
    banner.lineTo(cx + bw * 0.4, top + bh);
    banner.lineTo(cx, top + bh * 0.8);
    banner.lineTo(cx - bw * 0.4, top + bh);
    banner.lineTo(cx - bw / 2, top + bh * 0.75);
    banner.closePath();
    banner.fillPath();
    banner.strokePath();

    // Inner highlight stroke for the parchment-style sheen
    const sheen = this.add.graphics();
    sheen.fillStyle(0xffffff, 0.12);
    sheen.fillRect(cx - bw / 2 + 4, top + 4, bw - 8, 14);

    this.add
      .text(cx, top + 26, 'WAVE CLEARED', {
        fontFamily: FONTS.display,
        fontSize: '14px',
        color: HEX.gold400
      })
      .setOrigin(0.5);
    this.add
      .text(cx, top + 60, `${this.payload.levelCompleted} / ${TOTAL_LEVELS}`, {
        fontFamily: FONTS.display,
        fontSize: '46px',
        color: HEX.bone100
      })
      .setOrigin(0.5)
      .setShadow(2, 2, '#1a0e08', 0, false, true);

    // tassels under each tail
    [-bw / 2 + 18, bw / 2 - 18].forEach((dx) => {
      this.add.rectangle(cx + dx, top + bh + 8, 4, 16, COLORS.gold400).setStrokeStyle(2, COLORS.ink900);
    });
  }

  private drawMainPanel(w: number, _h: number): void {
    const cx = w / 2;
    const top = 175;
    const panelW = 600;
    const panelH = 320;
    makePanel(this, cx, top + panelH / 2, panelW, panelH);

    // Stars overlap the top of the panel
    const stars = this.starsFromHp();
    const starY = top - 4;
    [-72, 0, 72].forEach((dx, i) => {
      drawStar(this, cx + dx, starY, i < stars, 56);
    });

    this.drawStatTiles(cx, top + 60, panelW);
    this.drawAdCta(cx, top + 170, panelW);
    this.drawActions(cx, top + panelH - 36, panelW);
  }

  private starsFromHp(): number {
    if (this.payload.hpMax && this.payload.hpRemaining !== undefined) {
      const pct = this.payload.hpRemaining / this.payload.hpMax;
      if (pct > 0.75) return 3;
      if (pct > 0.4) return 2;
      return 1;
    }
    return 3; // no HP info - assume full clear
  }

  private drawStatTiles(cx: number, y: number, panelW: number): void {
    const tileW = (panelW - 80) / 3;
    const tileH = 64;
    const tiles: Array<{ caption: string; value: string; color: string }> = [
      { caption: 'TIME', value: this.formatElapsed(this.payload.elapsedMs), color: HEX.ink900 },
      {
        caption: 'CASTLE HP',
        value:
          this.payload.hpRemaining !== undefined && this.payload.hpMax
            ? `${this.payload.hpRemaining}/${this.payload.hpMax}`
            : '-',
        color: HEX.ink900
      },
      { caption: 'EARNED', value: `+${this.payload.baseReward}g`, color: HEX.ink900 }
    ];
    tiles.forEach((tile, i) => {
      const x = cx - panelW / 2 + 28 + tileW / 2 + i * (tileW + 14);
      makePanel(this, x, y, tileW, tileH, {
        fill: COLORS.parchment300,
        inner: COLORS.parchment200,
        border: COLORS.ink700,
        borderWidth: 2
      });
      this.add
        .text(x - tileW / 2 + 12, y - 16, tile.caption, {
          fontFamily: FONTS.body,
          fontSize: '10px',
          color: HEX.ink500
        })
        .setOrigin(0, 0.5);
      const valueText = this.add
        .text(x - tileW / 2 + 12, y + 10, tile.value, {
          fontFamily: FONTS.display,
          fontSize: '24px',
          color: tile.color
        })
        .setOrigin(0, 0.5);
      if (i === 2) this.earnedText = valueText;
    });
  }

  private drawAdCta(cx: number, y: number, panelW: number): void {
    const ctaW = panelW - 56;
    const ctaH = 64;
    const cta = this.add.rectangle(cx, y, ctaW, ctaH, COLORS.azure500, 0.18);
    cta.setStrokeStyle(2, COLORS.azure500);

    // Azure square icon plate on the left, with a drawn play triangle.
    const iconX = cx - ctaW / 2 + 36;
    this.add.rectangle(iconX, y, 44, 44, COLORS.azure500).setStrokeStyle(3, COLORS.ink900);
    const play = this.add.graphics();
    play.fillStyle(COLORS.gold400, 1);
    play.fillTriangle(iconX - 7, y - 9, iconX - 7, y + 9, iconX + 9, y);
    play.lineStyle(2, COLORS.ink900);
    play.strokeTriangle(iconX - 7, y - 9, iconX - 7, y + 9, iconX + 9, y);

    this.add
      .text(iconX + 36, y - 12, 'Double your gold this wave', {
        fontFamily: FONTS.display,
        fontSize: '18px',
        color: HEX.ink900
      })
      .setOrigin(0, 0.5);
    this.adSubtext = this.add
      .text(iconX + 36, y + 12, `Watch a short ad * +${this.bonusAmount()}g bonus`, {
        fontFamily: FONTS.body,
        fontSize: '13px',
        color: HEX.ink700
      })
      .setOrigin(0, 0.5);

    this.adButton = makeButton(this, cx + ctaW / 2 - 60, y, {
      width: 100,
      height: 38,
      label: 'Watch',
      variant: 'ad',
      size: 'sm',
      onClick: () => {
        SoundBank.play(this, 'ui_click');
        void this.claimAd();
      }
    });
  }

  private drawActions(cx: number, y: number, panelW: number): void {
    const continueLabel = this.payload.hasNextLevel ? 'Next Wave' : 'Finish';
    const totalW = panelW - 56;
    const gap = 12;
    const replayW = 110;
    const continueW = totalW - replayW - gap;

    const replayX = cx - totalW / 2 + replayW / 2;
    const continueX = cx + totalW / 2 - continueW / 2;

    makeButton(this, replayX, y, {
      width: replayW,
      height: 44,
      label: 'Replay',
      variant: 'ghost',
      size: 'sm',
      onClick: () => {
        SoundBank.play(this, 'ui_click');
        this.replay();
      }
    });
    makeButton(this, continueX, y, {
      width: continueW,
      height: 44,
      label: continueLabel,
      variant: 'primary',
      size: 'md',
      onClick: () => {
        SoundBank.play(this, 'ui_click');
        this.continueGame();
      }
    });
  }

  private drawCornerCopy(_w: number, h: number): void {
    this.add
      .text(14, h - 22, `Wave ${this.payload.levelCompleted} cleared`, {
        fontFamily: FONTS.body,
        fontSize: '11px',
        color: HEX.bone100
      })
      .setOrigin(0, 0.5);
  }

  private bonusAmount(): number {
    return Math.round(this.payload.baseReward * AD_BONUS_MULTIPLIER);
  }

  private currentReward(): number {
    return this.payload.baseReward + (this.bonusClaimed ? this.bonusAmount() : 0);
  }

  private formatElapsed(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  private async claimAd(): Promise<void> {
    if (this.bonusClaimed || this.adInFlight) return;
    this.adInFlight = true;
    this.adButton.setEnabled(false);
    this.adButton.setLabel('...');
    this.adSubtext.setText('Loading ad...');

    const rewarded = await showRewardedAd();
    this.adInFlight = false;

    if (rewarded) {
      const bonus = this.bonusAmount();
      const save = SaveSystem.load();
      save.gold += bonus;
      SaveSystem.save(save);
      this.bonusClaimed = true;
      this.earnedText.setText(`+${this.currentReward()}g`);
      this.adSubtext.setText(`+${bonus}g bonus claimed`);
      this.adButton.setLabel('Done');
    } else {
      this.adSubtext.setText('Ad unavailable');
      this.adButton.setLabel('-');
    }
  }

  private replay(): void {
    const current = SaveSystem.load();
    const restored = this.payload.saveBeforeLevel
      ? computeReplaySave(this.payload.saveBeforeLevel, current)
      : { ...current, currentLevel: this.payload.levelCompleted };
    SaveSystem.save(restored);
    this.scene.start('GameScene');
  }

  private continueGame(): void {
    this.scene.start(this.payload.hasNextLevel ? 'UpgradeScene' : 'VictoryScene');
  }
}
