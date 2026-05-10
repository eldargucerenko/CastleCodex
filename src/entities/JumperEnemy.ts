import Phaser from 'phaser';
import type { Castle } from './Castle';
import { Enemy } from './Enemy';

export class JumperEnemy extends Enemy {
  private jumpPhase: 'preparing' | 'jumping' | 'running' = 'preparing';
  private prepareStartedAt = 0;
  private jumpStartX = 0;
  private jumpStartY = 0;
  private jumpTargetX = 0;
  private jumpDuration = 780;
  private jumpStartedAt = 0;
  private readonly runDistance = 230;

  constructor(scene: Phaser.Scene, x: number, y: number, groundY?: number) {
    super(scene, x, y, 'jumper', groundY);
    this.prepareStartedAt = 0;
  }

  override updateEnemy(time: number, delta: number, castle: Castle): void {
    if (this.state === 'Dead' || this.state === 'Grabbed') return;
    if (this.state === 'Flying' || this.state === 'Stunned') {
      this.updateFlying(delta, castle);
      return;
    }

    const attackX = castle.width + this.stats.radius + 4;
    if (this.x <= attackX) {
      this.state = 'AttackCastle';
      this.vx = 0;
      if (time - this.lastAttackAt > this.stats.attackRateMs) {
        this.lastAttackAt = time;
        castle.takeDamage(this.stats.attackDamage);
        this.triggerStrike();
      }
      return;
    }

    if (this.jumpPhase === 'running') {
      if (this.x > castle.width + this.runDistance + 70) {
        this.jumpPhase = 'preparing';
        this.prepareStartedAt = 0;
        return;
      }
      this.state = 'WalkToCastle';
      const slow = time < this.isSlowedUntil ? 0.45 : 1;
      this.x -= this.stats.speed * slow * (delta / 1000);
      return;
    }

    if (this.jumpPhase === 'jumping') {
      this.updateJump(time);
      return;
    }

    this.state = 'WalkToCastle';
    this.vx = 0;
    this.vy = 0;
    this.prepareStartedAt ||= time;
    const left = Math.max(0, 1 - (time - this.prepareStartedAt) / 1000);
    this.statusText.setText(left > 0 ? left.toFixed(1) : 'JUMP');
    this.setScale(1 + (1 - left) * 0.12, 1 - (1 - left) * 0.08);
    if (time - this.prepareStartedAt >= 1000) {
      this.startJump(time, castle);
    }
  }

  private startJump(time: number, castle: Castle): void {
    const targetX = Math.max(castle.width + this.runDistance - 30, this.x - Phaser.Math.Between(245, 330));
    this.jumpPhase = 'jumping';
    this.jumpStartedAt = time;
    this.jumpStartX = this.x;
    this.jumpStartY = this.y;
    this.jumpTargetX = targetX;
    this.jumpDuration = Phaser.Math.Between(720, 880);
    this.statusText.setText('');
    this.setScale(1);
  }

  private updateJump(time: number): void {
    const progress = Phaser.Math.Clamp((time - this.jumpStartedAt) / this.jumpDuration, 0, 1);
    const eased = Phaser.Math.Easing.Sine.InOut(progress);
    this.x = Phaser.Math.Linear(this.jumpStartX, this.jumpTargetX, eased);
    this.y = this.jumpStartY - Math.sin(progress * Math.PI) * 118;
    this.rotation = Math.sin(progress * Math.PI * 2) * 0.12;
    this.refreshDepth();

    if (progress >= 1) {
      this.x = this.jumpTargetX;
      this.y = this.groundY - this.stats.radius;
      this.rotation = 0;
      this.refreshDepth();
      this.jumpPhase = this.x <= 112 + this.runDistance ? 'running' : 'preparing';
      this.prepareStartedAt = 0;
    }
  }
}
