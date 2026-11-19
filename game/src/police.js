// The wanted system and the Solmar Bay police. Crimes raise the wanted level (1 to 5
// stars); police cars spawn at the edge of the player's view and chase, ram, and —
// from three stars — shoot. Stay out of trouble and out of sight, and the heat fades:
// after a quiet stretch the level drops a star at a time. A disabled police car stops
// chasing and smokes until it is towed away.

import { CITY, POLICE, WORLD } from './config.js';

export function createPolice(city, vehicles, random) {
  const cops = [];
  let wanted = 0;
  let quietTimer = 0;
  let decayTimer = 0;

  function setWanted(level) {
    const next = Math.max(0, Math.min(5, level));
    const raised = next > wanted;
    wanted = next;
    quietTimer = 0;
    decayTimer = 0;
    return raised;
  }

  function addWanted(amount) {
    return setWanted(wanted + amount);
  }

  function spawnCop(px, py) {
    // Pick a road point 550-850px from the player, roughly off-screen.
    for (let tries = 0; tries < 12; tries += 1) {
      const p = city.randomRoadPoint();
      const d = Math.hypot(p.x - px, p.y - py);
      if (d > 520 && d < 900) {
        const car = vehicles.makeCar(p.x, p.y, 0, '#2f6fb5', 'police');
        car.health = POLICE.carHealth;
        car.ramTimer = 0;
        car.shootTimer = 1 + random();
        car.speed = 0;
        car.active = true;
        cops.push(car);
        vehicles.cars.push(car);
        return car;
      }
    }
    return null;
  }

  function removeCop(car) {
    const i = cops.indexOf(car);
    if (i >= 0) cops.splice(i, 1);
    const j = vehicles.cars.indexOf(car);
    if (j >= 0) vehicles.cars.splice(j, 1);
  }

  function reset() {
    for (const cop of [...cops]) removeCop(cop);
    wanted = 0;
    quietTimer = 0;
    decayTimer = 0;
  }

  /**
   * One step. `player` is {x, y, inCar, car} and `harm` is a callback the world
   * provides: harm('ram' | 'bullet', damage, x, y). Returns the nearest cop distance
   * (Infinity when none) for the siren.
   */
  function step(dt, player, harm) {
    // Keep the number of active cops matched to the wanted level.
    while (cops.filter((c) => !c.disabled).length < wanted) {
      if (!spawnCop(player.x, player.y)) break;
    }
    let nearest = Infinity;
    for (const cop of [...cops]) {
      if (!cop.active) continue;
      const dx = player.x - cop.x;
      const dy = player.y - cop.y;
      const dist = Math.hypot(dx, dy);
      if (dist < nearest) nearest = dist;
      if (cop.disabled) {
        cop.smokeTimer -= dt;
        cop.speed *= 1 - 3 * dt;
        cop.x += Math.cos(cop.angle) * cop.speed * dt;
        cop.y += Math.sin(cop.angle) * cop.speed * dt;
        if (cop.smokeTimer <= 0) removeCop(cop);
        continue;
      }
      // Chase: steer toward the player, faster than traffic, with a little wobble.
      const wantAngle = Math.atan2(dy, dx);
      let diff = wantAngle - cop.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cop.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
      cop.speed += (POLICE.carSpeed - cop.speed) * Math.min(1, 1.6 * dt);
      // Move on each axis separately so the car slides along walls instead of
      // cutting across a block and wedging into a building corner.
      const stepX = Math.cos(cop.angle) * cop.speed * dt;
      const stepY = Math.sin(cop.angle) * cop.speed * dt;
      if (!city.hitsBuilding(cop.x + stepX, cop.y, 26)) cop.x += stepX;
      if (!city.hitsBuilding(cop.x, cop.y + stepY, 26)) cop.y += stepY;
      cop.x = Math.max(20, Math.min(WORLD.width - 20, cop.x));
      cop.y = Math.max(20, Math.min(CITY.beachY - 20, cop.y));
      // Belt and braces: a shove from another car can leave a cop inside a
      // building's edge; push back out so it never sits in a wall.
      city.collideBuildings(cop, 26);
      // Ram: touching the player (on foot or in a car) hurts, with a cooldown.
      cop.ramTimer -= dt;
      if (dist < 46 && cop.ramTimer <= 0) {
        cop.ramTimer = POLICE.ramCooldown;
        cop.speed *= 0.4;
        harm('ram', POLICE.ramDamage, cop.x, cop.y);
      }
      // Shoot from three stars, only with a roughly clear line and some range.
      cop.shootTimer -= dt;
      if (wanted >= POLICE.shootWanted && dist < 520 && dist > 90 && cop.shootTimer <= 0) {
        cop.shootTimer = POLICE.shootInterval + random() * 0.7;
        harm('shoot', 0, cop.x, cop.y);
      }
      // A cop that lost the player far away gives up and despawns.
      if (wanted === 0 && dist > 900) removeCop(cop);
    }
    // Wanted decay: only while quiet (no new crime) and no cop nearby.
    if (wanted > 0) {
      quietTimer += dt;
      if (quietTimer > POLICE.decayDelay && nearest > 420) {
        decayTimer += dt;
        if (decayTimer >= POLICE.decayInterval) {
          decayTimer = 0;
          wanted -= 1;
          // Extra cops leave when the level falls.
          const active = cops.filter((c) => !c.disabled);
          while (active.length > wanted) removeCop(active.pop());
        }
      }
    }
    return nearest;
  }

  return {
    cops,
    get wanted() {
      return wanted;
    },
    setWanted, addWanted, reset, step, spawnCop, removeCop,
  };
}
