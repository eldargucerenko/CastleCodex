import Phaser from 'phaser';
import { Enemy } from './Enemy';

// Thin subclass that just widens the hitbox so dragging knights off the
// ground feels forgiving — the chibi sprite is taller than the radius the
// physics layer uses, and missed grabs were unsatisfying without this.
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
