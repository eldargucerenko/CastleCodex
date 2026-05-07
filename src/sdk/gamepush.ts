// GamePush SDK wrapper. The script tag in index.html sets `window.gp` once the
// SDK finishes loading and `window.__gpReady` is a Promise that resolves to it.
// Functions here are safe no-ops when the SDK is unavailable (placeholder
// project ID, blocked CDN, offline preview) so the game runs unchanged.

type AdsEvent =
  | 'start'
  | 'close'
  | 'rewarded:start'
  | 'rewarded:reward'
  | 'rewarded:close'
  | 'fullscreen:start'
  | 'fullscreen:close'
  | 'preloader:start'
  | 'preloader:close';

interface GPAds {
  showFullscreen?: () => Promise<boolean>;
  showRewardedVideo?: () => Promise<boolean>;
  showPreloader?: () => Promise<boolean>;
  isPreloaderAvailable?: boolean;
  on?: (type: AdsEvent, handler: (...args: unknown[]) => void) => void;
  off?: (type: AdsEvent, handler: (...args: unknown[]) => void) => void;
}

interface GPPlayer {
  set: (field: string, value: unknown) => void;
  get: (field: string) => unknown;
  sync?: (opts?: { override?: boolean }) => Promise<void>;
  fetch?: () => Promise<void>;
  has?: (field: string) => boolean;
  ready?: Promise<void>;
}

type SoundsEvent = 'mute' | 'unmute' | 'mute:music' | 'unmute:music' | 'mute:sfx' | 'unmute:sfx';

interface GPSounds {
  mute?: () => void;
  unmute?: () => void;
  isMuted?: boolean;
  on?: (type: SoundsEvent, handler: () => void) => void;
  off?: (type: SoundsEvent, handler: () => void) => void;
}

interface GPAnalytics {
  goal?: (name: string, value?: number) => void;
  hit?: (path: string) => void;
}

type GPGeneralEvent = 'pause' | 'resume' | 'start' | 'gameStart';

interface GPSdk {
  ads: GPAds;
  player: GPPlayer;
  sounds?: GPSounds;
  analytics?: GPAnalytics;
  language?: string;
  gameStart?: () => void | Promise<void>;
  gameplayStart?: () => void;
  gameplayStop?: () => void;
  on?: (type: GPGeneralEvent, handler: () => void) => void;
  off?: (type: GPGeneralEvent, handler: () => void) => void;
}

declare global {
  interface Window {
    gp?: GPSdk;
    __gpReady?: Promise<GPSdk>;
    onGPInit?: (gp: GPSdk) => void;
  }
}

const SAVE_FIELD = 'save';
let gp: GPSdk | null = null;

export async function initGamePush(): Promise<boolean> {
  try {
    if (!window.__gpReady) return false;
    // 5s race so a missing/blocked SDK never hangs startup.
    const ready = await Promise.race([
      window.__gpReady,
      new Promise<null>((r) => setTimeout(() => r(null), 5000))
    ]);
    if (!ready) return false;
    gp = ready;
    if (gp.ads?.isPreloaderAvailable && gp.ads.showPreloader) {
      gp.ads.showPreloader().catch(() => {
        /* ignore */
      });
    }
    return true;
  } catch {
    return false;
  }
}

export function isSdkAvailable(): boolean {
  return gp !== null;
}

// Wait for player profile to be hydrated before reading cloud save data.
export async function awaitPlayerReady(): Promise<void> {
  if (!gp?.player?.ready) return;
  await Promise.race([gp.player.ready, new Promise<void>((r) => setTimeout(r, 3000))]);
}

// Returns a Promise that resolves once gp.gameStart() (and the underlying
// platform "ready when visible" handshake) has been acknowledged by the parent
// frame. Await this before firing GameplayAPI calls so they arrive in the order
// platform debug panels expect.
export function gameLoadingReady(): Promise<void> {
  try {
    const r = gp?.gameStart?.() as unknown;
    if (r && typeof (r as Promise<void>).then === 'function') {
      return (r as Promise<void>).catch(() => {
        /* ignore */
      });
    }
    return Promise.resolve();
  } catch {
    return Promise.resolve();
  }
}

