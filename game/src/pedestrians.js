// Pedestrians: ordinary people walking the sidewalks of Solmar Bay. They stroll along
// a sidewalk, turn at intersections, and flee when scared (a punch, a gunshot, or a
// car coming at them). Knocked down by a fast car, they stay down a few seconds, then
// get up and run. Hitting one is a crime — the wanted system is told by the world.

import { CITY, PALETTE, PED, WORLD } from './config.js';

const STATE_WALK = 0;
const STATE_FLEE = 1;
const STATE_DOWN = 2;

export function createPedestrians(city, random) {
  const peds = [];

  function randomShirt() {
    return PALETTE.pedShirt[Math.floor(random() * PALETTE.pedShirt.length)];
  }

  function spawnPed(x, y) {
    const p = x === undefined ? city.randomSidewalkPoint() : { x, y };
    const road = city.nearestRoad(p.x, p.y);
    const ped = {
      x: p.x, y: p.y,
      angle: road.axis === 'v' ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI),
      speed: PED.walkSpeed + (random() - 0.5) * PED.walkJitter,
      shirt: randomShirt(),
      state: STATE_WALK,
      stateTimer: 0,
      axis: road.axis,
      active: true,
    };
    peds.push(ped);
    return ped;
  }

  function reset() {
    peds.length = 0;
    for (let i = 0; i < PED.count; i += 1) spawnPed();
  }

  function scare(x, y, radius) {
    for (const ped of peds) {
      if (!ped.active || ped.state === STATE_DOWN) continue;
      if (Math.hypot(ped.x - x, ped.y - y) < radius) {
        ped.state = STATE_FLEE;
        ped.stateTimer = 2 + random() * 2;
        ped.angle = Math.atan2(ped.y - y, ped.x - x);
      }
    }
  }

  function knockDown(ped) {
    ped.state = STATE_DOWN;
    ped.stateTimer = 3;
  }

  function step(dt, playerPos, playerSpeed) {
    for (const ped of peds) {
      if (!ped.active) continue;
      if (ped.state === STATE_DOWN) {
        ped.stateTimer -= dt;
        if (ped.stateTimer <= 0) {
          ped.state = STATE_FLEE;
          ped.stateTimer = 3;
          ped.angle = Math.atan2(ped.y - playerPos.y, ped.x - playerPos.x);
        }
        continue;
      }
      let speed = ped.speed;
      if (ped.state === STATE_FLEE) {
        speed = ped.speed * 2.6;
        ped.stateTimer -= dt;
        if (ped.stateTimer <= 0) ped.state = STATE_WALK;
      } else if (playerPos && playerSpeed > 300 && Math.hypot(ped.x - playerPos.x, ped.y - playerPos.y) < 90) {
        // A fast car bearing down on the sidewalk: run.
        ped.state = STATE_FLEE;
        ped.stateTimer = 1.5;
        ped.angle = Math.atan2(ped.y - playerPos.y, ped.x - playerPos.x);
        speed = ped.speed * 2.6;
      }
      ped.x += Math.cos(ped.angle) * speed * dt;
      ped.y += Math.sin(ped.angle) * speed * dt;
      // Stay on the sidewalks and inside the city: at a road crossing or the map
      // edge, pick a new direction along a sidewalk.
      const road = city.nearestRoad(ped.x, ped.y);
      const onWalk = city.onSidewalk(ped.x, ped.y);
      const offMap = ped.x < 24 || ped.x > WORLD.width - 24 || ped.y < 24 || ped.y > CITY.beachY - 24;
      if ((!onWalk && ped.state === STATE_WALK) || offMap) {
        ped.x = Math.max(24, Math.min(WORLD.width - 24, ped.x));
        ped.y = Math.max(24, Math.min(CITY.beachY - 24, ped.y));
        const axis = road.axis;
        const dir = random() < 0.5 ? -1 : 1;
        ped.angle = axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
        ped.axis = axis;
        // Nudge back onto the sidewalk band.
        const offset = CITY.roadWidth / 2 + 7;
        if (axis === 'v') ped.x = road.at + (ped.x > road.at ? offset : -offset);
        else ped.y = road.at + (ped.y > road.at ? offset : -offset);
      }
      // Don't walk through buildings.
      city.collideBuildings(ped, PED.radius);
    }
  }

  return { peds, reset, spawnPed, scare, knockDown, step, STATE_WALK, STATE_FLEE, STATE_DOWN };
}
