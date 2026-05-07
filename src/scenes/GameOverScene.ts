import Phaser from 'phaser';
import { trackLevelReplay } from '../sdk/gamepush';
import { SaveSystem } from '../systems/SaveSystem';
import { COLORS, FONTS, HEX, makeButton, makePanel } from '../ui/theme';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create(): void {
    const w = Number(this.game.config.width);
    const h = Number(this.game.config.height);
    const lostLevel = SaveSystem.load().currentLevel;

    const bg = this.add.graphics();
    bg.fillGradientStyle(COLORS.nightBg, COLORS.nightBg, COLORS.ember600, COLORS.ember600, 1, 1, 1, 1);
    bg.fillRect(0, 0, w, h);

    makePanel(this, w / 2, h / 2, 460, 240, { fill: COLORS.parchment200, border: COLORS.ember500 });

    this.add
      .text(w / 2, h / 2 - 70, 'Game Over', {
        fontFamily: FONTS.display,
        fontSize: '40px',
        color: HEX.ember500
      })
      .setOrigin(0.5);
    this.add
      .text(w / 2, h / 2 - 24, 'The castle has fallen.', {
        fontFamily: FONTS.body,
        fontSize: '15px',
        color: HEX.ink700
      })
      .setOrigin(0.5);

    makeButton(this, w / 2, h / 2 + 50, {
      width: 220,
      height: 50,
      label: 'Restart',
      variant: 'primary',
      size: 'md',
      onClick: () => {
        trackLevelReplay(lostLevel);
        SaveSystem.reset();
        this.scene.start('GameScene');
      }
    });
  }
}
