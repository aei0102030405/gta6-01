// Missions and the story. Rico Vale, driver for hire, takes jobs from his fixer Marla.
// Three jobs in order: steal a car for the garage, run a package across town against
// the clock, and shake a two-star wanted level. Each mission has a marker on the map,
// an objective line, dialogue from Marla, and a payout. Finishing all three opens
// free roam with a bonus.

import { CITY, MISSIONS, WORLD } from './config.js';

/** Where the jobs happen: the garage, the docks, the motel, and Marla's corner. */
export const PLACES = {
  garage: { x: 2600, y: 600, label: 'Marla\'s Garage' },
  docks: { x: 220, y: 2180, label: 'South Docks' },
  motel: { x: 2820, y: 220, label: 'Seaview Motel' },
  corner: { x: 600, y: 1000, label: 'Marla\'s Corner' },
};

export function createMissions() {
  let index = 0;
  let active = null;
  let done = [false, false, false];
  let timer = 0;
  let hasPackage = false;
  let allDone = false;
  let toast = '';
  let toastTimer = 0;

  function currentDef() {
    return MISSIONS[index];
  }

  function start() {
    if (allDone || index >= MISSIONS.length) return null;
    const def = MISSIONS[index];
    active = { id: def.id, stage: 0 };
    timer = def.timeLimit || 0;
    hasPackage = false;
    // Every job opens with Marla's briefing, word for word.
    toast = `Marla: "${def.brief}"`;
    toastTimer = 7;
    return active;
  }

  function complete(world) {
    const def = MISSIONS[index];
    done[index] = true;
    world.money += def.reward;
    toast = `Job done: ${def.name} — +$${def.reward}`;
    toastTimer = 5;
    active = null;
    index += 1;
    if (index >= MISSIONS.length) {
      allDone = true;
      world.money += 100;
      toast = 'All jobs done — Solmar Bay is yours. Bonus +$100.';
      toastTimer = 7;
    } else {
      start();
    }
  }

  function fail(reason) {
    toast = `Job failed: ${reason}. Talk to Marla to try again.`;
    toastTimer = 6;
    active = null;
    timer = 0;
    hasPackage = false;
  }

  function retry() {
    start();
  }

  /** The marker the player must reach right now, or null. */
  function marker() {
    if (!active) return null;
    if (active.id === 'wheels') return { ...PLACES.garage, stage: active.stage };
    if (active.id === 'package') {
      return active.stage === 0
        ? { ...PLACES.docks, stage: 0, label: 'Pick up the package' }
        : { ...PLACES.motel, stage: 1, label: 'Deliver to the motel' };
    }
    if (active.id === 'heat') return null;
    return null;
  }

  function objective() {
    if (allDone) return 'Free roam — Solmar Bay is yours.';
    if (!active) return 'Go see Marla to start the next job.';
    const def = currentDef();
    if (active.id === 'package' && active.stage === 1) return 'Deliver the package to the Seaview Motel';
    return def.objective;
  }

  /**
   * Advance the active mission one step. `world` is the game state (player pos, car,
   * wanted). Returns 'complete' | 'fail' | null. The world applies the payout and
   * sounds on 'complete', and the wanted set on mission start.
   */
  function step(dt, world) {
    if (toastTimer > 0) toastTimer -= dt;
    if (!active) return null;
    const def = currentDef();
    if (def.timeLimit) {
      timer -= dt;
      if (timer <= 0) {
        fail('out of time');
        return 'fail';
      }
    }
    const px = world.player.x;
    const py = world.player.y;
    if (active.id === 'wheels') {
      // Complete when the player drives a car into the garage marker.
      if (world.player.inCar && Math.hypot(px - PLACES.garage.x, py - PLACES.garage.y) < 110) {
        complete(world);
        return 'complete';
      }
    } else if (active.id === 'package') {
      if (active.stage === 0) {
        if (Math.hypot(px - PLACES.docks.x, py - PLACES.docks.y) < 70) {
          active.stage = 1;
          hasPackage = true;
          toast = 'Package picked up. Get it to the Seaview Motel — fast.';
          toastTimer = 5;
        }
      } else if (Math.hypot(px - PLACES.motel.x, py - PLACES.motel.y) < 90) {
        complete(world);
        return 'complete';
      }
    } else if (active.id === 'heat') {
      if (world.police.wanted === 0) {
        complete(world);
        return 'complete';
      }
    }
    return null;
  }

  function reset(savedDone) {
    done = savedDone ? [...savedDone] : [false, false, false];
    index = done.findIndex((d) => !d);
    if (index === -1) {
      index = MISSIONS.length;
      allDone = true;
    } else {
      allDone = false;
    }
    active = null;
    timer = 0;
    hasPackage = false;
    toast = '';
    toastTimer = 0;
  }

  return {
    get index() { return index; },
    get active() { return active; },
    get done() { return done; },
    get allDone() { return allDone; },
    get timer() { return timer; },
    get hasPackage() { return hasPackage; },
    get toast() { return toastTimer > 0 ? toast : ''; },
    start, complete, fail, retry, marker, objective, step, reset,
    get timeLeft() { return Math.max(0, Math.ceil(timer)); },
  };
}
