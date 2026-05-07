import Phaser from 'phaser';

// Dusk palette — locked in by the design handoff. Storybook parchment with
// cool-blue accents for magic/ad and gold for currency/primary actions.
export const COLORS = {
  parchment100: 0xfbf2dc,
  parchment200: 0xd4c098,
  parchment300: 0xb89c70,
  parchment400: 0x8a7048,
  ink900: 0x1a0e08,
  ink700: 0x3a1f10,
  ink500: 0x5a3018,
  ink300: 0xa87038,
  gold500: 0xd4a040,
  gold400: 0xe8b858,
  gold600: 0x9c6f1c,
  azure500: 0x4a5878,
  azure600: 0x2a5485,
  moss500: 0x5a8c3e,
  moss600: 0x3f6929,
  ember500: 0xa83820,
  ember600: 0x8a3220,
  bone100: 0xfdf8e8,
  skyTop: 0xc8d8e8,
  skyMid: 0xd8c8a8,
  groundTop: 0x5a8c3e,
  groundBot: 0x3f6929,
  nightBg: 0x1d2233
} as const;

export const HEX = {
  parchment100: '#fbf2dc',
  parchment200: '#d4c098',
  parchment300: '#b89c70',
  parchment400: '#8a7048',
  ink900: '#1a0e08',
  ink700: '#3a1f10',
  ink500: '#5a3018',
  ink300: '#a87038',
  gold500: '#d4a040',
  gold400: '#e8b858',
  gold600: '#9c6f1c',
  azure500: '#4a5878',
  azure600: '#2a5485',
  moss500: '#5a8c3e',
  moss600: '#3f6929',
  ember500: '#a83820',
  ember600: '#8a3220',
  bone100: '#fdf8e8'
} as const;

export const FONTS = {
  display: '"Jersey 15", "Press Start 2P", monospace',
  body: 'Inter, system-ui, sans-serif'
} as const;

export interface PanelOptions {
  fill?: number;
  border?: number;
  borderWidth?: number;
  inner?: number;
  alpha?: number;
}

// Builds a parchment panel: outer border + inner highlight stroke. Mirrors the
// 9-slice look from tokens.css (.cc-panel) using two stacked rectangles.
export function makePanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: PanelOptions = {}
): Phaser.GameObjects.Container {
  const fill = opts.fill ?? COLORS.parchment200;
  const border = opts.border ?? COLORS.ink700;
  const borderWidth = opts.borderWidth ?? 3;
  const inner = opts.inner ?? COLORS.parchment100;
  const c = scene.add.container(x, y);
  const outer = scene.add
    .rectangle(0, 0, w, h, fill, opts.alpha ?? 1)
    .setStrokeStyle(borderWidth, border);
  const innerRect = scene.add.rectangle(0, 0, w - borderWidth * 2 - 2, h - borderWidth * 2 - 2);
  innerRect.setStrokeStyle(2, inner);
  innerRect.setFillStyle(fill, opts.alpha ?? 1);
  c.add([outer, innerRect]);
  return c;
}

export interface ButtonOptions {
  width: number;
  height: number;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ad' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onClick: () => void;
}

interface ButtonHandle {
  container: Phaser.GameObjects.Container;
  rect: Phaser.GameObjects.Rectangle;
  shadow: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  setEnabled(enabled: boolean): void;
  setLabel(text: string): void;
}

interface VariantStyle {
  fill: number;
  hoverFill: number;
  textColor: string;
  border: number;
}

const VARIANT_STYLES: Record<NonNullable<ButtonOptions['variant']>, VariantStyle> = {
  primary: { fill: COLORS.gold500, hoverFill: COLORS.gold400, textColor: HEX.ink900, border: COLORS.ink900 },
  secondary: { fill: COLORS.parchment100, hoverFill: COLORS.parchment200, textColor: HEX.ink700, border: COLORS.ink700 },
  danger: { fill: COLORS.ember500, hoverFill: COLORS.ember600, textColor: HEX.bone100, border: COLORS.ink900 },
  ad: { fill: COLORS.azure500, hoverFill: COLORS.azure600, textColor: HEX.bone100, border: COLORS.ink900 },
  ghost: { fill: COLORS.parchment200, hoverFill: COLORS.parchment100, textColor: HEX.ink700, border: COLORS.ink500 }
};

