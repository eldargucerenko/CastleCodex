// Yandex Games compliance (1.6.1.6, 1.6.2.5, 1.3, 4.7).
//
// The Web Audio API is required. The legacy DOM media element and its
// programmatic constructor both register with Chrome's MediaSession, which
// surfaces in the Android notification panel and the Windows / macOS system
// media controls. Yandex rejects games that show up there. AudioContext and
// AudioBufferSourceNode do not expose to MediaSession.
//
// Castle Codex doesn't ship audio assets yet, but the bridge is wired so
// future SFX/music plug into masterGain and inherit the mute hooks.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let muted = false;

function ensureContext(): void {
  if (ctx) return;
  const Ctx = (window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as
    | typeof AudioContext
    | undefined;
  if (!Ctx) return;
  try {
    ctx = new Ctx();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(ctx.destination);
  } catch {
    /* ignore */
  }
}

export function getMasterGainNode(): GainNode | null {
  ensureContext();
  return masterGain;
}

export function muteAudio(): void {
  muted = true;
  if (masterGain) masterGain.gain.value = 0;
  void ctx?.suspend();
}

export function unmuteAudio(): void {
  muted = false;
  if (masterGain) masterGain.gain.value = 1;
  void ctx?.resume();
}

// Wire the global lifecycle listeners that satisfy rule 1.3. visibilitychange
// covers desktop tab-switch and Android background. iOS Safari minimize fires
// pagehide / blur reliably but visibilitychange may not, so we listen to
// both. pageshow / focus mirror the resume side.
export function wireAudioMuteOnHide(): void {
  ensureContext();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) muteAudio();
    else unmuteAudio();
  });
  window.addEventListener('pagehide', muteAudio);
  window.addEventListener('blur', muteAudio);
  window.addEventListener('pageshow', unmuteAudio);
  window.addEventListener('focus', unmuteAudio);
}
