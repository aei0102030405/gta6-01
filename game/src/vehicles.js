// Cars: the player's ride and the city's traffic. A car is a position, a heading and a
// speed; traffic cars drive along road centre lines and turn at intersections, parked
// cars wait at the kerb. Driving physics are arcade-simple: accelerate, steer by speed,
// brake and reverse, with building and car-to-car collision. A stolen traffic car keeps
// its driver out on the street — the driver becomes a fleeing pedestrian.

import { CAR, CITY, TRAFFIC, WORLD } from './config.js';

const TWO_PI = Math.PI * 2;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TWO_PI;
  while (d < -Math.PI) d += TWO_PI;
  return d;
}

function makeCar(x, y, angle, color, kind) {
  return {
    x, y, angle, speed: 0, color, kind: kind || 'traffic',
    /** Traffic cars only: the road axis they follow and their target intersection. */
    axis: 'h', dir: 1, target: 0,
    /** Police cars only: health and ram cooldown. */
    health: 0, ramTimer: 0, shootTimer: 0, disabled: false, smokeTimer: 0,
    /** Parked cars only: whether a driver is inside. */
    occupied: false,
    active: true,
  };
}

export function createVehicles(city, random) {
  const cars = [];
  const parked = [];

  function randomColor() {
    return TRAFFIC.colors[Math.floor(random() * TRAFFIC.colors.length)];
  }

  /** Put a traffic car on a road, heading along it. */
  function spawnTrafficCar(nearX, nearY) {
    let x = 0;
    let y = 0;
    let axis = 'h';
    let dir = 1;
    if (nearX !== undefined) {
      // Spawn on a road near the given point, off the player's screen.
      const road = city.nearestRoad(nearX, nearY);
      axis = road.axis;
      if (axis === 'v') {
        x = road.at + (random() < 0.5 ? -18 : 18);
        y = Math.max(60, Math.min(CITY.beachY - 60, nearY + (random() < 0.5 ? -1 : 1) * (500 + random() * 300)));
        dir = y > nearY ? -1 : 1;
      } else {
        y = road.at + (random() < 0.5 ? -18 : 18);
        x = Math.max(60, Math.min(WORLD.width - 60, nearX + (random() < 0.5 ? -1 : 1) * (500 + random() * 300)));
        dir = x > nearX ? -1 : 1;
      }
    } else {
      const p = city.randomRoadPoint();
      const road = city.nearestRoad(p.x, p.y);
      axis = road.axis;
      x = p.x;
      y = p.y;
      dir = random() < 0.5 ? -1 : 1;
    }
    const angle = axis === 'h' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const car = makeCar(x, y, angle, randomColor(), 'traffic');
    car.axis = axis;
    car.dir = dir;
    car.speed = TRAFFIC.speed + (random() - 0.5) * TRAFFIC.speedJitter;
    cars.push(car);
    return car;
  }

  /** Parked cars along the kerbs, some with a driver inside. */
  function spawnParked(count) {
    for (let i = 0; i < count; i += 1) {
      const p = city.randomRoadPoint();
      const road = city.nearestRoad(p.x, p.y);
      const side = random() < 0.5 ? -1 : 1;
      const along = road.axis === 'v' ? p.y : p.x;
      const across = road.at + side * (CITY.roadWidth / 2 - 16);
      const car = makeCar(
        road.axis === 'v' ? across : along,
        road.axis === 'v' ? along : across,
        road.axis === 'h' ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
        randomColor(), 'parked',
      );
      car.occupied = random() < 0.45;
      parked.push(car);
    }
  }

  function allCars() {
    return cars.concat(parked);
  }

  /** The nearest car (traffic or parked) within `range` of a point. */
  function nearestCar(x, y, range) {
    let best = null;
    let bestD = range;
    for (const car of allCars()) {
      if (!car.active) continue;
      const d = Math.hypot(car.x - x, car.y - y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function reset() {
    cars.length = 0;
    parked.length = 0;
    for (let i = 0; i < TRAFFIC.count; i += 1) spawnTrafficCar();
    spawnParked(16);
  }

  /**
   * Drive the player's car one step. Returns true when it hit a building (for the
   * crash sound and shake). `input` is {throttle, steer, brake}: throttle +1 is
   * forward (W), -1 is reverse (S); steer +1 turns right (D), -1 turns left (A).
   */
  function drivePlayer(car, dt, input, onCrash) {
    // Steering: turn rate grows as the car slows, and reverses when reversing.
    const speedSign = car.speed >= 0 ? 1 : -1;
    const turn = input.steer * CAR.turnRate * Math.min(1, Math.abs(car.speed) / 160 + 0.25) * speedSign;
    car.angle += turn * dt;
    if (input.brake) {
      car.speed -= Math.sign(car.speed) * CAR.brake * dt;
      if (Math.abs(car.speed) < 12) car.speed = 0;
    } else if (input.throttle > 0.1) {
      car.speed += CAR.accel * dt;
    } else if (input.throttle < -0.1) {
      car.speed -= CAR.accel * 0.7 * dt;
    } else {
      car.speed -= car.speed * CAR.drag * dt;
      if (Math.abs(car.speed) < 4) car.speed = 0;
    }
    car.speed = Math.max(-CAR.reverseSpeed, Math.min(CAR.maxSpeed, car.speed));
    // Move on each axis separately so the car slides along walls instead of
    // wedging into a corner; a hard hit on either axis is a crash.
    const stepX = Math.cos(car.angle) * car.speed * dt;
    const stepY = Math.sin(car.angle) * car.speed * dt;
    let crashed = false;
    if (!city.hitsBuilding(car.x + stepX, car.y, 26)) {
      car.x += stepX;
    } else {
      crashed = true;
    }
    if (!city.hitsBuilding(car.x, car.y + stepY, 26)) {
      car.y += stepY;
    } else {
      crashed = true;
    }
    if (crashed) {
      const impact = Math.abs(car.speed);
      car.speed *= -0.25;
      if (impact > 260 && onCrash) onCrash(impact / CAR.maxSpeed);
      return true;
    }
    car.x = Math.max(20, Math.min(WORLD.width - 20, car.x));
    car.y = Math.max(20, Math.min(CITY.beachY - 20, car.y));
    return false;
  }

  /** Traffic AI: follow the road, turn at intersections, keep off other cars. */
  function stepTraffic(dt, playerPos) {
    for (const car of cars) {
      if (!car.active || car.kind === 'police') continue;
      // Slow down for the car ahead on the same road.
      let slow = false;
      for (const other of cars) {
        if (other === car || !other.active) continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const ahead = car.axis === 'h' ? dx * car.dir : dy * car.dir;
        const side = car.axis === 'h' ? Math.abs(dy) : Math.abs(dx);
        if (ahead > 0 && ahead < 90 && side < 30) slow = true;
      }
      const target = slow ? 0 : TRAFFIC.speed;
      car.speed += (target - car.speed) * Math.min(1, 2 * dt);
      // Move on each axis separately so a turning car slides along walls
      // instead of swinging a corner into a building.
      const stepX = Math.cos(car.angle) * car.speed * dt;
      const stepY = Math.sin(car.angle) * car.speed * dt;
      if (!city.hitsBuilding(car.x + stepX, car.y, 26)) car.x += stepX;
      if (!city.hitsBuilding(car.x, car.y + stepY, 26)) car.y += stepY;
      // At an intersection, sometimes turn onto the crossing road.
      const road = city.nearestRoad(car.x, car.y);
      const onCross = car.axis === 'h'
        ? CITY.verticalRoads.some((rx) => Math.abs(car.x - rx) < 6)
        : CITY.horizontalRoads.some((ry) => Math.abs(car.y - ry) < 6);
      if (onCross && Math.abs(road.dist) < 10 && random() < 0.35) {
        const cross = car.axis === 'h'
          ? CITY.verticalRoads.find((rx) => Math.abs(car.x - rx) < 6)
          : CITY.horizontalRoads.find((ry) => Math.abs(car.y - ry) < 6);
        if (cross !== undefined) {
          car.axis = car.axis === 'h' ? 'v' : 'h';
          car.dir = random() < 0.5 ? -1 : 1;
          car.angle = car.axis === 'h' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
          if (car.axis === 'h') car.y = cross;
          else car.x = cross;
        }
      }
      // Wrap around the map edges so traffic never runs out.
      if (car.x < 30) car.x = WORLD.width - 40;
      if (car.x > WORLD.width - 30) car.x = 40;
      if (car.y < 30) car.y = CITY.beachY - 40;
      if (car.y > CITY.beachY - 30) car.y = 40;
    }
    // Parked cars do not move. Traffic cars that got too far from the player are
    // respawned near them, so the streets always feel alive.
    if (playerPos) {
      for (const car of cars) {
        if (!car.active || car.kind === 'police') continue;
        if (Math.hypot(car.x - playerPos.x, car.y - playerPos.y) > 1600) {
          spawnTrafficCar(playerPos.x, playerPos.y);
          car.active = false;
          cars.splice(cars.indexOf(car), 1);
        }
      }
    }
  }

  return {
    cars, parked, allCars, nearestCar, reset,
    spawnTrafficCar, spawnParked, drivePlayer, stepTraffic, makeCar, angleDiff,
  };
}
