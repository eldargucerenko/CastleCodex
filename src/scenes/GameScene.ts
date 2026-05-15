import Phaser from 'phaser';
import { Castle } from '../entities/Castle';
import type { Enemy } from '../entities/Enemy';
import { gameplayStart, gameplayStop, subscribeSdkPause, trackLevelStart } from '../sdk/gamepush';
import { CURSOR_BLOCKED, CURSOR_OPEN } from '../config/cursors';
import { CursorDebuff } from '../systems/CursorDebuff';
import { ArcherSystem } from '../systems/ArcherSystem';
import { DebugPanelUI } from '../systems/DebugPanelUI';
import { DragThrowSystem } from '../systems/DragThrowSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { MageSystem } from '../systems/MageSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { SoundBank } from '../systems/SoundBank';
import { TrapSystem } from '../systems/TrapSystem';
import { WaveManager } from '../systems/WaveManager';
import type { EnemyKind, SaveData } from '../types/game';
import { RollingLog } from '../entities/RollingLog';
import { TutorialSystem } from '../systems/TutorialSystem';
import { ENEMY_STATS } from '../data/enemies';
import { COLORS, FONTS, HEX, makeBar, makePanel } from '../ui/theme';
import { PauseMenuScene } from './PauseMenuScene';
import { LOGICAL_W, LOGICAL_H } from '../config/dimensions';

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
  private redrawSoundIcon?: (muted: boolean) => void;
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
      this.rollingLog = new RollingLog(this, this.castle, () => this.enemies, () => this.consumeRollingLog());
    }
    this.createUi();
    this.maybeStartTutorial();
    this.levelStartedAt = Date.now();
    DebugPanelUI.ensureMounted({
      spawnHandler: (kind) => this.spawnDebugEnemy(kind),
      getSpawnEnabled: () => this.scene.isActive() && !this.finishing,
      getCastleHp: () => ({ current: this.castle.currentHp, max: this.castle.maxHp }),
      // Cheat: allow above-max HP. If hp > maxHp, bump maxHp too so the HP
      // bar's 100% mark grows with you instead of overflowing the bar.
      setCastleHp: (hp) => {
        const v = Math.max(0, Math.round(hp));
        if (v > this.castle.maxHp) this.castle.maxHp = v;
        this.castle.currentHp = v;
      }
    });
    this.wireSdkLifecycle();
    this.wirePauseMenu();
    // Open gauntlet is the resting cursor; DragThrowSystem swaps in the
    // closed fist while an enemy is grabbed, and CursorDebuff hides it.
    this.input.setDefaultCursor(CURSOR_OPEN);
    this.wireCursorOverlay();
    SoundBank.syncMute(this);
  }

  private cursorOverlay?: Phaser.GameObjects.Container;
  private cursorOverlayText?: Phaser.GameObjects.Text;

  private cursorDebuffActive = false;

  private updateCursorOverlay(): void {
    if (!this.cursorOverlay || !this.cursorOverlayText) return;
    const active = CursorDebuff.isActive(this.time.now);
    if (active) {
      const p = this.input.activePointer;
      // Sit the countdown next to the cursor, not on top of it: the gauntlet
      // texture is ~64x64 with the hotspot at the palm, so an offset of
      // (+22, -26) puts the readout up-and-to-the-right of the hand.
      this.cursorOverlay.setPosition(p.worldX + 22, p.worldY - 26);
      this.cursorOverlay.setVisible(true);
      const remainingMs = CursorDebuff.remainingMs(this.time.now);
      this.cursorOverlayText.setText(`${(remainingMs / 1000).toFixed(1)}s`);
    } else if (this.cursorOverlay.visible) {
      this.cursorOverlay.setVisible(false);
    }
    if (active && !this.cursorDebuffActive) {
      this.input.setDefaultCursor(CURSOR_BLOCKED);
      this.cursorDebuffActive = true;
    } else if (!active && this.cursorDebuffActive) {
      this.input.setDefaultCursor(CURSOR_OPEN);
      this.cursorDebuffActive = false;
    }
  }

  private wireCursorOverlay(): void {
    // Just a small "X.Xs" countdown floating beside the blocked-cursor
    // texture. The texture itself communicates "blocked"; the text says
    // how much longer for.
    const timerText = this.add
      .text(0, 0, '', {
        color: '#fde68a',
        fontFamily: 'Jersey 15, monospace',
        fontSize: '16px',
        stroke: '#1f1235',
        strokeThickness: 4
      })
      .setOrigin(0.5);

    const container = this.add
      .container(0, 0, [timerText])
      .setDepth(950)
      .setVisible(false);

    this.cursorOverlay = container;
    this.cursorOverlayText = timerText;

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.setDefaultCursor('default');
      this.cursorDebuffActive = false;
    });
  }

  private wirePauseMenu(): void {
    this.input.keyboard?.on('keydown-ESC', () => this.openPauseMenu());
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      if (!this.finishing) gameplayStart();
      // Sync the HUD sound icon with whatever the pause menu may have
      // toggled while we were paused.
      this.redrawSoundIcon?.(PauseMenuScene.loadMuted());
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
        if (!this.scene.isPaused()) this.scene.pause();
      } else {
        // Don't auto-resume if the player has the in-game pause menu up --
        // an SDK resume (e.g. ad finished) would otherwise unpause the game
        // underneath the menu and let waves keep running while paused.
        if (this.scene.isActive('PauseMenuScene')) return;
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
    const width = LOGICAL_W;
    const groundY = LOGICAL_H - 72;
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
      enemy.updateStateAnimations();
      enemy.updateWalkAnimation();
      enemy.updateGroundShadow();
    }

    this.collectDeadEnemies();
    this.refreshUi();
    this.updateCursorOverlay();

    if (this.castle.currentHp <= 0) {
      this.finishAsGameOver();
      return;
    }

    if (this.wave.doneSpawning && this.enemies.length === 0) {
      this.completeLevel();
    }
  }

  private createWorld(): void {
    const width = LOGICAL_W;
    const height = LOGICAL_H;
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
    // Tiny enemy silhouette (head + two eye dots) at the right edge of the
    // panel, with the count to its left so the wave label has room to breathe.
    const foeIcon = this.add.graphics();
    foeIcon.setDepth(depth);
    const foeIconX = 252;
    const foeIconY = 28;
    foeIcon.fillStyle(COLORS.ink700, 1);
    foeIcon.fillCircle(foeIconX, foeIconY, 8);
    foeIcon.fillStyle(0xffffff, 1);
    foeIcon.fillCircle(foeIconX - 3, foeIconY - 1, 1.6);
    foeIcon.fillCircle(foeIconX + 3, foeIconY - 1, 1.6);
    this.enemiesText = this.add
      .text(foeIconX - 12, 28, '', { fontFamily: FONTS.display, fontSize: '16px', color: HEX.ink900 })
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
    const w = LOGICAL_W;
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
    this.redrawSoundIcon = draw;

    // No useHandCursor: the gauntlet cursor already reads as a clickable
    // hand, and Phaser's 'pointer' would override it back to the OS arrow.
    bg.setInteractive();
    bg.on('pointerover', () => bg.setFillStyle(COLORS.parchment100));
    bg.on('pointerout', () => bg.setFillStyle(COLORS.parchment200));
    bg.on('pointerdown', () => {
      const next = !PauseMenuScene.loadMuted();
      // Play the click *before* the mute flip so the user gets feedback
      // that they just turned sound off (the next sound wouldn't play).
      SoundBank.play(this, 'ui_click');
      SoundBank.setMuted(this, next);
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
    bg.setInteractive();
    bg.on('pointerover', () => bg.setFillStyle(COLORS.parchment100));
    bg.on('pointerout', () => bg.setFillStyle(COLORS.parchment200));
    bg.on('pointerdown', () => {
      SoundBank.play(this, 'ui_click');
      this.openPauseMenu();
    });
    return c;
  }

  private refreshUi(): void {
    const enemiesLeft = this.enemies.length + this.wave.remainingQueued;
    this.levelText.setText(`${this.save.currentLevel} / 10`);
    this.hpText.setText(`${this.castle.currentHp}/${this.castle.maxHp}`);
    this.goldText.setText(`${this.save.gold}`);
    this.enemiesText.setText(`${enemiesLeft}`);
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
        SoundBank.play(this, 'coin');
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
    this.floatText(LOGICAL_W / 2, 170, `Level clear +${reward}g`, '#14532d');
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
