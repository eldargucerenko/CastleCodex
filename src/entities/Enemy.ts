import Phaser from 'phaser';
import { ENEMY_STATS } from '../data/enemies';
import type { BurningState, EnemyKind, EnemyState, EnemyStats, WizardState } from '../types/game';
import type { Castle } from './Castle';

export class Enemy extends Phaser.GameObjects.Container {
  readonly stats: EnemyStats;
  readonly kind: EnemyKind;
  hp: number;
  state: EnemyState = 'Spawn';
  burningState?: BurningState;
  wizardState?: WizardState;
  isSlowedUntil = 0;
  vx = 0;
  vy = 0;
  lastAttackAt = 0;
  isGrabbed = false;
  justDied = false;
  readonly groundY: number;
  protected shape: Phaser.GameObjects.Graphics;
  protected labelText: Phaser.GameObjects.Text;
  protected statusText: Phaser.GameObjects.Text;
  protected hpBar: Phaser.GameObjects.Rectangle;
  protected hpBack: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: EnemyKind, groundY?: number) {
    super(scene, x, y);
    this.kind = kind;
    this.stats = ENEMY_STATS[kind];
    this.hp = this.stats.hp;
    this.groundY = groundY ?? Number(scene.game.config.height) - 72;

    this.shape = scene.add.graphics();
    this.labelText = scene.add.text(0, 0, this.stats.label, { color: '#ffffff', fontSize: '12px', fontStyle: 'bold' }).setOrigin(0.5);
    this.statusText = scene.add.text(0, -this.stats.radius - 26, '', { color: '#111827', fontSize: '12px', fontStyle: 'bold' }).setOrigin(0.5);
    this.hpBack = scene.add.rectangle(0, -this.stats.radius - 11, this.stats.radius * 2, 4, 0x111827).setOrigin(0.5);
    this.hpBar = scene.add.rectangle(0, -this.stats.radius - 11, this.stats.radius * 2, 4, 0x22c55e).setOrigin(0.5);
    this.add([this.shape, this.labelText, this.statusText, this.hpBack, this.hpBar]);
    scene.add.existing(this);
    this.setDepth(10);
    this.setSize(this.stats.radius * 2, this.stats.radius * 2);
    this.state = 'WalkToCastle';
    this.draw();
    this.refreshDepth();
  }

  get canBeGrabbed(): boolean {
    if (this.state === 'Dead' || this.state === 'Grabbed') return false;
    if (this.kind === 'burning' && this.burningState !== 'Cooled') return false;
    if (this.kind.startsWith('wizard') && (this.wizardState === 'Shielded' || this.wizardState === 'Unlocking')) return false;
    return true;
  }

  get alive(): boolean {
    return this.state !== 'Dead';
  }

  containsPoint(x: number, y: number): boolean {
    return Phaser.Math.Distance.Between(this.x, this.y, x, y) <= this.stats.radius + 12;
  }

  grab(): void {
    this.isGrabbed = true;
    this.state = 'Grabbed';
    this.vx = 0;
    this.vy = 0;
    this.setScale(1.12);
    this.setDepth(50);
    this.draw();
  }

  followPointer(x: number, y: number): void {
    const liftPenalty = y < this.y ? 0.68 / this.stats.mass : 1;
    const follow = this.stats.dragFollow;
    this.x += (x - this.x) * follow;
    this.y += (y - this.y) * follow * liftPenalty;
  }

  release(vx: number, vy: number): void {
    this.isGrabbed = false;
    const scaledVx = vx * this.stats.throwMultiplier;
    const scaledVy = vy * this.stats.throwMultiplier;
    const speed = Math.sqrt(scaledVx * scaledVx + scaledVy * scaledVy);
    const maxThrowSpeed = 780 / Math.sqrt(this.stats.mass);
    const clamp = speed > maxThrowSpeed ? maxThrowSpeed / speed : 1;
    this.launch(scaledVx * clamp, scaledVy * clamp);
  }

  launch(vx: number, vy: number): void {
    this.isGrabbed = false;
    this.state = 'Flying';
    this.vx = vx;
    this.vy = vy;
    this.setScale(1);
    this.setDepth(10);
    this.refreshDepth();
    this.scene.tweens.add({
      targets: this,
      alpha: 0.6,
      duration: 80,
      yoyo: true,
      repeat: 1
    });
  }

  takeDamage(amount: number): boolean {
    if (this.state === 'Dead') return false;
    this.hp -= amount;
    this.scene.tweens.add({ targets: this, scaleX: 1.18, scaleY: 1.18, yoyo: true, duration: 70 });
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    this.draw();
    return false;
  }

  die(): void {
    if (this.state === 'Dead') return;
    this.state = 'Dead';
    this.justDied = true;
    this.visible = false;
    this.active = false;
  }

  updateEnemy(time: number, delta: number, castle: Castle, _enemies: Enemy[] = []): void {
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
      }
      return;
    }

    this.state = 'WalkToCastle';
    const slow = time < this.isSlowedUntil ? 0.45 : 1;
    this.x -= this.stats.speed * slow * (delta / 1000);
    this.refreshDepth();
  }

  protected updateFlying(delta: number, castle: Castle): void {
    const dt = delta / 1000;
    this.vy += 900 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.refreshDepth();

    if (this.y < -20) {
      const frameScale = delta / 16.666;
      this.vx *= Math.pow(0.88, frameScale);
      if (this.vy < 0) {
        this.vy *= Math.pow(0.72, frameScale);
      }
    }

    const castleWallX = castle.width + this.stats.radius + 2;
    if (this.x < castleWallX) {
      this.x = castleWallX;
      this.vx = Math.abs(this.vx) * 0.42;
      if (Math.abs(this.vx) + Math.abs(this.vy) > 520) {
        this.scene.cameras.main.shake(110, 0.003);
        this.spawnImpact();
      }
    }

    const rightWallX = Number(this.scene.game.config.width) - this.stats.radius - 4;
    if (this.x > rightWallX) {
      this.x = rightWallX;
      this.vx = -Math.abs(this.vx) * 0.42;
      if (Math.abs(this.vx) + Math.abs(this.vy) > 520) {
        this.scene.cameras.main.shake(90, 0.0025);
        this.spawnImpact();
      }
    }

    if (this.y >= this.groundY - this.stats.radius) {
      this.y = this.groundY - this.stats.radius;
      const impactSpeed = Math.abs(this.vy);
      const impactThreshold = 520 + this.stats.mass * 55;
      if (impactSpeed > impactThreshold) {
        const damage = Math.round((impactSpeed - impactThreshold) * this.stats.collisionDamageFactor);
        this.takeDamage(damage);
        this.scene.cameras.main.shake(Math.min(220, impactSpeed / 4), Math.min(0.008, impactSpeed / 100000));
        this.spawnImpact();
      }
      this.vy *= -0.34;
      this.vx *= 0.72;
      if (Math.abs(this.vy) < 80 && Math.abs(this.vx) < 35) {
        this.state = 'Stunned';
        this.scene.time.delayedCall(520, () => {
          if (this.state === 'Stunned') this.state = 'WalkToCastle';
        });
      }
    }

    if (this.y > Number(this.scene.game.config.height) + 180) {
      this.die();
    }
  }

  protected spawnImpact(): void {
    const ring = this.scene.add.circle(this.x, this.groundY, 4, 0xffffff, 0.45).setDepth(3);
    this.scene.tweens.add({
      targets: ring,
      radius: 32,
      alpha: 0,
      duration: 220,
      onComplete: () => ring.destroy()
    });
  }

  protected refreshDepth(): void {
    if (this.state === 'Grabbed') return;
    this.setDepth(10 + this.y / 10);
  }

  protected draw(extraColor?: number): void {
    this.shape.clear();
    const radius = this.stats.radius;
    const color = extraColor ?? this.stats.color;
    this.shape.lineStyle(3, 0x111827, 1);
    this.shape.fillStyle(color, 1);
    this.shape.fillCircle(0, 0, radius);
    this.shape.lineBetween(-radius * 0.65, radius * 0.9, -radius * 0.25, radius * 1.7);
    this.shape.lineBetween(radius * 0.65, radius * 0.9, radius * 0.25, radius * 1.7);
    this.shape.lineBetween(-radius * 0.9, radius * 0.1, -radius * 1.35, radius * 0.8);
    this.shape.lineBetween(radius * 0.9, radius * 0.1, radius * 1.35, radius * 0.8);
    this.hpBar.width = Math.max(0, (this.hp / this.stats.hp) * this.stats.radius * 2);
    this.hpBar.x = -(this.stats.radius - this.hpBar.width / 2);
  }
}
