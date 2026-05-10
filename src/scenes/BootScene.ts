import Phaser from 'phaser';
import { awaitPlayerReady, cloudLoad, cloudSave, gameLoadingReady, initGamePush, trackLevelStart } from '../sdk/gamepush';
import { SaveSystem } from '../systems/SaveSystem';
import { LOGICAL_W, LOGICAL_H } from '../config/dimensions';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    const assetBasePath = this.getAssetBasePath();
    // Maps the asset filename prefix to the in-engine "kind" for animation
    // keys -- e.g. heavy_knight files become enemy-heavy-knight-* keys.
    // hammerman files belong to the jumper kind in gameplay code.
    const sheetSpecs: Array<{ name: string; key: string; actions: string[] }> = [
      { name: 'knight',       key: 'knight',       actions: ['walk', 'air_panic', 'getup', 'hurt', 'strike1', 'strike2'] },
      { name: 'archer',       key: 'archer',       actions: ['walk', 'air_panic', 'getup', 'hurt',             'strike2'] },
      { name: 'bomber',       key: 'bomber',       actions: ['walk', 'air_panic', 'getup', 'hurt', 'strike1', 'strike2'] },
      { name: 'raider',       key: 'raider',       actions: ['walk', 'air_panic', 'getup', 'hurt', 'strike1', 'strike2'] },
      { name: 'wizard',       key: 'wizard',       actions: ['walk', 'air_panic', 'getup', 'hurt', 'strike1', 'strike2'] },
      { name: 'heavy_knight', key: 'heavy-knight', actions: ['walk', 'air_panic', 'getup', 'hurt', 'strike1', 'strike2'] },
      { name: 'log_thrower',  key: 'log-thrower',  actions: ['walk', 'air_panic', 'getup', 'hurt', 'strike1', 'strike2'] },
      { name: 'hammerman',    key: 'jumper',       actions: ['walk', 'air_panic', 'getup', 'hurt', 'strike1', 'strike2'] }
    ];

    for (const { name, key, actions } of sheetSpecs) {
      for (const action of actions) {
        const animKey = `enemy-${key}-${this.actionToKey(action)}`;
        this.load.spritesheet(
          animKey,
          `${assetBasePath}assets/enemies/${name}_${action}_strip.png`,
          { frameWidth: 256, frameHeight: 256 }
        );
      }
    }
  }

  // Asset filenames use 'air_panic' but the in-engine key is just 'air'.
  private actionToKey(action: string): string {
    if (action === 'air_panic') return 'air';
    return action;
  }

  private createEnemyAnimations(): void {
    // (key suffix, frameRate, repeat) per action type. walk + air are loops;
    // strikes / hurt / getup are one-shots.
    // Walk loops 0..6 to hide the imperfect frame-7 -> 0 snap from the
    // WAN-generated cycles. Other anims play full 8 frames since they're
    // one-shots (no loop) or feel intentional even with a tiny snap.
    const ACTIONS: Array<[string, number, number, number]> = [
      // [actionKey, frameRate, repeat, lastFrame]
      ['walk',    8,  -1, 6],
      ['air',    10,  -1, 7],
      ['getup',  10,   0, 7],
      ['hurt',   14,   0, 7],
      ['strike1', 14, 0, 7],
      ['strike2', 14, 0, 7]
    ];
    const enemyKeys = ['knight', 'archer', 'bomber', 'raider', 'wizard',
                       'heavy-knight', 'log-thrower', 'jumper'];
    for (const enemyKey of enemyKeys) {
      for (const [action, frameRate, repeat, lastFrame] of ACTIONS) {
        const key = `enemy-${enemyKey}-${action}`;
        if (!this.textures.exists(key) || this.anims.exists(key)) continue;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(key, { start: 0, end: lastFrame as number }),
          frameRate: frameRate as number,
          repeat: repeat as number
        });
      }
    }
  }

  async create(): Promise<void> {
    this.createEnemyAnimations();

    const width = LOGICAL_W;
    const height = LOGICAL_H;
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
