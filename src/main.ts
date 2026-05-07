import Phaser from 'phaser';
import './style.css';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { LevelCompleteScene } from './scenes/LevelCompleteScene';
import { PauseMenuScene } from './scenes/PauseMenuScene';
import { UpgradeScene } from './scenes/UpgradeScene';
import { VictoryScene } from './scenes/VictoryScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#111827',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [
    BootScene,
    GameScene,
    UpgradeScene,
    GameOverScene,
    VictoryScene,
    LevelCompleteScene,
    PauseMenuScene
  ]
};

new Phaser.Game(config);
