import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    const assetBasePath = this.getAssetBasePath();
    this.load.spritesheet('basic-knight-walk-sheet', `${assetBasePath}assets/Knight1/KnightWalkSheet.png?v=20260503-122225`, {
      frameWidth: 340,
      frameHeight: 520
    });
  }

  create(): void {
    if (this.textures.exists('basic-knight-walk-sheet') && !this.anims.exists('basic-walk')) {
      this.anims.create({
        key: 'basic-walk',
        frames: this.anims.generateFrameNumbers('basic-knight-walk-sheet', { start: 0, end: 7 }),
        frameRate: 11,
        repeat: -1
      });
    }

    const save = SaveSystem.load();
    this.scene.start(save.currentLevel > 10 ? 'VictoryScene' : 'GameScene');
  }

  private getAssetBasePath(): string {
    if (window.location.hostname.endsWith('github.io')) {
      const repoName = window.location.pathname.split('/').filter(Boolean)[0];
      return repoName ? `/${repoName}/` : '/';
    }
    return './';
  }
}
