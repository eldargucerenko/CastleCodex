import Phaser from 'phaser';
import { Enemy } from './Enemy';

export class BurningEnemy extends Enemy {
  private coolingTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, x: number, y: number, groundY?: number) {
    super(scene, x, y, 'burning', groundY);
    this.burningState = 'Hot';
    this.statusText.setText('HOT');
    this.draw(0xf97316);
  }

  startCooling(onCooled: () => void): void {
    if (this.burningState === 'Cooled' || this.burningState === 'Cooling') return;
    this.burningState = 'Cooling';
    this.statusText.setText('COOLING');
    this.draw(0xfbbf24);
    this.coolingTimer = this.scene.time.delayedCall(1000, () => {
      this.burningState = 'Cooled';
      this.statusText.setText('COOLED');
      this.draw(0x38bdf8);
      onCooled();
    });
  }

  cancelCooling(): void {
    if (this.burningState !== 'Cooling') return;
    this.coolingTimer?.remove(false);
    this.burningState = 'Hot';
    this.statusText.setText('HOT');
    this.draw(0xf97316);
  }
}
