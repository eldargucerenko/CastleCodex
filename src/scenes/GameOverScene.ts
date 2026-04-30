import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create(): void {
    const width = Number(this.game.config.width);
    const height = Number(this.game.config.height);
    this.add.rectangle(width / 2, height / 2, width, height, 0x111827);
    this.add.text(width / 2, height / 2 - 70, 'Game Over', { color: '#fee2e2', fontSize: '46px', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(width / 2, height / 2 - 18, 'The castle has fallen.', { color: '#e5e7eb', fontSize: '20px' }).setOrigin(0.5);
    this.button(width / 2, height / 2 + 58, 'Restart', () => {
      SaveSystem.reset();
      this.scene.start('GameScene');
    });
  }

  private button(x: number, y: number, label: string, onClick: () => void): void {
    const rect = this.add.rectangle(x, y, 210, 58, 0xffffff).setStrokeStyle(2, 0xfca5a5).setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { color: '#111827', fontSize: '22px', fontStyle: 'bold' }).setOrigin(0.5);
    rect.on('pointerdown', onClick);
  }
}
