import Phaser from 'phaser';

export class Projectile extends Phaser.GameObjects.Container {
  private vx: number;
  private vy: number;
  private traveled = 0;
  private readonly maxDistance: number;
  private readonly ownerScene: Phaser.Scene;
  private isDestroyed = false;
  private lastAngle = 0;
  private homingHandler?: (_time: number, delta: number) => void;
  private shaft: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    speed: number,
    color: number,
    private onHit: () => void
  ) {
    super(scene, x, y);
    this.ownerScene = scene;
    const angle = Phaser.Math.Angle.Between(x, y, targetX, targetY);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.lastAngle = angle;
    this.maxDistance = Phaser.Math.Distance.Between(x, y, targetX, targetY);
    this.shaft = scene.add.rectangle(0, 0, 22, 4, color).setOrigin(0.2, 0.5);
    this.rotation = angle;
    this.add(this.shaft);
    scene.add.existing(this);
    this.setDepth(20);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.updateProjectile, this);
  }

  static homing(
    scene: Phaser.Scene,
    x: number,
    y: number,
    getTarget: () => { x: number; y: number; alive?: boolean; stats?: { radius: number } } | undefined,
    speed: number,
    color: number,
    onHit: () => void
  ): Projectile {
    const initialTarget = getTarget();
    const projectile = new Projectile(scene, x, y, initialTarget?.x ?? x, initialTarget?.y ?? y, speed, color, onHit);
    projectile.enableHoming(getTarget, speed);
    return projectile;
  }

  private enableHoming(
    getTarget: () => { x: number; y: number; alive?: boolean; stats?: { radius: number } } | undefined,
    speed: number
  ): void {
    this.ownerScene.events.off(Phaser.Scenes.Events.UPDATE, this.updateProjectile, this);
    this.traveled = 0;
    this.homingHandler = (_time: number, delta: number) => {
      if (this.isDestroyed) return;
      const target = getTarget();
      if (!target || target.alive === false) {
        this.destroyProjectile();
        return;
      }

      const distance = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
      const hitRadius = Math.max(16, (target.stats?.radius ?? 12) + 6);
      if (distance <= hitRadius) {
        this.destroyProjectile();
        this.onHit();
        return;
      }

      const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
      this.lastAngle = angle;
      const step = Math.min(distance, speed * (delta / 1000));
      this.x += Math.cos(angle) * step;
      this.y += Math.sin(angle) * step;
      this.traveled += step;
      this.rotation = angle;

      if (this.traveled > 1100) {
        this.destroyProjectile();
      }
    };
    this.ownerScene.events.on(Phaser.Scenes.Events.UPDATE, this.homingHandler);
  }

  private updateProjectile(_time: number, delta: number): void {
    const dt = delta / 1000;
    const dx = this.vx * dt;
    const dy = this.vy * dt;
    this.x += dx;
    this.y += dy;
    this.traveled += Math.sqrt(dx * dx + dy * dy);
    if (this.traveled >= this.maxDistance) {
      this.destroyProjectile();
      this.onHit();
    }
  }

  private destroyProjectile(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.ownerScene.events.off(Phaser.Scenes.Events.UPDATE, this.updateProjectile, this);
    if (this.homingHandler) {
      this.ownerScene.events.off(Phaser.Scenes.Events.UPDATE, this.homingHandler);
    }
    this.destroy();
  }
}
