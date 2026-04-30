import Phaser from 'phaser';
import { Enemy } from './Enemy';

export class RaiderEnemy extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number, groundY?: number) {
    super(scene, x, y, 'raider', groundY);
  }
}
