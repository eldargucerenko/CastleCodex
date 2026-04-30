import Phaser from 'phaser';
import { ENEMY_STATS } from '../data/enemies';
import { getLevel } from '../data/levels';
import { ArcherEnemy } from '../entities/ArcherEnemy';
import { BasicEnemy } from '../entities/BasicEnemy';
import { BomberEnemy } from '../entities/BomberEnemy';
import { BurningEnemy } from '../entities/BurningEnemy';
import type { Enemy } from '../entities/Enemy';
import { FatEnemy } from '../entities/FatEnemy';
import { JumperEnemy } from '../entities/JumperEnemy';
import { RaiderEnemy } from '../entities/RaiderEnemy';
import { WizardEnemy } from '../entities/WizardEnemy';
import type { EnemyKind } from '../types/game';

export class WaveManager {
  private static readonly laneCount = 5;
  private static readonly laneSpacing = 13;
  private queue: EnemyKind[] = [];
  private nextSpawnAt = 0;
  readonly totalCount: number;

  constructor(private scene: Phaser.Scene, level: number, private onSpawn: (enemy: Enemy) => void) {
    const definition = getLevel(level);
    this.queue = definition.waves.flatMap((entry) => Array<EnemyKind>(entry.count).fill(entry.kind));
    this.queue = Phaser.Utils.Array.Shuffle(this.queue);
    this.totalCount = this.queue.length;
  }

  get doneSpawning(): boolean {
    return this.queue.length === 0;
  }

  get remainingQueued(): number {
    return this.queue.length;
  }

  update(time: number): void {
    if (this.queue.length === 0 || time < this.nextSpawnAt) return;
    const kind = this.queue.shift();
    if (!kind) return;
    const width = Number(this.scene.game.config.width);
    const groundY = this.pickLaneGroundY();
    const x = width + Phaser.Math.Between(20, 120);
    const y = groundY - ENEMY_STATS[kind].radius;
    this.onSpawn(this.createEnemy(kind, x, y, groundY));
    this.nextSpawnAt = time + Phaser.Math.Between(620, 1050);
  }

  private createEnemy(kind: EnemyKind, x: number, y: number, groundY: number): Enemy {
    if (kind === 'fat') return new FatEnemy(this.scene, x, y, groundY);
    if (kind === 'archer') return new ArcherEnemy(this.scene, x, y, groundY);
    if (kind === 'bomber') return new BomberEnemy(this.scene, x, y, groundY);
    if (kind === 'jumper') return new JumperEnemy(this.scene, x, y, groundY);
    if (kind === 'raider') return new RaiderEnemy(this.scene, x, y, groundY);
    if (kind === 'burning') return new BurningEnemy(this.scene, x, y, groundY);
    if (kind === 'wizard' || kind === 'wizard_easy' || kind === 'wizard_medium' || kind === 'wizard_hard') {
      return new WizardEnemy(this.scene, x, y, kind, groundY);
    }
    return new BasicEnemy(this.scene, x, y, groundY);
  }

  private pickLaneGroundY(): number {
    const centerGroundY = Number(this.scene.game.config.height) - 72;
    const lane = Phaser.Math.Between(0, WaveManager.laneCount - 1);
    const offsetFromCenter = lane - Math.floor(WaveManager.laneCount / 2);
    return centerGroundY + offsetFromCenter * WaveManager.laneSpacing;
  }
}
