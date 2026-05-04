import Phaser from 'phaser';
import { MAX_UPGRADE_LEVEL } from '../data/upgrades';
import { EconomySystem } from '../systems/EconomySystem';
import { SaveSystem } from '../systems/SaveSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import type { SaveData, UpgradeKey } from '../types/game';

export class UpgradeScene extends Phaser.Scene {
  private save!: SaveData;
  private infoText!: Phaser.GameObjects.Text;
  private buttons: Phaser.GameObjects.Container[] = [];

  constructor() {
    super('UpgradeScene');
  }

  create(): void {
    this.save = SaveSystem.load();
    this.draw();
  }

  private draw(): void {
    this.children.removeAll();
    this.buttons = [];
    const width = Number(this.game.config.width);
    const height = Number(this.game.config.height);
    this.add.rectangle(width / 2, height / 2, width, height, 0xe0f2fe);
    this.add.text(width / 2, 42, 'Castle Upgrades', { color: '#0f172a', fontSize: '34px', fontStyle: 'bold' }).setOrigin(0.5);
    this.infoText = this.add
      .text(width / 2, 92, this.infoLine(), { color: '#1e293b', fontSize: '18px', align: 'center' })
      .setOrigin(0.5);

    const upgrades: Array<{ key: UpgradeKey; title: string; detail: string; level: number; max?: number }> = [
      { key: 'repair', title: 'Repair Castle', detail: 'Restore castle HP', level: this.save.currentHp >= this.save.maxHp ? 1 : 0, max: 1 },
      { key: 'walls', title: 'Reinforce Walls', detail: 'More HP and damage reduction', level: this.save.wallLevel },
      { key: 'archers', title: 'Archers', detail: 'Auto-shoot random available enemies', level: this.save.archerLevel },
      { key: 'log', title: 'Rolling Log', detail: 'One-use castle log trap', level: this.save.logTrapCount, max: 1 },
      { key: 'mage', title: 'Mage', detail: 'Auto AoE damage and slow', level: this.save.mageLevel }
    ];
    if (Number.isFinite(UpgradeSystem.getCost(this.save, 'healArchers'))) {
      upgrades.splice(3, 0, { key: 'healArchers', title: 'Heal Archers', detail: 'Restore defender archer HP', level: 0, max: 1 });
    }
    if (Number.isFinite(UpgradeSystem.getCost(this.save, 'healMage'))) {
      upgrades.push({ key: 'healMage', title: 'Heal Mage', detail: 'Restore defender mage HP', level: 0, max: 1 });
    }

    upgrades.forEach((upgrade, index) => {
      const x = width / 2;
      const y = 150 + index * 74;
      const max = upgrade.max ?? MAX_UPGRADE_LEVEL;
      const cost = UpgradeSystem.getCost(this.save, upgrade.key);
      const label =
        upgrade.level >= max
          ? `${upgrade.title} | max`
          : `${upgrade.title} | cost ${Number.isFinite(cost) ? cost : '-'}g | lvl ${upgrade.level}/${max}`;
      const button = this.button(x, y, 520, 56, label, upgrade.detail, () => this.buy(upgrade.key));
      if (upgrade.level >= max || this.save.gold < cost) button.setAlpha(0.58);
    });

    const nextLabel =
      this.save.currentLevel > 10 ? 'Finish Campaign' : `Start Level ${this.save.currentLevel}`;
    this.button(width / 2, height - 62, 320, 56, nextLabel, '', () => {
      SaveSystem.save(this.save);
      this.scene.start(this.save.currentLevel > 10 ? 'VictoryScene' : 'GameScene');
    });
  }

  private buy(key: UpgradeKey): void {
    this.save = UpgradeSystem.buy(this.save, key);
    SaveSystem.save(this.save);
    this.draw();
  }

  private button(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    detail: string,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y).setSize(width, height);
    const rect = this.add.rectangle(0, 0, width, height, 0xffffff, 0.92).setStrokeStyle(2, 0x0f172a);
    const text = this.add.text(-width / 2 + 18, -13, label, { color: '#0f172a', fontSize: '18px', fontStyle: 'bold' }).setOrigin(0, 0.5);
    const sub = this.add.text(width / 2 - 18, 13, detail, { color: '#475569', fontSize: '13px' }).setOrigin(1, 0.5);
    container.add([rect, text, sub]);
    rect.setInteractive({ useHandCursor: true });
    rect.on('pointerover', () => rect.setFillStyle(0xf8fafc, 1));
    rect.on('pointerout', () => rect.setFillStyle(0xffffff, 0.92));
    rect.on('pointerdown', onClick);
    this.buttons.push(container);
    return container;
  }

  private infoLine(): string {
    const repair = EconomySystem.repairCost(this.save.maxHp - this.save.currentHp);
    return `Level ${this.save.currentLevel}   Gold ${this.save.gold}   Castle HP ${this.save.currentHp}/${this.save.maxHp}   Repair ${repair}g`;
  }
}
