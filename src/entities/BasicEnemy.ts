import Phaser from 'phaser';
import { Enemy } from './Enemy';

export class BasicEnemy extends Enemy {
  private sprite?: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, x: number, y: number, groundY?: number) {
    super(scene, x, y, 'basic', groundY);
    if (!scene.textures.exists('basic-knight-walk-sheet') || !scene.anims.exists('basic-walk')) {
      return;
    }

    this.shape.setVisible(false);
    this.labelText.setVisible(false);
    this.sprite = scene.add.sprite(0, -18, 'basic-knight-walk-sheet', 0);
    this.sprite.setDisplaySize(84, 112);
    this.sprite.setFlipX(false);
    this.sprite.play('basic-walk');
    this.addAt(this.sprite, 0);
  }
}
