import Phaser from 'phaser';
import { Enemy } from './Enemy';

export class BasicEnemy extends Enemy {
  private sprite: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, x: number, y: number, groundY?: number) {
    super(scene, x, y, 'basic', groundY);
    this.shape.setVisible(false);
    this.labelText.setVisible(false);
    this.sprite = scene.add.sprite(0, 3, 'knight-run-1');
    this.sprite.setDisplaySize(58, 58);
    this.sprite.setFlipX(true);
    this.sprite.play('basic-walk');
    this.addAt(this.sprite, 0);
  }
}
