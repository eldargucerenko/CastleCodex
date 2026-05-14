// Medieval gauntlet cursors. The open hand is the resting cursor; the closed
// fist shows while an enemy is grabbed. Both share hotspot (32,28) -- the palm
// center of the 64x64 art -- so the cursor doesn't visibly jump when the hand
// closes on a grab. CSS fallbacks ('default' / 'grabbing') cover the brief
// window before the image loads and any browser that rejects the PNG.
function assetBase(): string {
  if (window.location.hostname.endsWith('github.io')) {
    const repo = window.location.pathname.split('/').filter(Boolean)[0];
    return repo ? `/${repo}/` : '/';
  }
  return './';
}

const HOTSPOT = '32 28';
export const CURSOR_OPEN = `url(${assetBase()}assets/ui/cursor_gauntlet_open.png) ${HOTSPOT}, default`;
export const CURSOR_CLOSED = `url(${assetBase()}assets/ui/cursor_gauntlet_closed.png) ${HOTSPOT}, grabbing`;
