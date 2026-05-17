import Phaser from 'phaser';
import type { Castle } from '../entities/Castle';
import type { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { WizardEnemy } from '../entities/WizardEnemy';

export class ArcherSystem {
  private nextShotAt = 0;
  private readonly fireRate = 1032;
  private readonly damage = 3;
  private readonly range = 500;
  private readonly arrowSpeed = 900;
  // Shoot anim runs at 14 fps over 8 frames (~570ms). Release / bowstring
  // snap is around frame 4 (~285ms in) -- delay the projectile spawn to
  // match so the arrow visually leaves the bow as the archer releases.
  private readonly releaseDelayMs = 280;
  // If the target moved more than this many px from where the arrow was
  // aimed by the time the arrow lands, the shot misses (no damage). Keeps
  // arrows that visibly fly past an empty spot from still scoring hits.
  private readonly missToleranceSq = 42 * 42;

  constructor(private scene: Phaser.Scene, private castle: Castle, private getEnemies: () => Enemy[]) {}

  update(time: number): void {
    const livingArchers = this.castle.getLivingArcherCount();
    if (livingArchers <= 0 || time < this.nextShotAt) return;
    const shooter = this.castle.getLivingArcherTarget();
    const targets = this.getEnemies().filter((enemy) => this.canShootTarget(enemy, this.range));
    const target = Phaser.Utils.Array.GetRandom(targets);
    if (!target || !shooter) return;
    this.nextShotAt = time + this.fireRate;
    // Plays the shoot anim on the firing archer.
    this.castle.animateArcherShot(shooter);
    // Delay the projectile spawn so it visually leaves the bow on the
    // anim's release frame, not at frame 0 of the draw. Lead the target
    // INSIDE the delayedCall using the position/velocity at spawn time
    // (naturally accounts for movement during the 280ms anim delay).
    this.scene.time.delayedCall(this.releaseDelayMs, () => {
      if (!this.canShootTarget(target, this.range)) return;
      const sx = shooter.x + 12;
      const sy = shooter.y + 4;
      const fireTime = this.scene.time.now;
      const aim = this.predictAim(sx, sy, target, fireTime, this.arrowSpeed);
      new Projectile(this.scene, sx, sy, aim.x, aim.y, this.arrowSpeed, 0xf59e0b, () => {
        if (!this.canShootTarget(target, this.range)) return;
        // Miss check: if the target moved further than the tolerance
        // from the predicted impact point, the arrow lands in empty
        // space and no damage applies. Prevents the "shot looks like
        // it missed but the enemy still got hit" feel that read as AOE.
        const dx = aim.x - target.x;
        const dy = aim.y - target.y;
        if (dx * dx + dy * dy > this.missToleranceSq) return;
        if (target instanceof WizardEnemy && target.hasActiveShield()) {
          target.pulseShield();
          return;
        }
        if (target.alive) target.takeDamage(this.damage);
      }, 'arrow-castle');
    });
  }

  // Solve for the aim point that intercepts a moving target. Treats target
  // velocity as (-stats.speed, 0) for walking-state enemies (slow-aware),
  // (0, 0) otherwise (stationary -- ShootCastle/AttackCastle/Stunned).
  // Returns the target's current position when no real intercept exists
  // (target faster than the arrow + heading directly away).
  private predictAim(sx: number, sy: number, target: Enemy, time: number, speed: number): { x: number; y: number } {
    const tx = target.x;
    const ty = target.y;
    const isWalking = target.state === 'WalkToCastle' || target.state === 'WalkToRange';
    const slow = time < target.isSlowedUntil ? 0.45 : 1;
    const tvx = isWalking ? -(target.stats.speed ?? 0) * slow : 0;
    const tvy = 0;
    const dx = tx - sx;
    const dy = ty - sy;
    // Quadratic: (tvx² + tvy² - speed²) t² + 2 (dx tvx + dy tvy) t + (dx² + dy²) = 0
    const a = tvx * tvx + tvy * tvy - speed * speed;
    const b = 2 * (dx * tvx + dy * tvy);
    const c = dx * dx + dy * dy;
    if (a === 0) return { x: tx, y: ty };
    const disc = b * b - 4 * a * c;
    if (disc < 0) return { x: tx, y: ty };
    const sqrtDisc = Math.sqrt(disc);
    const t1 = (-b - sqrtDisc) / (2 * a);
    const t2 = (-b + sqrtDisc) / (2 * a);
    const positive = [t1, t2].filter((t) => t > 0);
    if (positive.length === 0) return { x: tx, y: ty };
    const t = Math.min(...positive);
    return { x: tx + tvx * t, y: ty + tvy * t };
  }

  private canShootTarget(enemy: Enemy, range: number): boolean {
    if (!enemy.alive) return false;
    if (enemy.state === 'Flying' || enemy.state === 'Grabbed') return false;
    return enemy.x - this.castle.width <= range;
  }
}
