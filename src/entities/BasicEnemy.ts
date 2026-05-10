import Phaser from 'phaser';
import { Enemy } from './Enemy';

// Knight subclass: only specializes the grab hitbox so dragging knights off
// the ground feels forgiving. State-driven anim swaps + per-attack strikes
// are all handled in the base Enemy now (see EXTRAS_BY_KIND there).
export class BasicEnemy extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number, groundY?: number) {
    super(scene, x, y, 'basic', groundY);
  }

  override containsPoint(x: number, y: number): boolean {
    const halfW = 50;
    const halfH = 70;
    return Math.abs(x - this.x) <= halfW && Math.abs(y - (this.y - 18)) <= halfH;
  }
}
