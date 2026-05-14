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
  private shaft: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite;
  // Sprite-backed projectiles (arrows) leave a fading motion streak; the
  // plain colored-rectangle bolts (magic) do not.
  private readonly hasTrail: boolean;
  private lastTrailAt = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    speed: number,
    color: number,
    private onHit: () => void,
    textureKey?: string
  ) {
    super(scene, x, y);
    this.ownerScene = scene;
    const angle = Phaser.Math.Angle.Between(x, y, targetX, targetY);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.lastAngle = angle;
    this.maxDistance = Phaser.Math.Distance.Between(x, y, targetX, targetY);
    this.shaft = textureKey
      ? scene.add.sprite(0, 0, textureKey)
      : scene.add.rectangle(0, 0, 22, 4, color).setOrigin(0.2, 0.5);
    this.hasTrail = textureKey !== undefined;
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
    onHit: () => void,
    textureKey?: string
  ): Projectile {
    const initialTarget = getTarget();
    const projectile = new Projectile(scene, x, y, initialTarget?.x ?? x, initialTarget?.y ?? y, speed, color, onHit, textureKey);
    projectile.enableHoming(getTarget, speed);
    return projectile;
  }

  private enableHoming(
    getTarget: () => { x: number; y: number; alive?: boolean; stats?: { radius: number } } | undefined,
    speed: number
  ): void {
    this.ownerScene.events.off(Phaser.Scenes.Events.UPDATE, this.updateProjectile, this);
    this.traveled = 0;
    this.homingHandler = (time: number, delta: number) => {
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
      this.maybeTrail(time);

      if (this.traveled > 1100) {
        this.destroyProjectile();
      }
    };
    this.ownerScene.events.on(Phaser.Scenes.Events.UPDATE, this.homingHandler);
  }

  private updateProjectile(time: number, delta: number): void {
    const dt = delta / 1000;
    const dx = this.vx * dt;
    const dy = this.vy * dt;
    this.x += dx;
    this.y += dy;
    this.traveled += Math.sqrt(dx * dx + dy * dy);
    this.maybeTrail(time);
    if (this.traveled >= this.maxDistance) {
      this.destroyProjectile();
      this.onHit();
    }
  }

  // Drop a short streak at the current position, aligned to the flight
  // angle, that fades out where the projectile just was. Throttled so the
  // streak count stays sane on high-refresh displays.
  private maybeTrail(time: number): void {
    if (!this.hasTrail || time - this.lastTrailAt < 22) return;
    this.lastTrailAt = time;
    const streak = this.ownerScene.add
      .rectangle(this.x, this.y, 14, 3, 0xffffff, 0.38)
      .setRotation(this.lastAngle)
      .setDepth(19);
    this.ownerScene.tweens.add({
      targets: streak,
      alpha: 0,
      scaleX: 0.4,
      duration: 140,
      onComplete: () => streak.destroy()
    });
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
