// Combat: bullets and fists. The player fires a pistol (F or mouse click) toward the
// aim point; police fire back at high wanted levels. A bullet is a point with a
// velocity and a range; it stops at the first thing it hits — a building, a car, a
// pedestrian, or the player. Punching (G) hits anything close in front of the player.
// All damage flows through callbacks the world owns, so this file knows no rules.

const POOL = 48;
/** How far in front of the shooter a bullet spawns. */
const MUZZLE_OFFSET = 20;

export function createCombat() {
  const bullets = [];
  for (let i = 0; i < POOL; i += 1) {
    bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, range: 0, damage: 0, fromPolice: false });
  }

  function fire(x, y, angle, speed, range, damage, fromPolice) {
    for (const b of bullets) {
      if (b.active) continue;
      b.active = true;
      b.x = x + Math.cos(angle) * MUZZLE_OFFSET;
      b.y = y + Math.sin(angle) * MUZZLE_OFFSET;
      b.vx = Math.cos(angle) * speed;
      b.vy = Math.sin(angle) * speed;
      b.range = range;
      b.damage = damage;
      b.fromPolice = fromPolice;
      return b;
    }
    return null;
  }

  /**
   * Advance bullets one step. `hit` is called with (bullet, x, y) when one reaches a
   * solid surface; the caller decides what it struck and returns true to stop it.
   */
  function step(dt, hit) {
    for (const b of bullets) {
      if (!b.active) continue;
      const nx = b.x + b.vx * dt;
      const ny = b.y + b.vy * dt;
      b.range -= Math.hypot(b.vx * dt, b.vy * dt);
      if (b.range <= 0) {
        b.active = false;
        continue;
      }
      if (hit(b, nx, ny)) {
        b.active = false;
        continue;
      }
      b.x = nx;
      b.y = ny;
    }
  }

  function clear() {
    for (const b of bullets) b.active = false;
  }

  return { bullets, fire, step, clear };
}
