import Phaser from 'phaser';

export class Mage {
  readonly x = 58;
  readonly y = 82;

  constructor(scene: Phaser.Scene, level: number) {
    scene.add.circle(this.x, this.y, 12 + level * 2, 0x60a5fa).setStrokeStyle(2, 0x1e3a8a);
    scene.add.text(this.x, this.y - 3, 'M', { color: '#eff6ff', fontSize: '12px', fontStyle: 'bold' }).setOrigin(0.5);
  }
}
