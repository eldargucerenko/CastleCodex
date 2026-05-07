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
    this.add.rectangle(width / 2, height / 2, width, height, 0x93c5fd);
    this.add.rectangle(width / 2, height - groundHeight / 2, width, groundHeight, 0x65a30d);
    this.add.rectangle(width / 2, height - groundHeight - 2, width, 4, 0x365314);
    this.add.text(width - 274, 18, 'Drag enemies to throw them', {
      color: '#111827',
      fontSize: '18px',
      fontStyle: 'bold'
    });
  }

  private createUi(): void {
    this.levelText = this.add.text(14, 48, '', { color: '#111827', fontSize: '18px', fontStyle: 'bold' }).setDepth(100);
    this.hpText = this.add.text(14, 72, '', { color: '#111827', fontSize: '18px', fontStyle: 'bold' }).setDepth(100);
    this.goldText = this.add.text(14, 96, '', { color: '#111827', fontSize: '18px', fontStyle: 'bold' }).setDepth(100);
    this.enemiesText = this.add.text(14, 120, '', { color: '#111827', fontSize: '18px', fontStyle: 'bold' }).setDepth(100);
    this.refreshUi();
  }

  private refreshUi(): void {
    const enemiesLeft = this.enemies.length + this.wave.remainingQueued;
    this.levelText.setText(`Level ${this.save.currentLevel}`);
    this.hpText.setText(`Castle HP ${this.castle.currentHp}/${this.castle.maxHp}`);
    this.goldText.setText(`Gold ${this.save.gold}`);
    this.enemiesText.setText(`Enemies left ${enemiesLeft}`);
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
        hasNextLevel: this.save.currentLevel <= 10
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
