import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super('VictoryScene');
  }

  create(): void {
    const width = Number(this.game.config.width);
    const height = Number(this.game.config.height);
    this.add.rectangle(width / 2, height / 2, width, height, 0xd1fae5);
    this.add.text(width / 2, height / 2 - 82, 'Victory', { color: '#064e3b', fontSize: '48px', fontStyle: 'bold' }).setOrigin(0.5);
    this.add
      .text(width / 2, height / 2 - 24, 'All 10 levels are cleared. The castle stands.', {
        color: '#065f46',
        fontSize: '21px'
      })
      .setOrigin(0.5);
    this.button(width / 2, height / 2 + 60, 'Play Again', () => {
      SaveSystem.reset();
      this.scene.start('GameScene');
    });
  }

  private button(x: number, y: number, label: string, onClick: () => void): void {
    const rect = this.add.rectangle(x, y, 230, 58, 0xffffff).setStrokeStyle(2, 0x047857).setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { color: '#064e3b', fontSize: '22px', fontStyle: 'bold' }).setOrigin(0.5);
    rect.on('pointerdown', onClick);
  }
}
