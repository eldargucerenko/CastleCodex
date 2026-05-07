import Phaser from 'phaser';
import './style.css';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { LevelCompleteScene } from './scenes/LevelCompleteScene';
import { PauseMenuScene } from './scenes/PauseMenuScene';
import { UpgradeScene } from './scenes/UpgradeScene';
import { VictoryScene } from './scenes/VictoryScene';
import { wireAudioMuteOnHide } from './sdk/audio';

// Render the canvas pixel buffer at devicePixelRatio so retina / high-DPI /
// 4K monitors don't bilinear-upscale a 960x540 canvas into mush. Logical
// world coords stay 960x540 and we keep them everywhere in the codebase --
// only the canvas's internal pixel count changes (zoom multiplies it).
// Cap at 3 to avoid pathological 8K canvases.
const RENDER_DPR = Math.min(window.devicePixelRatio || 1, 3);

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
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: RENDER_DPR
  },
  render: {
    antialias: true,
    roundPixels: true,
    pixelArt: false
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

// Yandex Games compliance (1.6.2.7): suppress the browser context menu so
// players can't right-click and see "Save image as..." over game art.
window.addEventListener('contextmenu', (event) => event.preventDefault());

// Yandex Games compliance (1.3, 1.6.1.6, 1.6.2.5): wire the audio bridge so
// any future SFX/music auto-mute on tab switch / minimize / iOS Safari hide,
// and stay off the OS media-session surface. All audio routes through the
// Web Audio API only.
wireAudioMuteOnHide();
