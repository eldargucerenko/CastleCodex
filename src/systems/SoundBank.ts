import Phaser from 'phaser';
import { PauseMenuScene } from '../scenes/PauseMenuScene';

// Per-sound default volume so loud + quiet source files balance out.
// Tweak these when audition reveals imbalance; trigger sites stay untouched.
const VOLUMES: Record<string, number> = {
  grab: 0.7,
  throw: 0.7,
  fall: 0.8,
  death: 1.0,
  coin: 0.5,
  castle_damage: 0.8,
  ui_click: 0.6,
  victory: 0.9
};

// Filename per key, relative to public/assets/audio/. Listed once so adding
// a new sound only touches this map + a single trigger site.
const FILES: Record<string, string> = {
  grab: 'grab.ogg',
  throw: 'throw.wav',
  fall: 'fall.wav',
  death: 'death.wav',
  coin: 'coin_pickup.mp3',
  castle_damage: 'castle_damage.wav',
  ui_click: 'ui_click.wav',
  victory: 'victory.wav'
};

// Per-key last-play timestamps so high-frequency triggers (coin pickup on
// multi-kill bursts, repeated wall bounces) can't stack into a buzzy mess.
const lastPlayedAt: Record<string, number> = {};

// Default min-gap between repeats per key (ms). Lookup falls back to 0.
// `grab` guards against touch/mouse hybrid pointerdown firing twice for one
// user click -- the duplicate would layer two buffers and read as a doubled
// blip. 80ms is short enough that two intentional grabs in sequence still
// each play (you can't release-and-regrab faster than that anyway).
const MIN_GAP_MS: Record<string, number> = {
  grab: 80,
  coin: 60,
  fall: 90,
  castle_damage: 80
};

export const SoundBank = {
  preload(scene: Phaser.Scene, basePath: string): void {
    for (const [key, file] of Object.entries(FILES)) {
      if (scene.cache.audio.exists(key)) continue;
      scene.load.audio(key, `${basePath}assets/audio/${file}`);
    }
  },

  // Sync Phaser's global sound mute with persisted state. Call from each
  // scene's create() so a reload or scene-swap honors the saved mute.
  syncMute(scene: Phaser.Scene): void {
    SoundBank.setMuted(scene, PauseMenuScene.loadMuted());
  },

  // Single chokepoint for muting/unmuting. Bypasses Phaser's mute setter,
  // which is broken: it calls `setValueAtTime(value, 0)` on the master
  // gain, and once `audioContext.currentTime > 0` (i.e. always after the
  // first frame) that scheduled event is in the past and silently no-ops.
  // The gain never changes, so `sound.mute = true` doesn't actually mute,
  // and our own play() guards that read `sound.mute` get nonsense.
  //
  // We grab the master gain node directly, cancel any scheduled automation,
  // and assign `.value`. Phaser's getter then reads the gain back correctly
  // (it returns `gain.value === 0`) and everything else just works.
  setMuted(scene: Phaser.Scene, muted: boolean): void {
    PauseMenuScene.saveMuted(muted);
    const node = (scene.sound as unknown as { masterMuteNode?: GainNode }).masterMuteNode;
    if (node) {
      node.gain.cancelScheduledValues(0);
      node.gain.value = muted ? 0 : 1;
    } else {
      // Non-WebAudio backend (HTML5Audio fallback) -- setter works there.
      scene.sound.mute = muted;
    }
    if (!muted) {
      const ctx = (scene.sound as unknown as { context?: AudioContext }).context;
      if (ctx && ctx.state === 'suspended') void ctx.resume();
    }
  },

  play(scene: Phaser.Scene, key: keyof typeof VOLUMES | string): void {
    if (!scene.sound || scene.sound.mute) return;
    const now = scene.time.now;
    const gap = MIN_GAP_MS[key] ?? 0;
    if (gap > 0 && now - (lastPlayedAt[key] ?? -Infinity) < gap) return;
    lastPlayedAt[key] = now;
    try {
      scene.sound.play(key, { volume: VOLUMES[key] ?? 0.8 });
    } catch {
      /* the asset may not be loaded yet in early-boot scenes; swallow */
    }
  }
};
