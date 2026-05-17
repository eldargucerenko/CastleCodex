import Phaser from 'phaser';
import { awaitPlayerReady, cloudLoad, cloudSave, gameLoadingReady, initGamePush, trackLevelStart } from '../sdk/gamepush';
import { SaveSystem } from '../systems/SaveSystem';
import { SoundBank } from '../systems/SoundBank';
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
      { name: 'bomber',       key: 'bomber',       actions: ['walk', 'air_panic', 'getup', 'hurt', 'strike1'] },
      { name: 'raider',       key: 'raider',       actions: ['walk', 'air_panic', 'getup', 'hurt', 'strike1', 'strike2'] },
      { name: 'wizard',       key: 'wizard',       actions: ['walk', 'air_panic', 'getup', 'hurt', 'strike2', 'shield_cast'] },
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

    // Arrow projectile art -- castle archers fire the blue arrow, enemy
    // archers the wooden one. Loaded as plain images; Projectile rotates
    // the sprite to its flight direction.
    this.load.image('arrow-castle', `${assetBasePath}assets/projectiles/arrow_castle.png`);
    this.load.image('arrow-enemy', `${assetBasePath}assets/projectiles/arrow_enemy.png`);

    // Orb pulse effect -- 8 frames at 128x128. Used by BomberEnemy as a
    // one-shot explosion AND by WizardEnemy as a looping rune-body pulse.
    this.load.spritesheet('effect-orb', `${assetBasePath}assets/effects/orb_strip.png`, {
      frameWidth: 128,
      frameHeight: 128
    });

    // Heavy_knight idle pose -- a single 256x256 standing frame the walk
    // anim's frame 0 (rest pose, both feet planted) doesn't read well as.
    // Used by updateWalkAnimation's snap-back when the knight goes stationary.
    this.load.image('enemy-heavy-knight-idle', `${assetBasePath}assets/enemies/heavy_knight_idle.png`);

    // Castle defender art (blue archer holding drawn bow). Static image
    // used as the legacy fallback; the shoot strip is what drives the live
    // chibi sprite -- frame 0 is the aim/standing pose and the full 8-frame
    // anim plays each time the archer fires.
    this.load.image('defender-archer', `${assetBasePath}assets/defenders/archer_ally.png`);
    this.load.spritesheet('defender-archer-shoot', `${assetBasePath}assets/defenders/ally_archer_shoot_strip.png`, {
      frameWidth: 256,
      frameHeight: 256
    });

    this.load.image('castle-base', `${assetBasePath}assets/castle/base.png`);
    this.load.image('castle-log-trap', `${assetBasePath}assets/castle/trap.png`);

    // Wizard shield aura (looping ring around the wizard while shielded)
    // and wand blast (pulsing orb used as the wizard's projectile sprite).
    this.load.spritesheet('effect-shield', `${assetBasePath}assets/effects/shield_active_strip.png`, {
      frameWidth: 256,
      frameHeight: 256
    });
    this.load.spritesheet('effect-blast', `${assetBasePath}assets/projectiles/blast_fx_strip.png`, {
      frameWidth: 256,
      frameHeight: 256
    });

    SoundBank.preload(this, assetBasePath);
  }

  // Asset filenames use 'air_panic' but the in-engine key is just 'air'.
  private actionToKey(action: string): string {
    if (action === 'air_panic') return 'air';
    return action;
  }

  private createEnemyAnimations(): void {
    // (key suffix, frameRate, repeat) per action type. walk + air are loops;
    // strikes / hurt / getup are one-shots.
    // Walk loops 0..6: frame 7 is a near-duplicate rest pose of frame 0
    // (small pixel delta is a *pose duplicate*, not a smooth seam), so
    // including it reads as a freeze on the last frame instead of smooth
    // motion. Other anims play the full 8 frames as one-shots.
    const ACTIONS: Array<[string, number, number, number]> = [
      // [actionKey, frameRate, repeat, lastFrame]
      ['walk',    8,  -1, 6],
      ['air',    10,  -1, 7],
      ['getup',  10,   0, 7],
      ['hurt',   14,   0, 7],
      ['strike1', 14, 0, 7],
      ['strike2', 14, 0, 7],
      // Wizard-only re-shield charge: ~1.3s loop runs through the 2s cast.
      ['shield_cast', 6, -1, 7]
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
    // Orb pulse explosion: 8 frames @ 20fps so the blast feels snappy.
    if (this.textures.exists('effect-orb') && !this.anims.exists('effect-orb-pulse')) {
      this.anims.create({
        key: 'effect-orb-pulse',
        frames: this.anims.generateFrameNumbers('effect-orb', { start: 0, end: 7 }),
        frameRate: 20,
        repeat: 0
      });
    }
    // Same sheet, looping at a gentler tempo: ambient rune-button pulse.
    if (this.textures.exists('effect-orb') && !this.anims.exists('effect-orb-loop')) {
      this.anims.create({
        key: 'effect-orb-loop',
        frames: this.anims.generateFrameNumbers('effect-orb', { start: 0, end: 7 }),
        frameRate: 10,
        repeat: -1
      });
    }
    // Wizard shield active aura: ambient loop while the shield is up.
    if (this.textures.exists('effect-shield') && !this.anims.exists('effect-shield-loop')) {
      this.anims.create({
        key: 'effect-shield-loop',
        frames: this.anims.generateFrameNumbers('effect-shield', { start: 0, end: 7 }),
        frameRate: 8,
        repeat: -1
      });
    }
    // Wizard wand blast: pulsing orb the projectile sprite plays in flight.
    if (this.textures.exists('effect-blast') && !this.anims.exists('effect-blast-loop')) {
      this.anims.create({
        key: 'effect-blast-loop',
        frames: this.anims.generateFrameNumbers('effect-blast', { start: 0, end: 7 }),
        frameRate: 12,
        repeat: -1
      });
    }
    // Ally archer shoot: one-shot draw + release that ArcherSystem plays
    // on each fired arrow. Frame 0 = wind-up (used as the static idle pose).
    if (this.textures.exists('defender-archer-shoot') && !this.anims.exists('defender-archer-shoot-play')) {
      this.anims.create({
        key: 'defender-archer-shoot-play',
        frames: this.anims.generateFrameNumbers('defender-archer-shoot', { start: 0, end: 7 }),
        frameRate: 14,
        repeat: 0
      });
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
