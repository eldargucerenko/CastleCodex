import { ENEMY_STATS } from '../data/enemies';
import type { EnemyKind } from '../types/game';
import { DebugCheatSystem, type DebugStatKey } from './DebugCheatSystem';

interface MountOptions {
  spawnHandler: (kind: EnemyKind) => void;
  getSpawnEnabled: () => boolean;
}

const STAT_KEYS: DebugStatKey[] = ['hp', 'attackDamage', 'speed', 'range'];
const STAT_LABELS: Record<DebugStatKey, string> = {
  hp: 'HP',
  attackDamage: 'DMG',
  speed: 'SPD',
  range: 'RNG'
};

function colorToCss(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

function getAssetBasePath(): string {
  if (window.location.hostname.endsWith('github.io')) {
    const repoName = window.location.pathname.split('/').filter(Boolean)[0];
    return repoName ? `/${repoName}/` : '/';
  }
  return './';
}

// Walk-strip filename per kind. The cheat panel renders frame 0 of each
// strip via CSS background-position so we don't have to ship duplicate
// static PNGs. Strips are 2048x256 with 8 frames at 256x256.
const WALK_STRIP_BY_KIND: Partial<Record<EnemyKind, string>> = {
  basic: 'enemies/knight_walk_strip.png',
  archer: 'enemies/archer_walk_strip.png',
  bomber: 'enemies/bomber_walk_strip.png',
  jumper: 'enemies/hammerman_walk_strip.png',
  raider: 'enemies/raider_walk_strip.png',
  fat: 'enemies/heavy_knight_walk_strip.png',
  trunk: 'enemies/log_thrower_walk_strip.png',
  wizard: 'enemies/wizard_walk_strip.png',
  wizard_easy: 'enemies/wizard_walk_strip.png',
  wizard_medium: 'enemies/wizard_walk_strip.png',
  wizard_hard: 'enemies/wizard_walk_strip.png'
};

function buildIcon(kind: EnemyKind): HTMLSpanElement {
  const wrap = document.createElement('span');
  wrap.className = 'dbg-icon';
  const stripPath = WALK_STRIP_BY_KIND[kind];
  if (stripPath) {
    const slice = document.createElement('div');
    slice.className = 'dbg-icon-slice';
    slice.style.backgroundImage = `url(${getAssetBasePath()}assets/${stripPath})`;
    wrap.appendChild(slice);
    return wrap;
  }
  wrap.appendChild(buildStickFigureSvg(kind));
  return wrap;
}

function buildStickFigureSvg(kind: EnemyKind): SVGSVGElement {
  const stats = ENEMY_STATS[kind];
  const fill = colorToCss(stats.color);
  const sizeScale = Math.min(1.2, Math.max(0.85, stats.radius / 16));
  const r = 7 * sizeScale;
  const cx = 14;
  const cy = 10;
  const stroke = '#111827';
  const sw = 2;
  const leftLegX1 = cx - r * 0.65;
  const leftLegY1 = cy + r * 0.9;
  const leftLegX2 = cx - r * 0.25;
  const leftLegY2 = cy + r * 1.9;
  const leftArmX1 = cx - r * 0.9;
  const leftArmY1 = cy + r * 0.1;
  const leftArmX2 = cx - r * 1.55;
  const leftArmY2 = cy + r * 0.95;
  const labelLen = stats.label.length;
  const labelFontSize = labelLen <= 1 ? 9 : labelLen === 2 ? 6 : 5;
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('width', '28');
  svg.setAttribute('height', '30');
  svg.setAttribute('viewBox', '0 0 28 30');
  const lines: [number, number, number, number][] = [
    [leftLegX1, leftLegY1, leftLegX2, leftLegY2],
    [2 * cx - leftLegX1, leftLegY1, 2 * cx - leftLegX2, leftLegY2],
    [leftArmX1, leftArmY1, leftArmX2, leftArmY2],
    [2 * cx - leftArmX1, leftArmY1, 2 * cx - leftArmX2, leftArmY2]
  ];
  for (const [x1, y1, x2, y2] of lines) {
    const ln = document.createElementNS(svgNs, 'line');
    ln.setAttribute('x1', String(x1));
    ln.setAttribute('y1', String(y1));
    ln.setAttribute('x2', String(x2));
    ln.setAttribute('y2', String(y2));
    ln.setAttribute('stroke', stroke);
    ln.setAttribute('stroke-width', String(sw));
    ln.setAttribute('stroke-linecap', 'round');
    svg.appendChild(ln);
  }
  const circle = document.createElementNS(svgNs, 'circle');
  circle.setAttribute('cx', String(cx));
  circle.setAttribute('cy', String(cy));
  circle.setAttribute('r', String(r));
  circle.setAttribute('fill', fill);
  circle.setAttribute('stroke', stroke);
  circle.setAttribute('stroke-width', String(sw));
  svg.appendChild(circle);
  if (stats.label) {
    const text = document.createElementNS(svgNs, 'text');
    text.setAttribute('x', String(cx));
    text.setAttribute('y', String(cy + labelFontSize / 3));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', String(labelFontSize));
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('font-family', 'Arial, sans-serif');
    text.setAttribute('fill', '#ffffff');
    text.textContent = stats.label;
    svg.appendChild(text);
  }
  return svg;
}

let mounted: DebugPanelUI | null = null;

export class DebugPanelUI {
  private toggleButton!: HTMLButtonElement;
  private panel!: HTMLDivElement;
  private spawnHandler: (kind: EnemyKind) => void;
  private getSpawnEnabled: () => boolean;
  private spawnButtons: HTMLButtonElement[] = [];
  private keyListener: (e: KeyboardEvent) => void;
  private rafHandle = 0;

  static ensureMounted(opts: MountOptions): DebugPanelUI {
    if (mounted) {
      mounted.spawnHandler = opts.spawnHandler;
      mounted.getSpawnEnabled = opts.getSpawnEnabled;
      return mounted;
    }
    mounted = new DebugPanelUI(opts);
    return mounted;
  }

  private constructor(opts: MountOptions) {
    this.spawnHandler = opts.spawnHandler;
    this.getSpawnEnabled = opts.getSpawnEnabled;
    this.injectStyles();
    this.buildToggleButton();
    this.buildPanel();
    this.keyListener = (e) => {
      if (e.key === '`' || e.code === 'Backquote') {
        this.toggle();
      }
    };
    document.addEventListener('keydown', this.keyListener);
    const tick = () => {
      this.refreshSpawnEnabled();
      this.rafHandle = window.requestAnimationFrame(tick);
    };
    this.rafHandle = window.requestAnimationFrame(tick);
  }

  private injectStyles(): void {
    if (document.getElementById('debug-panel-styles')) return;
    const style = document.createElement('style');
    style.id = 'debug-panel-styles';
    style.textContent = `
      .dbg-toggle {
        position: fixed; top: 10px; right: 10px; z-index: 9999;
        background: #111827; color: #f9fafb; border: 1px solid #4b5563;
        font: bold 12px Arial, sans-serif; padding: 6px 10px; cursor: pointer;
        border-radius: 4px;
      }
      .dbg-toggle:hover { background: #1f2937; }
      .dbg-panel {
        position: fixed; top: 44px; right: 10px; z-index: 9998;
        width: 320px; max-height: calc(100vh - 60px); overflow-y: auto;
        background: rgba(17, 24, 39, 0.94); color: #f9fafb;
        border: 1px solid #4b5563; border-radius: 6px; padding: 10px;
        font: 12px Arial, sans-serif; display: none;
      }
      .dbg-panel.dbg-open { display: block; }
      .dbg-panel h3 { margin: 8px 0 6px; font-size: 13px; color: #fbbf24; }
      .dbg-spawn-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; }
      .dbg-spawn-grid button {
        background: #1f2937; color: #f9fafb; border: 1px solid #4b5563;
        padding: 5px 6px; cursor: pointer; border-radius: 3px; font: 12px Arial;
      }
      .dbg-spawn-grid button:hover:not(:disabled) { background: #374151; }
      .dbg-spawn-grid button:disabled { opacity: 0.4; cursor: not-allowed; }
      .dbg-icon {
        width: 28px; height: 30px; flex-shrink: 0; vertical-align: middle;
        display: inline-block;
      }
      .dbg-icon svg { overflow: visible; }
      .dbg-icon img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; }
      .dbg-icon-slice {
        width: 100%; height: 100%;
        background-size: 800% 100%;
        background-position: 0% 0%;
        background-repeat: no-repeat;
      }
      .dbg-spawn-grid button { display: flex; align-items: center; gap: 6px; }
      .dbg-stat-row { display: flex; align-items: center; gap: 4px; margin: 3px 0; }
      .dbg-stat-row .dbg-kind {
        width: 110px; font-weight: bold; font-size: 11px;
        display: flex; align-items: center; gap: 6px;
      }
      .dbg-stat-row input {
        width: 48px; background: #0f172a; color: #f9fafb;
        border: 1px solid #4b5563; padding: 2px 4px; font: 11px Arial;
        border-radius: 2px;
      }
      .dbg-stat-row input::placeholder { color: #6b7280; }
      .dbg-stat-row label { font-size: 10px; color: #9ca3af; }
      .dbg-reset {
        margin-top: 8px; width: 100%; background: #7f1d1d; color: #f9fafb;
        border: 1px solid #b91c1c; padding: 6px; cursor: pointer;
        border-radius: 3px; font: bold 12px Arial;
      }
      .dbg-reset:hover { background: #991b1b; }
    `;
    document.head.appendChild(style);
  }

  private buildToggleButton(): void {
    const btn = document.createElement('button');
    btn.className = 'dbg-toggle';
    btn.textContent = 'DEBUG';
    btn.addEventListener('click', () => this.toggle());
    document.body.appendChild(btn);
    this.toggleButton = btn;
  }

  private buildPanel(): void {
    const panel = document.createElement('div');
    panel.className = 'dbg-panel';

    const spawnHeader = document.createElement('h3');
    spawnHeader.textContent = 'Spawn enemy';
    panel.appendChild(spawnHeader);

    const spawnGrid = document.createElement('div');
    spawnGrid.className = 'dbg-spawn-grid';
    for (const kind of Object.keys(ENEMY_STATS) as EnemyKind[]) {
      const b = document.createElement('button');
      b.appendChild(buildIcon(kind));
      b.appendChild(document.createTextNode(kind));
      b.addEventListener('click', () => this.spawnHandler(kind));
      spawnGrid.appendChild(b);
      this.spawnButtons.push(b);
    }
    panel.appendChild(spawnGrid);

    const statsHeader = document.createElement('h3');
    statsHeader.textContent = 'Stat overrides (apply to future spawns)';
    panel.appendChild(statsHeader);

    const colHeaders = document.createElement('div');
    colHeaders.className = 'dbg-stat-row';
    colHeaders.innerHTML =
      `<div class="dbg-kind"></div>` +
      STAT_KEYS.map((k) => `<label style="width:48px;text-align:center">${STAT_LABELS[k]}</label>`).join('');
    panel.appendChild(colHeaders);

    for (const kind of Object.keys(ENEMY_STATS) as EnemyKind[]) {
      panel.appendChild(this.buildStatRow(kind));
    }

    const reset = document.createElement('button');
    reset.className = 'dbg-reset';
    reset.textContent = 'Reset all overrides';
    reset.addEventListener('click', () => {
      DebugCheatSystem.resetAll();
      this.refreshOverrideInputs();
    });
    panel.appendChild(reset);

    document.body.appendChild(panel);
    this.panel = panel;
  }

  private buildStatRow(kind: EnemyKind): HTMLDivElement {
    const baseStats = ENEMY_STATS[kind];
    const row = document.createElement('div');
    row.className = 'dbg-stat-row';

    const label = document.createElement('div');
    label.className = 'dbg-kind';
    label.appendChild(buildIcon(kind));
    label.appendChild(document.createTextNode(kind));
    row.appendChild(label);

    for (const stat of STAT_KEYS) {
      const input = document.createElement('input');
      input.type = 'number';
      input.dataset.kind = kind;
      input.dataset.stat = stat;
      const baseValue = baseStats[stat];
      if (baseValue === undefined) {
        input.disabled = true;
        input.placeholder = '-';
      } else {
        input.placeholder = String(baseValue);
        const override = DebugCheatSystem.getFor(kind)[stat];
        if (override !== undefined) input.value = String(override);
      }
      input.addEventListener('change', () => {
        const raw = input.value.trim();
        if (raw === '') {
          DebugCheatSystem.set(kind, stat, null);
        } else {
          const num = Number(raw);
          DebugCheatSystem.set(kind, stat, Number.isFinite(num) ? num : null);
        }
      });
      row.appendChild(input);
    }
    return row;
  }

  private refreshOverrideInputs(): void {
    const inputs = this.panel.querySelectorAll<HTMLInputElement>('input[data-kind]');
    inputs.forEach((input) => {
      const kind = input.dataset.kind as EnemyKind;
      const stat = input.dataset.stat as DebugStatKey;
      const override = DebugCheatSystem.getFor(kind)[stat];
      input.value = override === undefined ? '' : String(override);
    });
  }

  private refreshSpawnEnabled(): void {
    const enabled = this.getSpawnEnabled();
    for (const b of this.spawnButtons) {
      b.disabled = !enabled;
    }
  }

  private toggle(): void {
    const isOpen = this.panel.classList.toggle('dbg-open');
    if (isOpen) this.refreshOverrideInputs();
  }

  destroy(): void {
    document.removeEventListener('keydown', this.keyListener);
    window.cancelAnimationFrame(this.rafHandle);
    this.toggleButton.remove();
    this.panel.remove();
    if (mounted === this) mounted = null;
  }
}
