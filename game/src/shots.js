// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot that drives toward a target, so the frame is what a short game
// really looks like and the same seed always gives the same frame.

import { CITY, STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const DRIVE_SECONDS = 14;
const CHASE_SECONDS = 7;
const MISSION_SECONDS = 11;

/** The road the player is travelling along, from the car's heading (stable at crossings). */
function currentRoad(world) {
  const p = world.state.player;
  const angle = p.car ? p.car.angle : p.angle;
  const axis = Math.abs(Math.cos(angle)) >= Math.abs(Math.sin(angle)) ? 'h' : 'v';
  const roads = axis === 'v' ? CITY.verticalRoads : CITY.horizontalRoads;
  let best = roads[0];
  let bestD = Infinity;
  for (const r of roads) {
    const d = Math.abs((axis === 'v' ? p.x : p.y) - r);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return { axis, at: best };
}

/**
 * The next waypoint on the road network toward the target: the car follows roads
 * instead of cutting across blocks, so it does not wedge into buildings. On a road
 * that crosses the target's road, the waypoint is their crossing; on a parallel
 * road, it is the crossing with the perpendicular road nearest the target.
 */
function waypointFor(world, target) {
  const state = world.state;
  const p = state.player;
  const city = state.city;
  const from = currentRoad(world);
  const to = city.nearestRoad(target.x, target.y);
  const onRoadNow = city.onRoad(p.x, p.y);
  if (!onRoadNow) {
    return from.axis === 'v' ? { x: from.at, y: p.y } : { x: p.x, y: from.at };
  }
  if (from.axis === to.axis && Math.abs(from.at - to.at) < 4) return target;
  if (from.axis !== to.axis) {
    return from.axis === 'v' ? { x: from.at, y: to.at } : { x: to.at, y: from.at };
  }
  let crossAt;
  if (from.axis === 'v') {
    crossAt = CITY.horizontalRoads.reduce(
      (best, ry) => (Math.abs(ry - target.y) < Math.abs(best - target.y) ? ry : best),
      CITY.horizontalRoads[0],
    );
    return { x: from.at, y: crossAt };
  }
  crossAt = CITY.verticalRoads.reduce(
    (best, rx) => (Math.abs(rx - target.x) < Math.abs(best - target.x) ? rx : best),
    CITY.verticalRoads[0],
  );
  return { x: crossAt, y: from.at };
}

/** A fake input device that steers the player (on foot or in a car) toward a target. */
function pilotInput(world, target) {
  const p = world.state.player;
  const wp = waypointFor(world, target);
  const dx = wp.x - p.x;
  const dy = wp.y - p.y;
  const dist = Math.hypot(dx, dy);
  if (p.inCar && p.car) {
    const want = Math.atan2(dy, dx);
    let diff = want - p.car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.5));
    const throttle = Math.abs(diff) > 1.4 ? 0.25 : 1;
    return {
      moveX: () => steer,
      moveY: () => -throttle,
      running: () => false,
      braking: () => Math.abs(diff) > 2.2,
      mouse: { x: 640, y: 360, down: false },
      takeActions: () => 0,
    };
  }
  const nx = dist > 1 ? dx / dist : 0;
  const ny = dist > 1 ? dy / dist : 0;
  return {
    moveX: () => (Math.abs(nx) > 0.3 ? Math.sign(nx) : 0),
    moveY: () => (Math.abs(ny) > 0.3 ? Math.sign(ny) : 0),
    running: () => true,
    braking: () => false,
    mouse: { x: 640, y: 360, down: false },
    takeActions: () => 0,
  };
}

/** Step the world for `seconds`, steering toward the target from `getTarget`. */
function playFor(world, seconds, getTarget) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, pilotInput(world, getTarget()), 0, () => {});
  }
}

/**
 * A target cycler for cruising: the autopilot drives toward the current target,
 * and when the car gets close it moves on to the next far road point, so the car
 * is always moving instead of stalling at the destination.
 */
function makeCruiser(world, targets) {
  let index = 0;
  return () => {
    const p = world.state.player;
    const target = targets[index];
    if (p.inCar && Math.hypot(p.x - target.x, p.y - target.y) < 160) {
      index = (index + 1) % targets.length;
    }
    return targets[index];
  };
}

/** Put the player in the nearest parked car (no crime: it is unoccupied). */
function takeParkedCar(world) {
  const state = world.state;
  let best = null;
  let bestD = Infinity;
  for (const car of state.vehicles.parked) {
    if (!car.active || car.occupied) continue;
    const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (!best) return false;
  // Walk to the car first so the theft reads as a real approach.
  playFor(world, 2, () => ({ x: best.x, y: best.y }));
  world.enterCar(best);
  return true;
}

/**
 * Set `world` to the named scene (start, drive, chase or mission; any other name is
 * start) and return the screen to draw over it.
 */
export function stageShot(name, world) {
  world.reset(null);
  const state = world.state;
  if (name !== 'drive' && name !== 'chase' && name !== 'mission') {
    // Title: the city alive behind the menu — traffic rolling, people walking.
    playFor(world, START_SECONDS, () => ({ x: 1400, y: 1000 }));
    return { screen: SCREEN_TITLE };
  }
  if (name === 'drive') {
    takeParkedCar(world);
    // Cruise the city with traffic around, always moving.
    const cruise = makeCruiser(world, [{ x: 2600, y: 600 }, { x: 300, y: 2200 }, { x: 2800, y: 200 }]);
    playFor(world, DRIVE_SECONDS, cruise);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    takeParkedCar(world);
    // Three stars and two black-and-whites on the tail.
    state.police.setWanted(3);
    const cruise = makeCruiser(world, [{ x: 1000, y: 1400 }, { x: 2600, y: 1800 }, { x: 600, y: 600 }]);
    playFor(world, CHASE_SECONDS, cruise);
    return { screen: SCREEN_PLAY };
  }
  // Mission: Marla's first job — a stolen car, the garage marker, the objective up top.
  takeParkedCar(world);
  const cruise = makeCruiser(world, [{ x: 2600, y: 600 }, { x: 300, y: 2200 }, { x: 2800, y: 200 }]);
  playFor(world, MISSION_SECONDS, cruise);
  return { screen: SCREEN_PLAY };
}
