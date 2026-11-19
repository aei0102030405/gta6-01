// Particles and screen shake: skid dust, crash sparks, muzzle flashes, pickup glints.
// A fixed pool, allocated once; nothing allocates while the game runs.

const POOL = 220;
/** Strongest screen shake allowed, in pixels. */
const MAX_SHAKE = 14;

export function createEffects() {
  const parts = [];
  for (let i = 0; i < POOL; i += 1) {
    parts.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 3, color: '#ffffff' });
  }
  let shake = 0;
  let shakeX = 0;
  let shakeY = 0;

  function spawn(x, y, vx, vy, life, size, color) {
    for (const p of parts) {
      if (p.active) continue;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.life = life;
      p.maxLife = life;
      p.size = size;
      p.color = color;
      return;
    }
  }

  return {
    parts,
    /** Screen shake offset for this frame, set by update(). */
    get shakeX() {
      return shakeX;
    },
    get shakeY() {
      return shakeY;
    },
    addShake(amount) {
      shake = Math.min(MAX_SHAKE, shake + amount);
    },
    sparks(x, y, color, count) {
      for (let i = 0; i < (count || 10); i += 1) {
        const a = Math.random() * Math.PI * 2;
        const s = 60 + Math.random() * 220;
        spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.25 + Math.random() * 0.35, 2 + Math.random() * 3, color || '#f2c94c');
      }
    },
    dust(x, y, count) {
      for (let i = 0; i < (count || 4); i += 1) {
        spawn(
          x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40,
          0.4 + Math.random() * 0.4, 3 + Math.random() * 4, '#9a938a',
        );
      }
    },
    muzzle(x, y, angle) {
      for (let i = 0; i < 6; i += 1) {
        const a = angle + (Math.random() - 0.5) * 0.7;
        const s = 200 + Math.random() * 260;
        spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.08 + Math.random() * 0.08, 2 + Math.random() * 2, '#ffd76a');
      }
    },
    glint(x, y) {
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        spawn(x, y, Math.cos(a) * 90, Math.sin(a) * 90, 0.3, 2, '#f2c94c');
      }
    },
    update(dt) {
      for (const p of parts) {
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 1 - 2.4 * dt;
        p.vy *= 1 - 2.4 * dt;
      }
      if (shake > 0.2) {
        shakeX = (Math.random() - 0.5) * shake;
        shakeY = (Math.random() - 0.5) * shake;
        shake *= 1 - 5 * dt;
      } else {
        shakeX = 0;
        shakeY = 0;
        shake = 0;
      }
    },
  };
}
