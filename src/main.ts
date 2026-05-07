import Phaser from 'phaser';
import './style.css';
import { LOGICAL_H, LOGICAL_W, RENDER_SCALE } from './config/dimensions';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { LevelCompleteScene } from './scenes/LevelCompleteScene';
import { PauseMenuScene } from './scenes/PauseMenuScene';
import { UpgradeScene } from './scenes/UpgradeScene';
import { VictoryScene } from './scenes/VictoryScene';
import { wireAudioMuteOnHide } from './sdk/audio';

// Phaser rasterizes Text to a hidden canvas at the requested fontSize; that
// texture is then sampled when drawn. Patch the factory so every newly-
// created Text object oversamples its glyphs by RENDER_SCALE for crisp
// rendering on every monitor regardless of devicePixelRatio.
const TextFactory = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
  text: (...args: unknown[]) => Phaser.GameObjects.Text;
};
const originalTextFactory = TextFactory.text;
TextFactory.text = function patchedText(this: Phaser.GameObjects.GameObjectFactory, ...args: unknown[]) {
  const text = originalTextFactory.apply(this, args);
  text.setResolution(RENDER_SCALE);
  return text;
};

// Hook every scene as it boots: scale the main camera so layout coordinates
// authored against LOGICAL_W x LOGICAL_H render correctly on the bigger
// canvas (RENDER_SCALE x larger). World (480, 270) still draws at canvas
// center; we just have RENDER_SCALE^2 more pixels under each unit.
const scaleScene = (scene: Phaser.Scene): void => {
  scene.cameras.main.setZoom(RENDER_SCALE);
  scene.cameras.main.centerOn(LOGICAL_W / 2, LOGICAL_H / 2);
};

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  // Canvas runs at RENDER_SCALE x logical resolution so on a 1080p / 4K
  // monitor the browser downscales (supersamples) instead of bilinear-
  // upscaling our 960x540 design.
  width: LOGICAL_W * RENDER_SCALE,
  height: LOGICAL_H * RENDER_SCALE,
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
  render: {
    antialias: true,
    roundPixels: false,
    pixelArt: false
  },
  callbacks: {
    postBoot: (game) => {
      game.events.on(Phaser.Core.Events.READY, () => {
        for (const scene of game.scene.scenes) scaleScene(scene);
      });
      game.scene.scenes.forEach((scene) => {
        scene.events.on(Phaser.Scenes.Events.CREATE, () => scaleScene(scene));
      });
    }
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

// Defer Phaser boot until web fonts (Jersey 15, Inter) finish loading. With
// the Google Fonts `display=swap` directive, the first text rasterization
// otherwise bakes glyphs in the system fallback font; Phaser caches the
// resulting texture and never re-renders, leaving the game in fallback fonts
// forever. Falls back to a 1.5s cap so a blocked font CDN doesn't hang boot.
const fontsReady = document.fonts?.ready ?? Promise.resolve();
const fontDeadline = new Promise((resolve) => setTimeout(resolve, 1500));
Promise.race([fontsReady, fontDeadline]).then(() => {
  new Phaser.Game(config);
});

// Yandex Games compliance (1.6.2.7): suppress the browser context menu so
// players can't right-click and see "Save image as..." over game art.
window.addEventListener('contextmenu', (event) => event.preventDefault());

// Yandex Games compliance (1.3, 1.6.1.6, 1.6.2.5): wire the audio bridge so
// any future SFX/music auto-mute on tab switch / minimize / iOS Safari hide,
// and stay off the OS media-session surface. All audio routes through the
// Web Audio API only.
wireAudioMuteOnHide();