export function gameplayStart(): void {
  gp?.gameplayStart?.();
}

export function gameplayStop(): void {
  gp?.gameplayStop?.();
}

// Show a rewarded video and resolve to true only if the SDK reports the user
// finished it (so we can grant the bonus). No-op false when the SDK isn't
// available so the UI can degrade gracefully.
export async function showRewardedAd(): Promise<boolean> {
  if (!gp?.ads?.showRewardedVideo) return false;
  try {
    const result = await gp.ads.showRewardedVideo();
    return Boolean(result);
  } catch {
    return false;
  }
}

// Cloud save: stores the JSON blob in a single GamePush player field named
// 'save'. Requires a corresponding string field configured in the GP dashboard.
// Fire-and-forget — localStorage already holds the truth.
export async function cloudSave(data: Record<string, unknown>): Promise<void> {
  if (!gp?.player) return;
  try {
    gp.player.set(SAVE_FIELD, JSON.stringify(data));
    await gp.player.sync?.({ override: true });
  } catch {
    /* field may not be configured; ignore */
  }
}

export async function cloudLoad(): Promise<Record<string, unknown> | null> {
  if (!gp?.player) return null;
  try {
    const raw = gp.player.get(SAVE_FIELD);
    if (typeof raw !== 'string' || !raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Pause bridge. The platform fires these when the player taps the platform
// pause button or the platform needs the game to halt (e.g. ad about to play).
// Returns an unsubscribe function.
export function subscribeSdkPause(onChange: (paused: boolean) => void): () => void {
  if (!gp?.on || !gp.off) return () => {};
  const onPause = () => onChange(true);
  const onResume = () => onChange(false);
  gp.on('pause', onPause);
  gp.on('resume', onResume);
  return () => {
    gp?.off?.('pause', onPause);
    gp?.off?.('resume', onResume);
  };
}

// Sound bridge. GamePush certification expects mute state to flow through SDK
// methods so the platform can override (mute during ads, platform-wide toggle).
// Castle Codex has no audio yet, but the bridge is wired now so any future
// sound system can subscribe via subscribeSdkMute and call setSdkMuted.
export function getSdkMuted(): boolean | null {
  if (typeof gp?.sounds?.isMuted === 'boolean') return gp.sounds.isMuted;
  return null;
}

export function setSdkMuted(muted: boolean): void {
  if (!gp?.sounds) return;
  if (muted) gp.sounds.mute?.();
  else gp.sounds.unmute?.();
}

export function subscribeSdkMute(onChange: (muted: boolean) => void): () => void {
  const sounds = gp?.sounds;
  if (!sounds?.on || !sounds.off) return () => {};
  // Collapse all 6 mute/unmute events into a single boolean. Listening to
  // every event variant is required by the GamePush sound module spec.
  const onMute = () => onChange(true);
  const onUnmute = () => onChange(false);
  const muteEvents: SoundsEvent[] = ['mute', 'mute:music', 'mute:sfx'];
  const unmuteEvents: SoundsEvent[] = ['unmute', 'unmute:music', 'unmute:sfx'];
  muteEvents.forEach((e) => sounds.on?.(e, onMute));
  unmuteEvents.forEach((e) => sounds.on?.(e, onUnmute));
  return () => {
    muteEvents.forEach((e) => sounds.off?.(e, onMute));
    unmuteEvents.forEach((e) => sounds.off?.(e, onUnmute));
  };
}

// Analytics goals required by GamePush certification (CoolMath/Playdia
// require these explicitly). Fire-and-forget; never throws.
export function trackLevelStart(levelId: number): void {
  try {
    gp?.analytics?.goal?.('LEVEL_START', levelId);
  } catch {
    /* ignore */
  }
}

export function trackLevelReplay(levelId: number): void {
  try {
    gp?.analytics?.goal?.('LEVEL_REPLAY', levelId);
  } catch {
    /* ignore */
  }
}

export function getSdkLocale(): 'ru' | 'en' | null {
  if (!gp) return null;
  const lang = gp.language?.toLowerCase();
  if (!lang) return null;
  return lang.startsWith('ru') ? 'ru' : 'en';
}
