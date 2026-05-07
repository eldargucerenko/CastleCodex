import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';
import { COLORS, FONTS, HEX, drawStar, makeButton, makePanel } from '../ui/theme';
import { LOGICAL_W, LOGICAL_H } from '../config/dimensions';

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super('VictoryScene');
  }

  create(): void {
    const w = LOGICAL_W;
    const h = LOGICAL_H;

    const bg = this.add.graphics();
    bg.fillGradientStyle(COLORS.azure500, COLORS.azure500, COLORS.nightBg, COLORS.nightBg, 1, 1, 1, 1);
    bg.fillRect(0, 0, w, h);

    makePanel(this, w / 2, h / 2 + 10, 520, 280);

    [-80, 0, 80].forEach((dx) => drawStar(this, w / 2 + dx, h / 2 - 110, true, 56));

    this.add
      .text(w / 2, h / 2 - 40, 'Victory', {
        fontFamily: FONTS.display,
        fontSize: '48px',
        color: HEX.gold500
      })
      .setOrigin(0.5);
    this.add
      .text(w / 2, h / 2 + 4, 'All 10 waves are cleared. The castle stands.', {
        fontFamily: FONTS.body,
        fontSize: '15px',
        color: HEX.ink700
      })
      .setOrigin(0.5);

    makeButton(this, w / 2, h / 2 + 80, {
      width: 240,
      height: 50,
      label: 'Play Again',
      variant: 'primary',
      size: 'md',
      onClick: () => {
        SaveSystem.reset();
        this.scene.start('GameScene');
      }
    });
  }
}
