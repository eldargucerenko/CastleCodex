import Phaser from 'phaser';
import { Castle } from '../entities/Castle';
import type { Enemy } from '../entities/Enemy';
import { gameplayStart, gameplayStop, subscribeSdkPause, trackLevelStart } from '../sdk/gamepush';
import { ArcherSystem } from '../systems/ArcherSystem';
import { DebugPanelUI } from '../systems/DebugPanelUI';
import { DragThrowSystem } from '../systems/DragThrowSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { MageSystem } from '../systems/MageSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { TrapSystem } from '../systems/TrapSystem';
import { WaveManager } from '../systems/WaveManager';
import type { EnemyKind, SaveData } from '../types/game';
import { RollingLog } from '../entities/RollingLog';
import { TutorialSystem } from '../systems/TutorialSystem';
import { ENEMY_STATS } from '../data/enemies';
import { COLORS, FONTS, HEX, makeBar, makePanel } from '../ui/theme';
import { PauseMenuScene } from './PauseMenuScene';

export class GameScene extends Phaser.Scene {
  private save!: SaveData;
  private castle!: Castle;
  private wave!: WaveManager;
  private dragSystem!: DragThrowSystem;
  private archerSystem!: ArcherSystem;
  private trapSystem!: TrapSystem;
  private mageSystem!: MageSystem;
  private rollingLog?: RollingLog;
  private tutorial?: TutorialSystem;
  private enemies: Enemy[] = [];
  private killed = 0;
  private finishing = false;
  private levelText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private enemiesText!: Phaser.GameObjects.Text;
  private hpBar?: ReturnType<typeof makeBar>;
  private saveAtLevelStart?: SaveData;
  private hasTemporaryLevelOneArcher = false;
  private hasTemporaryLevelOneMage = false;
  private hasTemporaryLevelOneLog = false;
  private levelStartedAt = 0;
  private unsubscribePause?: () => void;
  private onVisibilityChange?: () => void;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.save = SaveSystem.load();
    // Snapshot the pre-level save so Replay can restore gold and defender HP.
    this.saveAtLevelStart = JSON.parse(JSON.stringify(this.save)) as SaveData;
    this.enemies = [];
    this.killed = 0;
    this.finishing = false;
    const tutorialPending = !this.save.tutorialCompleted && this.save.currentLevel === 1;
    this.hasTemporaryLevelOneArcher = !tutorialPending && this.save.currentLevel === 1 && this.save.archerLevel <= 0;
    this.hasTemporaryLevelOneMage = !tutorialPending && this.save.currentLevel === 1 && this.save.mageLevel <= 0;
    this.hasTemporaryLevelOneLog = !tutorialPending && this.save.currentLevel === 1 && this.save.logTrapCount <= 0;
    const effectiveMageLevel = this.hasTemporaryLevelOneMage ? 1 : this.save.mageLevel;
    const effectiveLogTrapCount = this.hasTemporaryLevelOneLog ? 1 : this.save.logTrapCount;

