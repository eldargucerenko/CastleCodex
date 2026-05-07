import Phaser from 'phaser';
import { MAX_UPGRADE_LEVEL } from '../data/upgrades';
import { SaveSystem } from '../systems/SaveSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import type { SaveData, UpgradeKey } from '../types/game';
import { COLORS, FONTS, HEX, makeButton, makePanel } from '../ui/theme';
import { LOGICAL_W, LOGICAL_H } from '../config/dimensions';

interface UpgradeSpec {
  key: UpgradeKey;
  title: string;
  desc: string;
  level: number;
  max: number;
}

export class UpgradeScene extends Phaser.Scene {
  private save!: SaveData;

  constructor() {
    super('UpgradeScene');
  }

  create(): void {
    this.save = SaveSystem.load();
    this.draw();
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.scene.isPaused() || this.scene.isActive('PauseMenuScene')) return;
      this.scene.launch('PauseMenuScene', { fromScene: 'UpgradeScene' });
      this.scene.pause();
    });
  }

  private draw(): void {
    this.children.removeAll();

    const w = LOGICAL_W;
    const h = LOGICAL_H;

    // Backdrop: warm parchment gradient.
    const bg = this.add.graphics();
    bg.fillGradientStyle(COLORS.parchment200, COLORS.parchment200, COLORS.parchment300, COLORS.parchment300, 1, 1, 1, 1);
    bg.fillRect(0, 0, w, h);

    this.drawHeader(w);
    this.drawUpgradeGrid(w);
    this.drawFooter(w, h);
  }

  private drawHeader(w: number): void {
    const headerH = 64;
    this.add.rectangle(w / 2, headerH / 2, w, headerH, COLORS.parchment100).setStrokeStyle(0);
    this.add.line(0, 0, 0, headerH, w, headerH, COLORS.ink900).setOrigin(0).setLineWidth(3);

    this.add
      .text(18, headerH / 2 - 10, 'Reinforce the Keep', {
        fontFamily: FONTS.display,
        fontSize: '26px',
        color: HEX.ink900
      })
      .setOrigin(0, 0.5);
    this.add
      .text(
        18,
        headerH / 2 + 14,
        `Between Wave ${Math.max(0, this.save.currentLevel - 1)} / ${this.save.currentLevel}`,
        {
          fontFamily: FONTS.body,
          fontSize: '11px',
          color: HEX.ink500
        }
      )
      .setOrigin(0, 0.5);

    // HP chip (right side)
    const hpX = w - 230;
    const hpChip = this.add.rectangle(hpX, headerH / 2, 130, 32, COLORS.ink900).setStrokeStyle(2, COLORS.gold500);
    hpChip.setOrigin(0.5);
    this.add
      .text(hpX, headerH / 2, `HP  ${this.save.currentHp}/${this.save.maxHp}`, {
        fontFamily: FONTS.display,
        fontSize: '15px',
        color: HEX.bone100
      })
      .setOrigin(0.5);

    // Gold chip
    const goldX = w - 80;
    const goldChip = this.add.rectangle(goldX, headerH / 2, 130, 32, COLORS.gold500).setStrokeStyle(2, COLORS.ink900);
    goldChip.setOrigin(0.5);
    this.drawCoin(goldX - 42, headerH / 2, 12);
    this.add
      .text(goldX - 18, headerH / 2, `${this.save.gold}`, {
        fontFamily: FONTS.display,
        fontSize: '17px',
        color: HEX.ink900
      })
      .setOrigin(0, 0.5);
  }

  private drawCoin(x: number, y: number, radius: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillStyle(COLORS.gold400, 1);
    g.fillCircle(x, y, radius);
    g.lineStyle(2, COLORS.ink900);
    g.strokeCircle(x, y, radius);
    g.lineStyle(1, COLORS.ink900);
    g.strokeCircle(x, y, radius - 3);
    return g;
  }

  private drawUpgradeGrid(w: number): void {
    const upgrades = this.collectUpgrades();
    const recommendedKey = this.pickRecommended(upgrades);

    const cols = 3;
    const cardW = 290;
    const cardH = 130;
    const gapX = 14;
    const gapY = 14;
    const totalW = cardW * cols + gapX * (cols - 1);
    const startX = (w - totalW) / 2 + cardW / 2;
    const startY = 110;

    upgrades.forEach((upg, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY) + cardH / 2;
      this.drawCard(x, y, cardW, cardH, upg, upg.key === recommendedKey);
    });
  }

  private drawCard(x: number, y: number, w: number, h: number, upg: UpgradeSpec, recommended: boolean): void {
    const cost = UpgradeSystem.getCost(this.save, upg.key);
    const finite = Number.isFinite(cost);
    const owned = upg.level >= upg.max;
    const affordable = finite && this.save.gold >= cost;

    makePanel(this, x, y, w, h, {
      border: recommended ? COLORS.gold500 : COLORS.ink700,
      borderWidth: recommended ? 3 : 3
    });

    if (recommended) {
      const tag = this.add.rectangle(x + w / 2 - 50, y - h / 2 + 2, 84, 18, COLORS.gold500);
      tag.setStrokeStyle(2, COLORS.ink900);
      this.add
        .text(x + w / 2 - 50, y - h / 2 + 2, 'PICK', {
          fontFamily: FONTS.display,
          fontSize: '12px',
          color: HEX.ink900
        })
        .setOrigin(0.5);
    }

    // Icon plate
    const plateX = x - w / 2 + 26;
    const plateY = y - h / 2 + 28;
    const plate = this.add.rectangle(plateX, plateY, 38, 38, COLORS.parchment300);
    plate.setStrokeStyle(2, COLORS.ink700);
    this.add
      .text(plateX, plateY, this.iconGlyph(upg.key), {
        fontFamily: FONTS.display,
        fontSize: '20px',
        color: HEX.ink900
      })
      .setOrigin(0.5);

    // Title + pips
    this.add
      .text(plateX + 26, plateY - 8, upg.title, {
        fontFamily: FONTS.display,
        fontSize: '16px',
        color: HEX.ink900
      })
      .setOrigin(0, 0.5);
    this.drawPips(plateX + 26, plateY + 12, upg.level, upg.max);

    // Description
    this.add
      .text(x - w / 2 + 14, y, upg.desc, {
        fontFamily: FONTS.body,
        fontSize: '12px',
        color: HEX.ink700,
        wordWrap: { width: w - 28 }
      })
      .setOrigin(0, 0.5);

    // Action button
    const btnY = y + h / 2 - 22;
    const btnW = w - 28;
    if (owned) {
      makeButton(this, x, btnY, {
        width: btnW,
        height: 32,
        label: 'MAXED',
        variant: 'secondary',
        size: 'sm',
        onClick: () => {}
      }).setEnabled(false);
    } else if (!finite) {
      const btn = makeButton(this, x, btnY, {
        width: btnW,
        height: 32,
        label: 'Unavailable',
        variant: 'secondary',
        size: 'sm',
        onClick: () => {}
      });
      btn.setEnabled(false);
    } else {
      const btn = makeButton(this, x, btnY, {
        width: btnW,
        height: 32,
        label: `${cost} g`,
        variant: affordable ? 'primary' : 'secondary',
        size: 'sm',
        onClick: () => this.buy(upg.key)
      });
      if (!affordable) btn.setEnabled(false);
    }
  }

  private drawPips(x: number, y: number, level: number, max: number): void {
    const pipW = 12;
    const gap = 3;
    for (let i = 0; i < max; i++) {
      const px = x + i * (pipW + gap);
      const fill = i < level ? COLORS.gold500 : COLORS.parchment300;
      this.add.rectangle(px, y, pipW, 8, fill).setStrokeStyle(1, COLORS.ink700).setOrigin(0, 0.5);
    }
  }

  private drawFooter(w: number, h: number): void {
    const footerH = 60;
    this.add.rectangle(w / 2, h - footerH / 2, w, footerH, COLORS.ink900);
    this.add.line(0, h - footerH, 0, 0, w, 0, COLORS.gold500).setOrigin(0).setLineWidth(3);

    this.add
      .text(20, h - footerH / 2, `Next: WAVE ${this.save.currentLevel}`, {
        fontFamily: FONTS.display,
        fontSize: '14px',
        color: HEX.gold400
      })
      .setOrigin(0, 0.5);

    const nextLabel = this.save.currentLevel > 10 ? 'Finish Campaign' : `Start Wave ${this.save.currentLevel}`;
    makeButton(this, w - 140, h - footerH / 2, {
      width: 230,
      height: 44,
      label: nextLabel,
      variant: 'primary',
      size: 'md',
      onClick: () => {
        SaveSystem.save(this.save);
        this.scene.start(this.save.currentLevel > 10 ? 'VictoryScene' : 'GameScene');
      }
    });
  }

  private collectUpgrades(): UpgradeSpec[] {
    const upgrades: UpgradeSpec[] = [
      {
        key: 'repair',
        title: 'Repair Castle',
        desc: 'Restore castle HP to full.',
        level: this.save.currentHp >= this.save.maxHp ? 1 : 0,
        max: 1
      },
      {
        key: 'walls',
        title: 'Reinforce Walls',
        desc: '+45 max HP and stronger ranged damage reduction.',
        level: this.save.wallLevel,
        max: MAX_UPGRADE_LEVEL
      },
      {
        key: 'archers',
        title: 'Archers',
        desc: 'Add an auto-firing archer post on the wall.',
        level: this.save.archerLevel,
        max: MAX_UPGRADE_LEVEL
      },
      {
        key: 'log',
        title: 'Rolling Log',
        desc: 'Ready a one-use log trap at the gate.',
        level: this.save.logTrapCount,
        max: 1
      },
      {
        key: 'mage',
        title: 'Mage',
        desc: 'Auto AoE damage with a slow on hit.',
        level: this.save.mageLevel,
        max: MAX_UPGRADE_LEVEL
      }
    ];
    if (Number.isFinite(UpgradeSystem.getCost(this.save, 'healArchers'))) {
      upgrades.push({ key: 'healArchers', title: 'Heal Archers', desc: 'Restore archer HP.', level: 0, max: 1 });
    }
    if (Number.isFinite(UpgradeSystem.getCost(this.save, 'healMage'))) {
      upgrades.push({ key: 'healMage', title: 'Heal Mage', desc: 'Restore mage HP.', level: 0, max: 1 });
    }
    return upgrades;
  }

  private pickRecommended(upgrades: UpgradeSpec[]): UpgradeKey | null {
    // Repair if HP is low and affordable.
    const repair = upgrades.find((u) => u.key === 'repair');
    if (repair && this.save.currentHp < this.save.maxHp * 0.5) {
      const cost = UpgradeSystem.getCost(this.save, 'repair');
      if (Number.isFinite(cost) && this.save.gold >= cost) return 'repair';
    }
    // Otherwise, the most expensive upgrade we can still afford that isn't max.
    let best: { key: UpgradeKey; cost: number } | null = null;
    for (const u of upgrades) {
      if (u.level >= u.max) continue;
      const cost = UpgradeSystem.getCost(this.save, u.key);
      if (!Number.isFinite(cost) || this.save.gold < cost) continue;
      if (!best || cost > best.cost) best = { key: u.key, cost };
    }
    return best?.key ?? null;
  }

  private iconGlyph(key: UpgradeKey): string {
    switch (key) {
      case 'walls':
        return 'W';
      case 'archers':
        return 'A';
      case 'log':
        return 'L';
      case 'mage':
        return 'M';
      case 'repair':
        return 'HP';
      case 'healArchers':
        return '+A';
      case 'healMage':
        return '+M';
      default:
        return '*';
    }
  }

  private buy(key: UpgradeKey): void {
    this.save = UpgradeSystem.buy(this.save, key);
    SaveSystem.save(this.save);
    this.draw();
  }
}
