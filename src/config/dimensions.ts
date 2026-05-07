// Logical design resolution. The Phaser canvas runs at LOGICAL * RENDER_SCALE
// internal pixels so the browser supersamples instead of bilinear-stretching
// our 960x540 layout up to 1080p / retina monitors. Scenes set
// `cameras.main.setZoom(RENDER_SCALE)` so all gameplay coords keep using the
// 0..LOGICAL_W / 0..LOGICAL_H ranges they were authored at.
export const LOGICAL_W = 960;
export const LOGICAL_H = 540;
export const RENDER_SCALE = 2;