const SIZE_FONT: Record<NonNullable<ButtonOptions['size']>, number> = {
  sm: 18,
  md: 22,
  lg: 28
};

// Builds a Castle Codex button: drop-shadow rectangle + label, with hover and
// pressed feedback. The shadow rectangle sits below the main rect to mimic the
// `0 4px 0 var(--ink-900)` block-shadow used in tokens.css (.cc-btn).
export function makeButton(scene: Phaser.Scene, x: number, y: number, opts: ButtonOptions): ButtonHandle {
  const variant = opts.variant ?? 'primary';
  const size = opts.size ?? 'md';
  const style = VARIANT_STYLES[variant];

  const container = scene.add.container(x, y);
  const shadow = scene.add.rectangle(0, 4, opts.width, opts.height, COLORS.ink900);
  shadow.setOrigin(0.5);
  const rect = scene.add.rectangle(0, 0, opts.width, opts.height, style.fill);
  rect.setStrokeStyle(3, style.border);
  rect.setOrigin(0.5);
  const label = scene.add.text(0, 0, opts.label, {
    fontFamily: FONTS.display,
    fontSize: `${SIZE_FONT[size]}px`,
    color: style.textColor
  });
  label.setOrigin(0.5);
  container.add([shadow, rect, label]);

  let enabled = true;
  rect.setInteractive({ useHandCursor: true });
  rect.on('pointerover', () => {
    if (!enabled) return;
    rect.setFillStyle(style.hoverFill);
  });
  rect.on('pointerout', () => {
    if (!enabled) return;
    rect.setFillStyle(style.fill);
  });
  rect.on('pointerdown', () => {
    if (!enabled) return;
    container.setY(y + 2);
    shadow.setVisible(false);
  });
  rect.on('pointerup', () => {
    if (!enabled) return;
    container.setY(y);
    shadow.setVisible(true);
    opts.onClick();
  });
  rect.on('pointerupoutside', () => {
    container.setY(y);
    shadow.setVisible(true);
  });

  return {
    container,
    rect,
    shadow,
    label,
    setEnabled(e: boolean): void {
      enabled = e;
      if (e) {
        rect.setFillStyle(style.fill).setStrokeStyle(3, style.border);
        label.setColor(style.textColor);
        rect.setInteractive({ useHandCursor: true });
        shadow.setVisible(true);
      } else {
        rect.setFillStyle(COLORS.parchment300).setStrokeStyle(3, COLORS.ink300);
        label.setColor(HEX.ink300);
        rect.disableInteractive();
        shadow.setVisible(false);
      }
    },
    setLabel(text: string): void {
      label.setText(text);
    }
  };
}

// Horizontal HP-style bar: dark frame with a colored fill, used for castle HP
// and any future progress meters.
export function makeBar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor: number = COLORS.ember500
): {
  container: Phaser.GameObjects.Container;
  setProgress(pct: number): void;
} {
  const container = scene.add.container(x, y);
  const frame = scene.add.rectangle(0, 0, w, h, COLORS.ink900).setStrokeStyle(2, COLORS.ink900);
  const fill = scene.add.rectangle(-w / 2 + 2, 0, w - 4, h - 4, fillColor);
  fill.setOrigin(0, 0.5);
  container.add([frame, fill]);
  return {
    container,
    setProgress(pct: number): void {
      const clamped = Math.max(0, Math.min(1, pct));
      fill.setDisplaySize((w - 4) * clamped, h - 4);
    }
  };
}

// Centered five-point star used by the Level Complete rating row.
export function drawStar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  filled: boolean,
  size = 56
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const bgFill = filled ? COLORS.parchment100 : COLORS.parchment300;
  const bg = scene.add.circle(0, 0, size / 2, bgFill).setStrokeStyle(3, COLORS.ink900);
  container.add(bg);

  const starColor = filled ? COLORS.gold400 : COLORS.parchment400;
  const r = size * 0.32;
  const inner = r * 0.42;
  const points: number[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : inner;
    points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  const star = scene.add.polygon(0, 0, points, starColor);
  star.setStrokeStyle(2, COLORS.ink900);
  container.add(star);
  return container;
}
