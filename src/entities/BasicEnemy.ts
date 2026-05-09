import Phaser from 'phaser';
import { Enemy } from './Enemy';
import type { Castle } from './Castle';
import type { EnemyState } from '../types/game';

// Knight-only animation keys (created in BootScene). Walk/run come from the
// base ANIMATED_BY_KIND map; these are the extras we drive on events.
const KNIGHT_AIR = 'enemy-knight-air';
const KNIGHT_GETUP = 'enemy-knight-getup';
const KNIGHT_HURT = 'enemy-knight-hurt';
const KNIGHT_STRIKES = ['enemy-knight-strike1', 'enemy-knight-strike2'] as const;

export class BasicEnemy extends Enemy {
  private prevState: EnemyState = 'Spawn';

  constructor(scene: Phaser.Scene, x: number, y: number, groundY?: number) {
    super(scene, x, y, 'basic', groundY);
  }

  override containsPoint(x: number, y: number): boolean {
    const halfW = 50;
    const halfH = 70;
    return Math.abs(x - this.x) <= halfW && Math.abs(y - (this.y - 18)) <= halfH;
  }

  override updateEnemy(time: number, delta: number, castle: Castle, enemies: Enemy[] = []): void {
    const beforeAttackAt = this.lastAttackAt;
    super.updateEnemy(time, delta, castle, enemies);

    // Sword swing on each landed attack tick. Picks strike1 or strike2 at
    // random so multiple knights attacking at the same time don't sync up
    // and so we don't depend on a per-instance counter that was apparently
    // sticking on strike2 in some runs.
    if (this.state === 'AttackCastle' && this.lastAttackAt !== beforeAttackAt) {
      const key = KNIGHT_STRIKES[Math.random() < 0.5 ? 0 : 1];
      this.playOneShotAnim(key);
    }

    // State-driven anim swaps. Each transition cancels whatever was playing
    // (strike mid-swing, walk loop, etc.) so the new state's anim takes over
    // immediately instead of waiting for the previous one-shot to complete.
    // Note: Stunned doesn't need its own branch -- onGroundHit already
    // played getup the moment the knight first touched ground.
    if (this.state !== this.prevState) {
      if (this.state === 'Flying' || this.state === 'Grabbed') {
        // Same panic loop while dangling in the player's hand and while
        // flying through the air -- both read as "the knight is not happy".
        this.playLoopAnim(KNIGHT_AIR);
      } else if (this.state === 'Dead') {
        this.cancelChibiAnim();
      } else if (
        (this.state === 'WalkToCastle' || this.state === 'AttackCastle') &&
        this.prevState !== 'WalkToCastle' &&
        this.prevState !== 'AttackCastle' &&
        this.chibiAnimKey
      ) {
        // Recovered from a non-walking state (Flying / Stunned / Grabbed):
        // resume the regular walk loop. updateWalkAnimation will then
        // pause/resume frame 0 based on actual movement.
        this.playLoopAnim(this.chibiAnimKey);
      }
      this.prevState = this.state;
    }
  }

  protected override onGroundHit(_impactSpeed: number): void {
    // First time the knight touches ground after being launched: stop the
    // air-panic loop and play the getup animation immediately, instead of
    // waiting for the bounces to settle and Stunned to fire.
    this.playOneShotAnim(KNIGHT_GETUP);
  }

  override takeDamage(amount: number): boolean {
    const died = super.takeDamage(amount);
    if (!died && this.state !== 'Flying' && this.state !== 'Stunned') {
      // Don't blip the hurt anim mid-air; the air-panic loop reads as the
      // hurt response already. Hurt only on grounded hits (mostly arrows).
      this.playOneShotAnim(KNIGHT_HURT);
    }
    return died;
  }
}
