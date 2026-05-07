import Phaser from 'phaser';
import { awaitPlayerReady, cloudLoad, cloudSave, gameLoadingReady, initGamePush, trackLevelStart } from '../sdk/gamepush';
import { SaveSystem } from '../systems/SaveSystem';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    const assetBasePath = this.getAssetBasePath();
    this.load.spritesheet('basic-knight-walk-sheet', `${assetBasePath}assets/Knight1/KnightWalkSheet.png?v=20260503-run`, {
      frameWidth: 474,
      frameHeight: 723
    });
  }

  async create(): Promise<void> {
    if (this.textures.exists('basic-knight-walk-sheet') && !this.anims.exists('basic-walk')) {
      this.anims.create({
        key: 'basic-walk',
        frames: this.anims.generateFrameNumbers('basic-knight-walk-sheet', { start: 0, end: 35 }),
        frameRate: 18,
        repeat: -1
      });
    }

    const width = Number(this.game.config.width);
    const height = Number(this.game.config.height);
    this.add.rectangle(width / 2, height / 2, width, height, 0x111827);
    this.add.text(width / 2, height / 2, 'Loading...', {
      color: '#f9fafb',
      fontSize: '28px',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    await initGamePush();
    await awaitPlayerReady();
    await this.mergeCloudSave();
    await gameLoadingReady();

    // GamePush certification: fire LEVEL_START 0 as the "play button clicked"
    // proxy now that the SDK handshake is complete. The per-level LEVEL_START N
    // signal fires inside GameScene.create as the player enters each level.
    trackLevelStart(0);

    // GamePush certification: at least one cloudSave per session counts as a
    // "save observed" telemetry event for the dashboard. Persist the current
    // local save (or defaults on a fresh install) so the indicator goes green
    // on first boot, before the player has finished any level.
    void cloudSave(SaveSystem.load() as unknown as Record<string, unknown>);

    const save = SaveSystem.load();
    this.scene.start(save.currentLevel > 10 ? 'VictoryScene' : 'GameScene');
  }

  // Pull cloud save into localStorage if the SDK has any. localStorage stays
  // the local source of truth - we just hydrate it from the cloud at boot so
  // the rest of the game can keep using SaveSystem synchronously.
  private async mergeCloudSave(): Promise<void> {
    const cloud = await cloudLoad();
    if (!cloud) return;
    SaveSystem.applyCloudData(cloud);
  }

  private getAssetBasePath(): string {
    if (window.location.hostname.endsWith('github.io')) {
      const repoName = window.location.pathname.split('/').filter(Boolean)[0];
      return repoName ? `/${repoName}/` : '/';
    }
    return './';
  }
}
