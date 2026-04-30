import Phaser from 'phaser';

export class Trap {
  readonly zone: Phaser.Geom.Rectangle;
  private visual: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, level: number) {
    this.zone = new Phaser.Geom.Rectangle(124, Number(scene.game.config.height) - 116, 96 + level * 24, 42);
    this.visual = scene.add.rectangle(this.zone.centerX, this.zone.centerY, this.zone.width, this.zone.height, 0x64748b, 0.38);
    this.visual.setStrokeStyle(2, 0x0f172a, 0.8);
    for (let i = 0; i < 6 + level * 2; i += 1) {
      const x = this.zone.left + 10 + i * 15;
      scene.add.triangle(x, this.zone.bottom - 4, 0, 16, 8, 0, 16, 16, 0xe5e7eb).setStrokeStyle(1, 0x111827);
    }
  }

  pulse(scene: Phaser.Scene): void {
    scene.tweens.add({ targets: this.visual, alpha: 0.85, yoyo: true, duration: 120 });
  }
}
