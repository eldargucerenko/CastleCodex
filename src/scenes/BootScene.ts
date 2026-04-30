import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    for (let frame = 1; frame <= 6; frame += 1) {
      this.load.image(`knight-run-${frame}`, `assets/Knight1/KnightRun${frame}.png`);
    }
  }

  create(): void {
    this.anims.create({
      key: 'basic-walk',
      frames: [1, 2, 3, 4, 5, 6].map((frame) => ({ key: `knight-run-${frame}` })),
      frameRate: 10,
      repeat: -1
    });

    const save = SaveSystem.load();
    this.scene.start(save.currentLevel > 10 ? 'VictoryScene' : 'GameScene');
  }
}
