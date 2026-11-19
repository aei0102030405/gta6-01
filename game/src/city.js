// Solmar Bay itself: the street grid, the blocks between the streets, the buildings
// inside each block, the beach along the south edge, and the park. Everything is laid
// out from one seed, so the same seed always builds the same city. Pure geometry —
// no drawing here. Buildings are solid rectangles; cars and people are kept out of
// them by circle-versus-rectangle pushes in the physics step.

import { CITY, PALETTE, WORLD } from './config.js';

/** Half the road width: the distance from a road centre to its kerb. */
const HALF_ROAD = CITY.roadWidth / 2;
/** Sidewalk band hugging each road. */
const WALK = 14;

function circleHitsRect(x, y, r, rect) {
  const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

function pushCircleOutOfRect(pos, r, rect) {
  const cx = Math.max(rect.x, Math.min(pos.x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(pos.y, rect.y + rect.h));
  let dx = pos.x - cx;
  let dy = pos.y - cy;
  let dist = Math.hypot(dx, dy);
  if (dist >= r) return false;
  if (dist === 0) {
    // Centre inside the rectangle: push out along the shortest side.
    const left = pos.x - rect.x;
    const right = rect.x + rect.w - pos.x;
    const top = pos.y - rect.y;
    const bottom = rect.y + rect.h - pos.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) pos.x = rect.x - r;
    else if (m === right) pos.x = rect.x + rect.w + r;
    else if (m === top) pos.y = rect.y - r;
    else pos.y = rect.y + rect.h + r;
    return true;
  }
  dx /= dist;
  dy /= dist;
  dist = r - dist;
  pos.x += dx * dist;
  pos.y += dy * dist;
  return true;
}

export function createCity(random) {
  const buildings = [];
  const palms = [];
  const lamps = [];

  // Blocks are the rectangles between neighbouring roads. Skip the block row that
  // the beach occupies, and leave one block as a park.
  const xs = [0, ...CITY.verticalRoads, WORLD.width];
  const ys = [0, ...CITY.horizontalRoads, CITY.beachY];
  const parkBlock = { bx: 3, by: 2 };
  for (let by = 0; by < ys.length - 1; by += 1) {
    for (let bx = 0; bx < xs.length - 1; bx += 1) {
      const x0 = xs[bx] + HALF_ROAD + 8;
      const x1 = xs[bx + 1] - HALF_ROAD - 8;
      const y0 = ys[by] + HALF_ROAD + 8;
      const y1 = ys[by + 1] - HALF_ROAD - 8;
      if (x1 - x0 < 60 || y1 - y0 < 60) continue;
      if (bx === parkBlock.bx && by === parkBlock.by) {
        for (let i = 0; i < 9; i += 1) {
          palms.push({
            x: x0 + 30 + random() * (x1 - x0 - 60),
            y: y0 + 30 + random() * (y1 - y0 - 60),
          });
        }
        continue;
      }
      const count = 1 + Math.floor(random() * 3);
      for (let i = 0; i < count; i += 1) {
        const w = 60 + random() * 90;
        const h = 50 + random() * 80;
        const x = x0 + random() * Math.max(1, x1 - x0 - w);
        const y = y0 + random() * Math.max(1, y1 - y0 - h);
        const rect = { x, y, w, h };
        let overlaps = false;
        for (const other of buildings) {
          if (rect.x < other.x + other.w + 14 && rect.x + rect.w + 14 > other.x &&
              rect.y < other.y + other.h + 14 && rect.y + rect.h + 14 > other.y) {
            overlaps = true;
            break;
          }
        }
        if (overlaps) continue;
        buildings.push({
          ...rect,
          roof: PALETTE.buildingRoof[Math.floor(random() * PALETTE.buildingRoof.length)],
          floors: 1 + Math.floor(random() * 3),
        });
      }
      // A palm or two on the block's corners, and a street lamp at its edge.
      if (random() < 0.7) palms.push({ x: x0 + 16, y: y0 + 16 });
      if (random() < 0.5) palms.push({ x: x1 - 16, y: y1 - 16 });
      lamps.push({ x: x0 + 6, y: y0 + 6 });
    }
  }
  // Palms along the beach, one clump every 260px.
  const BEACH_PALM_SPACING = 260;
  for (let x = 120; x < WORLD.width - 100; x += BEACH_PALM_SPACING) {
    palms.push({ x: x + random() * 60, y: CITY.beachY + 30 + random() * 40 });
  }

  /** True when the point is on a road (not on a block, the beach or the sea). */
  function onRoad(x, y) {
    if (y >= CITY.beachY) return false;
    for (const rx of CITY.verticalRoads) if (Math.abs(x - rx) <= HALF_ROAD) return true;
    for (const ry of CITY.horizontalRoads) if (Math.abs(y - ry) <= HALF_ROAD) return true;
    return false;
  }

  /** True when the point is on a sidewalk band beside a road. */
  function onSidewalk(x, y) {
    if (y >= CITY.beachY) return false;
    for (const rx of CITY.verticalRoads) {
      const d = Math.abs(x - rx);
      if (d > HALF_ROAD && d <= HALF_ROAD + WALK) return true;
    }
    for (const ry of CITY.horizontalRoads) {
      const d = Math.abs(y - ry);
      if (d > HALF_ROAD && d <= HALF_ROAD + WALK) return true;
    }
    return false;
  }

  /** The nearest road centre line and which way it runs: 'v' or 'h'. */
  function nearestRoad(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const rx of CITY.verticalRoads) {
      const d = Math.abs(x - rx);
      if (d < bestD) { bestD = d; best = { axis: 'v', at: rx, dist: d }; }
    }
    for (const ry of CITY.horizontalRoads) {
      const d = Math.abs(y - ry);
      if (d < bestD) { bestD = d; best = { axis: 'h', at: ry, dist: d }; }
    }
    return best;
  }

  /** Push a circle out of every building it overlaps; returns true on any hit. */
  function collideBuildings(pos, r) {
    let hit = false;
    for (const b of buildings) {
      if (circleHitsRect(pos.x, pos.y, r, b)) {
        pushCircleOutOfRect(pos, r, b);
        hit = true;
      }
    }
    return hit;
  }

  /** Pure check: would a circle at (x, y) with radius r touch any building? */
  function hitsBuilding(x, y, r) {
    for (const b of buildings) {
      if (circleHitsRect(x, y, r, b)) return true;
    }
    return false;
  }

  /** A random point on a road, for spawning cars and the player. */
  function randomRoadPoint() {
    if (random() < 0.5) {
      const rx = CITY.verticalRoads[Math.floor(random() * CITY.verticalRoads.length)];
      return { x: rx + (random() - 0.5) * (CITY.roadWidth - 30), y: 60 + random() * (CITY.beachY - 120) };
    }
    const ry = CITY.horizontalRoads[Math.floor(random() * CITY.horizontalRoads.length)];
    return { x: 60 + random() * (WORLD.width - 120), y: ry + (random() - 0.5) * (CITY.roadWidth - 30) };
  }

  /** A random point on a sidewalk, for spawning pedestrians. */
  function randomSidewalkPoint() {
    for (let tries = 0; tries < 40; tries += 1) {
      const p = randomRoadPoint();
      const offset = HALF_ROAD + 4 + random() * (WALK - 8);
      const side = random() < 0.5 ? -1 : 1;
      const road = nearestRoad(p.x, p.y);
      const q = road.axis === 'v'
        ? { x: road.at + side * offset, y: p.y }
        : { x: p.x, y: road.at + side * offset };
      if (q.x > 20 && q.x < WORLD.width - 20 && q.y > 20 && q.y < CITY.beachY - 20) return q;
    }
    return { x: 600, y: 200 };
  }

  return {
    buildings, palms, lamps, parkBlock,
    onRoad, onSidewalk, nearestRoad, collideBuildings, hitsBuilding,
    randomRoadPoint, randomSidewalkPoint,
  };
}
