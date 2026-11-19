// The game's rules and state, with no drawing and no browser in it except the audio
// and save helpers it is handed. step() advances one fixed step: the player on foot
// or in a car, traffic, pedestrians, police and wanted level, combat, missions, cash
// pickups, particles and the camera. It returns event flags so the caller can play
// sounds and announce screens without the world knowing about them.

import { CAR, CASH, CITY, PALETTE, PED, PLAYER, START_MONEY, STEP, VIEW, WEAPON, WORLD } from './config.js';
import { createCity } from './city.js';
import { createVehicles } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions, PLACES } from './missions.js';
import { createEffects } from './effects.js';

export const EVENT_NONE = 0;
export const EVENT_PICKUP = 1;
export const EVENT_CASH = 2;
export const EVENT_WANTED_UP = 4;
export const EVENT_MISSION_DONE = 8;
export const EVENT_MISSION_FAIL = 16;
export const EVENT_GAME_OVER = 32;
export const EVENT_CRASH = 64;
export const EVENT_SHOT = 128;
export const EVENT_HIT = 256;

const PLAYER_START = { x: 600, y: 940 };

export function createWorld(random, audio) {
  const city = createCity(random);
  const vehicles = createVehicles(city, random);
  const pedestrians = createPedestrians(city, random);
  const police = createPolice(city, vehicles, random);
  const combat = createCombat();
  const missions = createMissions();
  const effects = createEffects();

  const player = {
    x: PLAYER_START.x, y: PLAYER_START.y, angle: -Math.PI / 2,
    health: PLAYER.health, inCar: false, car: null,
    speed: 0, lastDamage: -99, aimX: 0, aimY: 0,
  };
  const camera = { x: 0, y: 0 };
  const cash = [];
  const state = {
    player, camera, city, vehicles, pedestrians, police, combat, missions, effects,
    cash, money: START_MONEY, best: 0, time: 0, elapsed: 0,
    muted: false, savedFlash: 0, shootTimer: 0, punchTimer: 0, crimeTimer: 0,
  };

  function spawnCash() {
    const p = city.randomSidewalkPoint();
    cash.push({
      x: p.x, y: p.y,
      value: CASH.min + Math.floor(random() * (CASH.max - CASH.min)),
      active: true, respawn: 0,
    });
  }

  function reset(saved) {
    player.x = PLAYER_START.x;
    player.y = PLAYER_START.y;
    player.angle = -Math.PI / 2;
    player.health = PLAYER.health;
    player.inCar = false;
    player.car = null;
    player.speed = 0;
    player.lastDamage = -99;
    vehicles.reset();
    pedestrians.reset();
    police.reset();
    combat.clear();
    cash.length = 0;
    for (let i = 0; i < CASH.count; i += 1) spawnCash();
    state.money = saved ? saved.money : START_MONEY;
    state.best = saved ? saved.best : 0;
    state.time = 0;
    state.elapsed = 0;
    state.shootTimer = 0;
    state.punchTimer = 0;
    state.crimeTimer = 0;
    state.savedFlash = 0;
    missions.reset(saved ? saved.done : null);
    missions.start();
    if (missions.active && missions.active.id === 'heat') police.setWanted(2);
    camera.x = Math.max(0, Math.min(WORLD.width - VIEW.width, player.x - VIEW.width / 2));
    camera.y = Math.max(0, Math.min(WORLD.height - VIEW.height, player.y - VIEW.height / 2));
  }

  function damagePlayer(amount, x, y) {
    if (player.health <= 0) return;
    player.health = Math.max(0, player.health - amount);
    player.lastDamage = state.time;
    effects.sparks(x, y, '#e5534b', 8);
    effects.addShake(4);
    audio.crash(0.4);
  }

  /** A crime was committed: raise wanted (once per short window) and tell the caller. */
  function commitCrime(amount) {
    if (state.crimeTimer > 0) return false;
    state.crimeTimer = 1.2;
    const raised = police.addWanted(amount);
    if (raised) audio.wantedUp();
    return raised;
  }

  function nearestPed(x, y, range) {
    let best = null;
    let bestD = range;
    for (const ped of pedestrians.peds) {
      if (!ped.active || ped.state === pedestrians.STATE_DOWN) continue;
      const d = Math.hypot(ped.x - x, ped.y - y);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    return best;
  }

  function shoot(fromX, fromY, angle, fromPolice) {
    const b = combat.fire(fromX, fromY, angle, WEAPON.bulletSpeed, WEAPON.bulletRange, WEAPON.damage, fromPolice);
    if (!b) return;
    effects.muzzle(fromX, fromY, angle);
    audio.gunshot();
    if (!fromPolice) {
      pedestrians.scare(fromX, fromY, 320);
      commitCrime(0);
    }
  }

  function punch() {
    const px = player.x + Math.cos(player.angle) * 26;
    const py = player.y + Math.sin(player.angle) * 26;
    audio.punch();
    const ped = nearestPed(px, py, WEAPON.punchReach + 12);
    if (ped) {
      pedestrians.scare(ped.x, ped.y, 200);
      commitCrime(1);
    }
    for (const cop of police.cops) {
      if (!cop.disabled && Math.hypot(cop.x - px, cop.y - py) < WEAPON.punchReach + 22) {
        cop.health -= WEAPON.punchDamage;
        effects.sparks(cop.x, cop.y, '#f2c94c', 6);
        if (cop.health <= 0) {
          cop.disabled = true;
          cop.smokeTimer = 6;
          cop.speed = 0;
        }
      }
    }
  }

  function enterCar(car) {
    if (!car) return false;
    const wasOccupied = car.kind === 'traffic' || (car.kind === 'parked' && car.occupied);
    if (wasOccupied) {
      // The driver flees on foot; taking the car is a crime.
      const driver = pedestrians.spawnPed(car.x + 30, car.y + 30);
      driver.state = pedestrians.STATE_FLEE;
      driver.stateTimer = 4;
      driver.angle = Math.atan2(driver.y - player.y, driver.x - player.x);
      car.occupied = false;
      if (car.kind === 'traffic') {
        car.kind = 'parked';
        const i = vehicles.cars.indexOf(car);
        if (i >= 0) vehicles.cars.splice(i, 1);
        vehicles.parked.push(car);
      }
      commitCrime(1);
    }
    player.inCar = true;
    player.car = car;
    car.speed = 0;
    audio.pickup();
    return true;
  }

  function exitCar() {
    const car = player.car;
    if (!car) return;
    player.inCar = false;
    player.car = null;
    const side = { x: player.x, y: player.y };
    // Step out to the car's left side, clear of buildings.
    player.x = car.x - Math.sin(car.angle) * 40;
    player.y = car.y + Math.cos(car.angle) * 40;
    city.collideBuildings(player, PLAYER.radius);
    void side;
  }

  function stepPlayerOnFoot(dt, input) {
    const mx = input.moveX();
    const my = input.moveY();
    const len = Math.hypot(mx, my);
    const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
    if (len > 0) {
      const nx = player.x + (mx / len) * speed * dt;
      const ny = player.y + (my / len) * speed * dt;
      player.angle = Math.atan2(my, mx);
      player.speed = speed;
      const probe = { x: nx, y: ny };
      city.collideBuildings(probe, PLAYER.radius);
      player.x = Math.max(PLAYER.radius, Math.min(WORLD.width - PLAYER.radius, probe.x));
      player.y = Math.max(PLAYER.radius, Math.min(CITY.beachY - PLAYER.radius, probe.y));
      // Skid dust when running.
      if (input.running() && Math.random() < 0.2) effects.dust(player.x, player.y, 1);
    } else {
      player.speed = 0;
    }
    // Can't walk through cars: push out of the nearest one.
    for (const car of vehicles.allCars()) {
      if (!car.active) continue;
      const dx = player.x - car.x;
      const dy = player.y - car.y;
      const d = Math.hypot(dx, dy);
      if (d < 30 && d > 0.01) {
        player.x = car.x + (dx / d) * 30;
        player.y = car.y + (dy / d) * 30;
      }
    }
  }

  function stepPlayerInCar(dt, input, onCrash) {
    const car = player.car;
    if (!car) {
      player.inCar = false;
      return;
    }
    const hit = vehicles.drivePlayer(car, dt, { throttle: -input.moveY(), steer: input.moveX(), brake: input.braking() }, onCrash);
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    player.speed = Math.abs(car.speed);
    // Skid dust on hard turns and braking.
    if ((input.braking() && Math.abs(car.speed) > 200) || Math.abs(input.moveX()) > 0 && Math.abs(car.speed) > 380) {
      if (Math.random() < 0.4) {
        effects.dust(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, 1);
      }
    }
    // Running over a pedestrian is a crime.
    for (const ped of pedestrians.peds) {
      if (!ped.active || ped.state === pedestrians.STATE_DOWN) continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26 && Math.abs(car.speed) > 140) {
        pedestrians.knockDown(ped);
        effects.sparks(ped.x, ped.y, '#e5534b', 8);
        effects.addShake(3);
        audio.crash(0.5);
        commitCrime(1);
      }
    }
    // Car-to-car bumps: slow both, spark and shake on a hard hit.
    for (const other of vehicles.allCars()) {
      if (other === car || !other.active) continue;
      const d = Math.hypot(other.x - car.x, other.y - car.y);
      if (d < 40 && d > 0.01) {
        const overlap = 40 - d;
        const nx = (car.x - other.x) / d;
        const ny = (car.y - other.y) / d;
        // The player's car is heavy: it shoves the other car aside instead of
        // stalling against it, so traffic never traps the player.
        car.x += nx * overlap * 0.2;
        car.y += ny * overlap * 0.2;
        if (other.kind !== 'police') {
          other.x -= nx * overlap * 0.8;
          other.y -= ny * overlap * 0.8;
          city.collideBuildings(other, 26);
        } else {
          other.x -= nx * overlap * 0.5;
          other.y -= ny * overlap * 0.5;
          city.collideBuildings(other, 26);
        }
        if (Math.abs(car.speed) > 260) {
          car.speed *= 0.55;
          effects.sparks(car.x, car.y, '#f2c94c', 8);
          effects.addShake(3);
          audio.crash(0.35);
        }
      }
    }
    // A shove from another car can leave the player inside a building's edge;
    // push back out so the car is never stuck in a wall.
    city.collideBuildings(car, 26);
    void hit;
  }

  function stepBullets(dt) {
    combat.step(dt, (bullet, nx, ny) => {
      // Buildings stop bullets.
      const probe = { x: nx, y: ny };
      if (city.collideBuildings(probe, 1)) {
        effects.sparks(nx, ny, '#b8b0a0', 4);
        return true;
      }
      if (bullet.fromPolice) {
        // Police bullets can hit the player (on foot or in the car).
        const target = player.inCar ? player.car : player;
        const radius = player.inCar ? 24 : PLAYER.radius;
        if (Math.hypot(nx - target.x, ny - target.y) < radius) {
          damagePlayer(POLICE_BULLET_DAMAGE, nx, ny);
          return true;
        }
        return false;
      }
      // Player bullets: police cars, pedestrians, traffic cars.
      for (const cop of police.cops) {
        if (!cop.disabled && Math.hypot(nx - cop.x, ny - cop.y) < 24) {
          cop.health -= bullet.damage;
          effects.sparks(nx, ny, '#f2c94c', 6);
          if (cop.health <= 0) {
            cop.disabled = true;
            cop.smokeTimer = 6;
            cop.speed = 0;
            effects.sparks(cop.x, cop.y, '#8b93a3', 14);
          }
          return true;
        }
      }
      for (const ped of pedestrians.peds) {
        if (!ped.active || ped.state === pedestrians.STATE_DOWN) continue;
        if (Math.hypot(nx - ped.x, ny - ped.y) < 12) {
          pedestrians.knockDown(ped);
          effects.sparks(nx, ny, '#e5534b', 6);
          commitCrime(1);
          return true;
        }
      }
      for (const car of vehicles.allCars()) {
        if (!car.active || car === player.car) continue;
        if (Math.hypot(nx - car.x, ny - car.y) < 24) {
          effects.sparks(nx, ny, '#f2c94c', 5);
          pedestrians.scare(nx, ny, 200);
          return true;
        }
      }
      return false;
    });
  }

  function stepCash(dt) {
    for (const bundle of cash) {
      if (!bundle.active) {
        bundle.respawn -= dt;
        if (bundle.respawn <= 0) {
          const p = city.randomSidewalkPoint();
          bundle.x = p.x;
          bundle.y = p.y;
          bundle.value = CASH.min + Math.floor(random() * (CASH.max - CASH.min));
          bundle.active = true;
        }
        continue;
      }
      if (Math.hypot(player.x - bundle.x, player.y - bundle.y) < 34) {
        bundle.active = false;
        bundle.respawn = 20;
        state.money += bundle.value;
        effects.glint(bundle.x, bundle.y);
        audio.cash();
      }
    }
  }

  function stepCamera(dt) {
    const tx = Math.max(0, Math.min(WORLD.width - VIEW.width, player.x - VIEW.width / 2));
    const ty = Math.max(0, Math.min(WORLD.height - VIEW.height, player.y - VIEW.height / 2));
    camera.x += (tx - camera.x) * Math.min(1, 5 * dt);
    camera.y += (ty - camera.y) * Math.min(1, 5 * dt);
  }

  /**
   * One fixed step. `input` is the input device, `actions` the ACTION_* flags taken
   * this frame, and `onEvent` receives the EVENT_* flags (sounds, toasts, screens).
   */
  function step(dt, input, actions, onEvent) {
    let events = EVENT_NONE;
    state.time += dt;
    state.elapsed += dt;
    if (state.crimeTimer > 0) state.crimeTimer -= dt;
    if (state.shootTimer > 0) state.shootTimer -= dt;
    if (state.punchTimer > 0) state.punchTimer -= dt;
    if (state.savedFlash > 0) state.savedFlash -= dt;

    // Aim: toward the mouse in world space when it has moved, else facing.
    const aimScreenX = input.mouse.x;
    const aimScreenY = input.mouse.y;
    const aimWorldX = camera.x + (aimScreenX / window.innerWidth) * VIEW.width;
    const aimWorldY = camera.y + (aimScreenY / window.innerHeight) * VIEW.height;
    player.aimX = aimWorldX;
    player.aimY = aimWorldY;

    // One-shot actions.
    if (actions & 4) { // ACTION_INTERACT (E)
      if (player.inCar) {
        exitCar();
      } else {
        const car = vehicles.nearestCar(player.x, player.y, 78);
        if (car) enterCar(car);
      }
    }
    if ((actions & 8) && !player.inCar && state.shootTimer <= 0) { // ACTION_SHOOT (F / click)
      state.shootTimer = WEAPON.cooldown;
      const angle = Math.hypot(player.aimX - player.x, player.aimY - player.y) > 24
        ? Math.atan2(player.aimY - player.y, player.aimX - player.x)
        : player.angle;
      shoot(player.x, player.y, angle, false);
      events |= EVENT_SHOT;
    }
    if ((actions & 64) && !player.inCar && state.punchTimer <= 0) { // ACTION_PUNCH (G)
      state.punchTimer = WEAPON.punchCooldown;
      punch();
      events |= EVENT_HIT;
    }
    if (actions & 16) { // ACTION_MUTE (M)
      state.muted = audio.toggleMute();
    }

    // Player movement.
    if (player.inCar) {
      stepPlayerInCar(dt, input, (strength) => {
        events |= EVENT_CRASH;
        effects.sparks(player.x, player.y, '#f2c94c', 10);
        effects.addShake(3 + strength * 6);
        audio.crash(strength);
        if (player.car && Math.abs(player.car.speed) > 320) {
          damagePlayer(Math.round(4 + strength * 14), player.x, player.y);
        }
      });
    } else {
      stepPlayerOnFoot(dt, input);
    }

    // The rest of the city.
    vehicles.stepTraffic(dt, player);
    pedestrians.step(dt, player, player.inCar && player.car ? Math.abs(player.car.speed) : 0);
    const nearestCop = police.step(dt, player, (kind, damage, x, y) => {
      if (kind === 'ram') {
        damagePlayer(damage, x, y);
        events |= EVENT_HIT;
      } else if (kind === 'shoot') {
        const angle = Math.atan2(player.y - y, player.x - x);
        combat.fire(x, y, angle, 420, 560, 10, true);
        audio.gunshot();
      }
    });
    stepBullets(dt);
    stepCash(dt);
    effects.update(dt);

    // Audio beds follow the game: engine with speed, siren with the nearest cop.
    audio.engine(player.inCar && player.car ? Math.abs(player.car.speed) / 560 : 0);
    audio.siren(nearestCop === Infinity ? 0 : Math.max(0, 1 - nearestCop / 700), state.time);

    // Health regen while laying low.
    if (police.wanted === 0 && player.health > 0 && state.time - player.lastDamage > PLAYER.regenDelay) {
      player.health = Math.min(PLAYER.health, player.health + PLAYER.regen * dt);
    }

    // Missions.
    const missionResult = missions.step(dt, state);
    if (missionResult === 'complete') events |= EVENT_MISSION_DONE;
    else if (missionResult === 'fail') events |= EVENT_MISSION_FAIL;

    // Start the next job with Enter when there is one waiting.
    if (!missions.active && !missions.allDone && (actions & 1)) {
      missions.start();
      if (missions.active && missions.active.id === 'heat') police.setWanted(2);
    }

    // Best money tracking.
    if (state.money > state.best) state.best = state.money;

    stepCamera(dt);
    if (player.health <= 0) events |= EVENT_GAME_OVER;
    return events;
  }

  reset(null);
  return { state, reset, step, damagePlayer, commitCrime, enterCar, exitCar };
}

// Police bullet damage, kept beside the combat constants.
const POLICE_BULLET_DAMAGE = 10;