    this.createWorld();
    this.castle = new Castle(this, {
      ...this.save,
      archerLevel: this.hasTemporaryLevelOneArcher ? 1 : this.save.archerLevel,
      mageLevel: effectiveMageLevel,
      logTrapCount: effectiveLogTrapCount
    });
    this.wave = new WaveManager(this, this.save.currentLevel, (enemy) => this.enemies.push(enemy));
    this.dragSystem = new DragThrowSystem(this, this.castle, () => this.enemies);
    this.archerSystem = new ArcherSystem(this, this.castle, () => this.enemies);
    this.trapSystem = new TrapSystem(this, this.castle.trapLevel, () => this.enemies);
    this.mageSystem = new MageSystem(this, this.castle, this.castle.mageLevel, () => this.enemies);
    if (effectiveLogTrapCount > 0) {
      this.rollingLog = new RollingLog(this, () => this.enemies, () => this.consumeRollingLog());
    }
    this.createUi();
    this.maybeStartTutorial();
    this.levelStartedAt = Date.now();
    DebugPanelUI.ensureMounted({
      spawnHandler: (kind) => this.spawnDebugEnemy(kind),
      getSpawnEnabled: () => this.scene.isActive() && !this.finishing
    });
    this.wireSdkLifecycle();
    this.wirePauseMenu();
  }

  private wirePauseMenu(): void {
    this.input.keyboard?.on('keydown-ESC', () => this.openPauseMenu());
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      if (!this.finishing) gameplayStart();
    });
  }

  private openPauseMenu(): void {
    if (this.finishing) return;
    if (this.scene.isPaused()) return;
    if (this.scene.isActive('PauseMenuScene')) return;
    gameplayStop();
    this.scene.launch('PauseMenuScene', { fromScene: 'GameScene' });
    this.scene.pause();
  }

  private wireSdkLifecycle(): void {
    trackLevelStart(this.save.currentLevel);
    gameplayStart();

    this.unsubscribePause = subscribeSdkPause((paused) => {
      if (paused) {
        gameplayStop();
        this.scene.pause();
      } else {
        this.scene.resume();
        gameplayStart();
      }
    });

    this.onVisibilityChange = () => {
      if (document.hidden) {
        gameplayStop();
      } else if (this.scene.isActive() && !this.finishing) {
        gameplayStart();
      }
    };
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      gameplayStop();
      this.unsubscribePause?.();
      this.unsubscribePause = undefined;
      if (this.onVisibilityChange) {
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
        this.onVisibilityChange = undefined;
      }
    });
  }

  private spawnDebugEnemy(kind: EnemyKind): void {
    if (this.finishing) return;
    this.wave.spawnFromEdge(kind);
  }

  private maybeStartTutorial(): void {
    if (this.save.tutorialCompleted || this.save.currentLevel !== 1) return;
    this.wave.pause();
    this.setStatsUiVisible(false);
    this.tutorial = new TutorialSystem(
      this,
      this.castle,
      () => this.spawnTutorialKnight(),
      () => this.finishTutorial()
    );
  }

  private setStatsUiVisible(visible: boolean): void {
    this.levelText?.setVisible(visible);
    this.hpText?.setVisible(visible);
    this.goldText?.setVisible(visible);
    this.enemiesText?.setVisible(visible);
  }

  private spawnTutorialKnight(): Enemy {
    const width = Number(this.game.config.width);
    const groundY = Number(this.game.config.height) - 72;
    const stats = ENEMY_STATS.basic;
    const x = Math.round(width * 0.62);
    const y = groundY - stats.radius;
    return this.wave.spawnAt('basic', x, y, groundY);
  }

  private finishTutorial(): void {
    this.tutorial = undefined;
    this.save.tutorialCompleted = true;
    SaveSystem.save(this.save);
    this.wave.resume();
    this.setStatsUiVisible(true);
  }

  update(_time: number, delta: number): void {
    if (this.finishing) return;
    // Use the scene-local clock (this.time.now) instead of the game loop clock
    // (the `time` argument). The scene clock pauses when scene.pause() is
    // called by the GamePush platform-pause handler, so attack-rate / spawn /
    // shot timestamps don't jump forward when the game resumes.
    const time = this.time.now;
    this.wave.update(time);
    this.tutorial?.update();
    this.archerSystem.update(time);
    this.trapSystem.update(time);
    this.mageSystem.update(time);
    this.rollingLog?.update(time, delta);

    for (const enemy of this.enemies) {
      enemy.updateEnemy(time, delta, this.castle, this.enemies);
    }

    this.collectDeadEnemies();
    this.refreshUi();

    if (this.castle.currentHp <= 0) {
      this.finishAsGameOver();
      return;
    }

    if (this.wave.doneSpawning && this.enemies.length === 0) {
      this.completeLevel();
    }
  }

  private createWorld(): void {
    const width = Number(this.game.config.width);
    const height = Number(this.game.config.height);
    const groundHeight = 124;
    const horizonY = height - groundHeight;

    // Sky: cool blue at top fading to warm sand near the horizon.
    const sky = this.add.graphics();
    sky.fillGradientStyle(COLORS.skyTop, COLORS.skyTop, COLORS.skyMid, COLORS.skyMid, 1, 1, 1, 1);
    sky.fillRect(0, 0, width, horizonY);

    // Sun, top-right area.
    this.add
      .circle(width - 200, 92, 32, COLORS.gold400)
      .setAlpha(0.9);
    this.add
      .circle(width - 200, 92, 44, COLORS.gold400, 0.18);

    // Drifting clouds - soft pill shapes.
    this.makeCloud(160, 90, 80, 16);
    this.makeCloud(140, 102, 120, 14);
    this.makeCloud(580, 130, 90, 14);

    // Distant hills as a polygon silhouette in front of the sky.
    const hills = this.add.graphics();
    hills.fillStyle(0x7a9a78, 1);
    hills.beginPath();
    hills.moveTo(0, horizonY);
    hills.lineTo(0, horizonY - 36);
    hills.lineTo(width * 0.15, horizonY - 70);
    hills.lineTo(width * 0.3, horizonY - 40);
    hills.lineTo(width * 0.45, horizonY - 78);
    hills.lineTo(width * 0.6, horizonY - 44);
    hills.lineTo(width * 0.8, horizonY - 82);
    hills.lineTo(width, horizonY - 50);
    hills.lineTo(width, horizonY);
    hills.closePath();
    hills.fillPath();

    // Ground band - top stripe is a touch lighter for soft horizon banding.
    this.add.rectangle(width / 2, horizonY + groundHeight / 2, width, groundHeight, COLORS.groundTop);
    this.add.rectangle(width / 2, horizonY - 1, width, 3, COLORS.groundBot);
    this.add.rectangle(width / 2, horizonY + groundHeight - 4, width, 6, COLORS.groundBot, 0.6);
  }

  private makeCloud(x: number, y: number, w: number, h: number): void {
    const cloud = this.add.rectangle(x, y, w, h, 0xfdf6e3, 0.85);
    cloud.setOrigin(0.5);
    // Two end-caps to fake a rounded pill shape with rectangles only.
    this.add.circle(x - w / 2, y, h / 2, 0xfdf6e3, 0.85);
    this.add.circle(x + w / 2, y, h / 2, 0xfdf6e3, 0.85);
    void cloud;
  }

  private createUi(): void {
    const depth = 100;

    // TOP-LEFT: Wave panel + Castle HP panel
    makePanel(this, 150, 28, 264, 36).setDepth(depth);
    const waveBadge = this.add.rectangle(40, 28, 56, 22, COLORS.ink900).setStrokeStyle(2, COLORS.ink900);
    waveBadge.setDepth(depth);
    this.add
      .text(40, 28, 'WAVE', { fontFamily: FONTS.display, fontSize: '14px', color: HEX.gold400 })
      .setOrigin(0.5)
      .setDepth(depth);
    this.levelText = this.add
      .text(82, 28, '', { fontFamily: FONTS.display, fontSize: '22px', color: HEX.ink900 })
      .setOrigin(0, 0.5)
      .setDepth(depth);
    this.enemiesText = this.add
      .text(265, 28, '', { fontFamily: FONTS.display, fontSize: '14px', color: HEX.ink700 })
      .setOrigin(1, 0.5)
      .setDepth(depth);

    // HP panel (below wave panel)
    makePanel(this, 150, 76, 264, 44).setDepth(depth);
    this.add
      .text(20, 64, 'CASTLE HP', { fontFamily: FONTS.body, fontSize: '10px', color: HEX.ink500 })
      .setOrigin(0, 0.5)
      .setDepth(depth);
    this.hpText = this.add
      .text(265, 64, '', { fontFamily: FONTS.display, fontSize: '14px', color: HEX.ink900 })
      .setOrigin(1, 0.5)
      .setDepth(depth);
    this.hpBar = makeBar(this, 150, 86, 248, 12, COLORS.ember500);
    this.hpBar.setProgress(1);
    this.hpBar.container.setDepth(depth);

    // TOP-RIGHT cluster: gold panel * sound * pause, anchored from right edge.
    const w = Number(this.game.config.width);
    const rightPad = 12;
    const iconSize = 32;
    const gap = 8;

    const pauseCenterX = w - rightPad - iconSize / 2;
    const soundCenterX = pauseCenterX - iconSize - gap;

    // Gold panel sits left of the icon cluster.
    const goldPanelW = 130;
    const goldPanelRight = soundCenterX - iconSize / 2 - gap;
    const goldPanelCenterX = goldPanelRight - goldPanelW / 2;
    makePanel(this, goldPanelCenterX, 28, goldPanelW, iconSize).setDepth(depth);
    const coinX = goldPanelCenterX - goldPanelW / 2 + 18;
    const coin = this.add.graphics();
    coin.fillStyle(COLORS.gold400, 1);
    coin.fillCircle(coinX, 28, 9);
    coin.lineStyle(2, COLORS.ink900);
    coin.strokeCircle(coinX, 28, 9);
    coin.lineStyle(1, COLORS.ink900);
    coin.strokeCircle(coinX, 28, 5);
    coin.setDepth(depth);
    this.goldText = this.add
      .text(goldPanelCenterX + goldPanelW / 2 - 12, 28, '', {
        fontFamily: FONTS.display,
        fontSize: '20px',
        color: HEX.ink900
      })
      .setOrigin(1, 0.5)
      .setDepth(depth);

    const soundButton = this.makeSoundButton(soundCenterX, 28, iconSize);
    soundButton.setDepth(depth);

    this.makePauseButton(pauseCenterX, 28, iconSize).setDepth(depth);

    this.refreshUi();
  }

  private makeSoundButton(x: number, y: number, size: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const bg = this.add
      .rectangle(0, 0, size, size, COLORS.parchment200)
      .setStrokeStyle(3, COLORS.ink700);
    const icon = this.add.graphics();
    c.add([bg, icon]);

    const draw = (muted: boolean) => {
      icon.clear();
      icon.lineStyle(2, COLORS.ink700);
      icon.fillStyle(COLORS.ink700, 1);
      // Speaker body: small rectangle on the left + triangular cone on the right.
      icon.fillRect(-8, -3, 4, 6);
      icon.beginPath();
      icon.moveTo(-4, -6);
      icon.lineTo(2, -8);
      icon.lineTo(2, 8);
      icon.lineTo(-4, 6);
      icon.closePath();
      icon.fillPath();
      if (muted) {
        icon.lineStyle(2.5, COLORS.ember500);
        icon.lineBetween(-9, -9, 9, 9);
      } else {
        // Two arcs to suggest sound waves.
        icon.lineStyle(2, COLORS.ink700);
        icon.beginPath();
        icon.arc(2, 0, 5, -0.7, 0.7);
        icon.strokePath();
        icon.beginPath();
        icon.arc(2, 0, 8, -0.6, 0.6);
        icon.strokePath();
      }
    };
    draw(PauseMenuScene.loadMuted());

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(COLORS.parchment100));
    bg.on('pointerout', () => bg.setFillStyle(COLORS.parchment200));
    bg.on('pointerdown', () => {
      const next = !PauseMenuScene.loadMuted();
      PauseMenuScene.saveMuted(next);
      draw(next);
    });
    return c;
  }

  private makePauseButton(x: number, y: number, size: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const bg = this.add
      .rectangle(0, 0, size, size, COLORS.parchment200)
      .setStrokeStyle(3, COLORS.ink700);
    const icon = this.add.graphics();
    icon.fillStyle(COLORS.ink700, 1);
    icon.fillRect(-6, -7, 4, 14);
    icon.fillRect(2, -7, 4, 14);
    c.add([bg, icon]);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(COLORS.parchment100));
    bg.on('pointerout', () => bg.setFillStyle(COLORS.parchment200));
    bg.on('pointerdown', () => this.openPauseMenu());
    return c;
  }

  private refreshUi(): void {
    const enemiesLeft = this.enemies.length + this.wave.remainingQueued;
    this.levelText.setText(`${this.save.currentLevel} / 10`);
    this.hpText.setText(`${this.castle.currentHp}/${this.castle.maxHp}`);
    this.goldText.setText(`${this.save.gold}`);
    this.enemiesText.setText(`Enemies: ${enemiesLeft}`);
    if (this.castle.maxHp > 0) {
      this.hpBar?.setProgress(this.castle.currentHp / this.castle.maxHp);
    }
  }

  private collectDeadEnemies(): void {
    const survivors: Enemy[] = [];
    for (const enemy of this.enemies) {
      if (enemy.justDied || !enemy.alive) {
        this.killed += 1;
        this.save.gold += enemy.stats.killReward;
        this.floatText(enemy.x, enemy.y, `+${enemy.stats.killReward}g`, '#facc15');
        enemy.destroy();
      } else {
        survivors.push(enemy);
      }
    }
    this.enemies = survivors;
  }

  private completeLevel(): void {
    this.finishing = true;
    const reward = EconomySystem.levelCompleteReward(this.save.currentLevel);
    const levelCompleted = this.save.currentLevel;
    const elapsedMs = Date.now() - this.levelStartedAt;
    this.save.gold += reward;
    this.save.completedLevels = Math.max(this.save.completedLevels, this.save.currentLevel);
    this.save.currentLevel += 1;
    Object.assign(this.save, this.castle.toProgress());
    if (this.hasTemporaryLevelOneArcher) {
      this.save.archerLevel = 0;
      this.save.archerHp = [];
    }
    if (this.hasTemporaryLevelOneMage) {
      this.save.mageLevel = 0;
      this.save.mageHp = undefined;
    }
    if (this.hasTemporaryLevelOneLog) {
      this.save.logTrapCount = 0;
    }
    SaveSystem.save(this.save);
    this.floatText(Number(this.game.config.width) / 2, 170, `Level clear +${reward}g`, '#14532d');
    this.time.delayedCall(900, () => {
      this.cleanupSystems();
      this.scene.start('LevelCompleteScene', {
        levelCompleted,
        baseReward: reward,
        elapsedMs,
        hasNextLevel: this.save.currentLevel <= 10,
        hpRemaining: this.save.currentHp,
        hpMax: this.save.maxHp,
        saveBeforeLevel: this.saveAtLevelStart
      });
    });
  }

  private finishAsGameOver(): void {
    this.finishing = true;
    Object.assign(this.save, this.castle.toProgress());
    if (this.hasTemporaryLevelOneArcher) {
      this.save.archerLevel = 0;
      this.save.archerHp = [];
    }
    if (this.hasTemporaryLevelOneMage) {
      this.save.mageLevel = 0;
      this.save.mageHp = undefined;
    }
    if (this.hasTemporaryLevelOneLog) {
      this.save.logTrapCount = 0;
    }
    SaveSystem.save(this.save);
    this.cleanupSystems();
    this.scene.start('GameOverScene');
  }

  private cleanupSystems(): void {
    this.dragSystem?.destroy();
    this.tutorial?.destroy();
    this.tutorial = undefined;
  }

  private consumeRollingLog(): void {
    this.save.logTrapCount = 0;
    this.castle.logTrapCount = 0;
    Object.assign(this.save, this.castle.toProgress(), { logTrapCount: 0 });
    SaveSystem.save(this.save);
  }

  private floatText(x: number, y: number, value: string, color: string): void {
    const text = this.add.text(x, y, value, { color, fontSize: '18px', fontStyle: 'bold' }).setOrigin(0.5).setDepth(200);
    this.tweens.add({
      targets: text,
      y: y - 34,
      alpha: 0,
      duration: 720,
      onComplete: () => text.destroy()
    });
  }
}
