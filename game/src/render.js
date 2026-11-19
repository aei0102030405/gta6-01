// Drawing only: the city, the cars and people in it, the player, the particles, the
// HUD with its minimap, and the menu screens. The camera follows the player; the
// 1280x720 view is scaled to fit the window and centred. Flat shapes and canvas text
// only — no images, no network.

import { CITY, PALETTE, VIEW, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const MINIMAP = { w: 220, h: 168, margin: 16 };
const STAR = '★';
/** Game speed units to km/h for the speedometer. */
const SPEED_TO_KMH = 0.24;

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, w: 0, h: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.w = width;
    view.h = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${'system-ui, -apple-system, "Segoe UI", sans-serif'}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function drawCarShape(x, y, angle, length, width, color, isPolice, time) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.fillRect(-length / 2 + 3, -width / 2 + 3, length, width);
    // Body.
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(-length / 2, -width / 2, length, width, 6);
    context.fill();
    // Windows.
    context.fillStyle = '#22303c';
    context.fillRect(-length / 2 + 8, -width / 2 + 4, 12, width - 8);
    context.fillRect(length / 2 - 20, -width / 2 + 4, 12, width - 8);
    // Headlights.
    context.fillStyle = '#ffe9a8';
    context.fillRect(length / 2 - 2, -width / 2 + 2, 2, 4);
    context.fillRect(length / 2 - 2, width / 2 - 6, 2, 4);
    if (isPolice) {
      // Flashing light bar: red and blue alternate twice a second.
      const phase = Math.floor(time * 2) % 2 === 0;
      context.fillStyle = phase ? '#e5534b' : '#3f7fb5';
      context.fillRect(-6, -width / 2 - 2, 12, 5);
      context.fillStyle = phase ? '#3f7fb5' : '#e5534b';
      context.fillRect(-6, width / 2 - 3, 12, 5);
    }
    context.restore();
  }

  function drawCity(state) {
    const cam = state.camera;
    const x0 = cam.x - 40;
    const y0 = cam.y - 40;
    const x1 = cam.x + VIEW.width + 40;
    const y1 = cam.y + VIEW.height + 40;
    // Ground: grass, then sand and sea along the south edge.
    context.fillStyle = PALETTE.grass;
    context.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (y1 > CITY.beachY) {
      context.fillStyle = PALETTE.sand;
      context.fillRect(x0, CITY.beachY, x1 - x0, Math.min(y1, CITY.waterY) - CITY.beachY);
    }
    if (y1 > CITY.waterY) {
      context.fillStyle = PALETTE.water;
      context.fillRect(x0, CITY.waterY, x1 - x0, y1 - CITY.waterY);
      context.fillStyle = PALETTE.waterDeep;
      for (let wx = Math.floor(x0 / 90) * 90; wx < x1; wx += 90) {
        context.fillRect(wx, CITY.waterY + 24 + ((wx / 90) % 3) * 18, 46, 4);
      }
    }
    // Roads: sidewalks beside them, dark strips, dashed centre lines.
    context.fillStyle = PALETTE.sidewalk;
    for (const rx of CITY.verticalRoads) {
      context.fillRect(rx - CITY.roadWidth / 2 - 14, y0, CITY.roadWidth + 28, y1 - y0);
    }
    for (const ry of CITY.horizontalRoads) {
      context.fillRect(x0, ry - CITY.roadWidth / 2 - 14, x1 - x0, CITY.roadWidth + 28);
    }
    context.fillStyle = PALETTE.road;
    for (const rx of CITY.verticalRoads) {
      context.fillRect(rx - CITY.roadWidth / 2, y0, CITY.roadWidth, y1 - y0);
    }
    for (const ry of CITY.horizontalRoads) {
      context.fillRect(x0, ry - CITY.roadWidth / 2, x1 - x0, CITY.roadWidth);
    }
    context.fillStyle = PALETTE.lane;
    for (const rx of CITY.verticalRoads) {
      for (let y = Math.floor(y0 / 46) * 46; y < y1; y += 46) {
        context.fillRect(rx - 2, y, 4, 24);
      }
    }
    for (const ry of CITY.horizontalRoads) {
      for (let x = Math.floor(x0 / 46) * 46; x < x1; x += 46) {
        context.fillRect(x, ry - 2, 24, 4);
      }
    }
    // Buildings: side wall, roof, and a lighter roof edge for depth.
    for (const b of state.city.buildings) {
      if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
      context.fillStyle = 'rgba(0,0,0,0.28)';
      context.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      context.fillStyle = PALETTE.buildingSide;
      context.fillRect(b.x, b.y + 4, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x, b.y, b.w, b.h - 4);
      context.fillStyle = 'rgba(255,255,255,0.16)';
      context.fillRect(b.x + 6, b.y + 6, b.w - 12, 5);
      // Rooftop box for taller buildings.
      if (b.floors > 1) {
        context.fillStyle = 'rgba(0,0,0,0.2)';
        context.fillRect(b.x + b.w / 2 - 12, b.y + b.h / 2 - 10, 24, 20);
      }
    }
    // Palms and lamps.
    for (const palm of state.city.palms) {
      if (palm.x < x0 || palm.x > x1 || palm.y < y0 || palm.y > y1) continue;
      context.fillStyle = PALETTE.palmTrunk;
      context.fillRect(palm.x - 2, palm.y - 2, 4, 14);
      context.fillStyle = PALETTE.palm;
      context.beginPath();
      context.arc(palm.x, palm.y - 6, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.14)';
      context.beginPath();
      context.arc(palm.x - 3, palm.y - 9, 4, 0, Math.PI * 2);
      context.fill();
    }
    for (const lamp of state.city.lamps) {
      if (lamp.x < x0 || lamp.x > x1 || lamp.y < y0 || lamp.y > y1) continue;
      context.fillStyle = '#3a3f4a';
      context.fillRect(lamp.x - 1, lamp.y - 1, 2, 10);
      context.fillStyle = '#ffe9a8';
      context.beginPath();
      context.arc(lamp.x, lamp.y - 3, 3, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawCash(state) {
    for (const bundle of state.cash) {
      if (!bundle.active) continue;
      const bob = Math.sin(state.time * 3 + bundle.x) * 3;
      context.fillStyle = '#2f7a3a';
      context.fillRect(bundle.x - 9, bundle.y - 6 + bob, 18, 12);
      context.fillStyle = '#f2c94c';
      context.font = 'bold 11px system-ui, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('$', bundle.x, bundle.y + bob);
    }
  }

  function drawMarker(state) {
    const marker = state.missions.marker();
    if (!marker) return;
    const pulse = 1 + Math.sin(state.time * 4) * 0.12;
    const r = 26 * pulse;
    context.save();
    context.translate(marker.x, marker.y);
    context.rotate(Math.PI / 4);
    context.fillStyle = PALETTE.marker;
    context.fillRect(-r / 2, -r / 2, r, r);
    context.strokeStyle = PALETTE.markerRing;
    context.lineWidth = 3;
    context.strokeRect(-r / 2, -r / 2, r, r);
    context.restore();
    // A beacon column so the marker reads from far away.
    const grad = context.createLinearGradient(marker.x, marker.y - 160, marker.x, marker.y);
    grad.addColorStop(0, 'rgba(242,201,76,0)');
    grad.addColorStop(1, 'rgba(242,201,76,0.35)');
    context.fillStyle = grad;
    context.fillRect(marker.x - 8, marker.y - 160, 16, 160);
    text(marker.label, marker.x, marker.y - 48, 16, PALETTE.text, 'center');
  }

  function drawEntities(state) {
    // Parked and traffic cars.
    for (const car of state.vehicles.allCars()) {
      if (!car.active) continue;
      drawCarShape(car.x, car.y, car.angle, 46, 22, car.color, car.kind === 'police', state.time);
      if (car.kind === 'police' && car.disabled) {
        context.fillStyle = 'rgba(60,60,66,0.7)';
        context.beginPath();
        context.arc(car.x, car.y - 14, 10 + Math.sin(state.time * 6) * 3, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Pedestrians: a body dot and a shirt, walking direction shown by a small face tick.
    for (const ped of state.pedestrians.peds) {
      if (!ped.active) continue;
      if (ped.state === state.pedestrians.STATE_DOWN) {
        context.fillStyle = ped.shirt;
        context.beginPath();
        context.ellipse(ped.x, ped.y, 12, 6, ped.angle, 0, Math.PI * 2);
        context.fill();
        continue;
      }
      context.fillStyle = '#2a2118';
      context.beginPath();
      context.arc(ped.x, ped.y, 10, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = ped.shirt;
      context.beginPath();
      context.arc(ped.x, ped.y, 7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#e8c98a';
      context.beginPath();
      context.arc(ped.x + Math.cos(ped.angle) * 5, ped.y + Math.sin(ped.angle) * 5, 3, 0, Math.PI * 2);
      context.fill();
    }
    // Bullets.
    context.fillStyle = '#ffe9a8';
    for (const b of state.combat.bullets) {
      if (!b.active) continue;
      context.fillRect(b.x - 2, b.y - 2, 4, 4);
    }
    // Particles.
    for (const p of state.effects.parts) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    context.globalAlpha = 1;
    // The player: on foot a figure with a yellow jacket, in a car the car itself.
    const player = state.player;
    if (!player.inCar) {
      context.fillStyle = '#2a2118';
      context.beginPath();
      context.arc(player.x, player.y, 13, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.playerJacket;
      context.beginPath();
      context.arc(player.x, player.y, 10, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.arc(player.x + Math.cos(player.angle) * 6, player.y + Math.sin(player.angle) * 6, 4, 0, Math.PI * 2);
      context.fill();
      // Pistol in hand when aiming.
      context.strokeStyle = '#22242a';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(player.x + Math.cos(player.angle) * 8, player.y + Math.sin(player.angle) * 8);
      context.lineTo(player.x + Math.cos(player.angle) * 18, player.y + Math.sin(player.angle) * 18);
      context.stroke();
    }
  }

  function drawMinimap(state) {
    const mx = VIEW.width - MINIMAP.w - MINIMAP.margin;
    const my = VIEW.height - MINIMAP.h - MINIMAP.margin;
    const sx = MINIMAP.w / WORLD.width;
    const sy = MINIMAP.h / WORLD.height;
    context.fillStyle = PALETTE.minimapBg;
    context.fillRect(mx - 4, my - 4, MINIMAP.w + 8, MINIMAP.h + 8);
    context.save();
    context.beginPath();
    context.rect(mx, my, MINIMAP.w, MINIMAP.h);
    context.clip();
    // Sea and sand.
    context.fillStyle = PALETTE.minimapWater;
    context.fillRect(mx, my + CITY.waterY * sy, MINIMAP.w, MINIMAP.h - CITY.waterY * sy);
    context.fillStyle = '#e8c98a';
    context.fillRect(mx, my + CITY.beachY * sy, MINIMAP.w, (CITY.waterY - CITY.beachY) * sy);
    // Roads.
    context.fillStyle = PALETTE.minimapRoad;
    for (const rx of CITY.verticalRoads) context.fillRect(mx + rx * sx - 2, my, 4, CITY.beachY * sy);
    for (const ry of CITY.horizontalRoads) context.fillRect(mx, my + ry * sy, MINIMAP.w, 4);
    // Mission marker.
    const marker = state.missions.marker();
    if (marker) {
      context.fillStyle = PALETTE.minimapMarker;
      context.save();
      context.translate(mx + marker.x * sx, my + marker.y * sy);
      context.rotate(Math.PI / 4);
      context.fillRect(-5, -5, 10, 10);
      context.restore();
    }
    // Cars as faint dots, police as red, player as a yellow arrow.
    context.fillStyle = PALETTE.minimapCar;
    for (const car of state.vehicles.allCars()) {
      if (!car.active) continue;
      context.fillRect(mx + car.x * sx - 1, my + car.y * sy - 1, 2, 2);
    }
    context.fillStyle = PALETTE.minimapPolice;
    for (const cop of state.police.cops) {
      if (!cop.active) continue;
      context.beginPath();
      context.arc(mx + cop.x * sx, my + cop.y * sy, 3, 0, Math.PI * 2);
      context.fill();
    }
    const player = state.player;
    context.fillStyle = PALETTE.minimapPlayer;
    context.save();
    context.translate(mx + player.x * sx, my + player.y * sy);
    context.rotate(player.angle);
    context.beginPath();
    context.moveTo(7, 0);
    context.lineTo(-5, -5);
    context.lineTo(-5, 5);
    context.closePath();
    context.fill();
    context.restore();
    // Viewport rectangle.
    context.strokeStyle = 'rgba(244,239,228,0.7)';
    context.lineWidth = 1;
    context.strokeRect(mx + state.camera.x * sx, my + state.camera.y * sy, VIEW.width * sx, VIEW.height * sy);
    context.restore();
    context.fillStyle = PALETTE.text;
    context.font = 'bold 13px system-ui, sans-serif';
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.fillText('SOLMAR BAY', mx, my - 8);
  }

  function drawHud(state) {
    const player = state.player;
    // Top-left panel: health, money, wanted stars.
    context.fillStyle = PALETTE.panel;
    context.fillRect(14, 12, 300, 86);
    context.strokeStyle = PALETTE.panelBorder;
    context.lineWidth = 1;
    context.strokeRect(14, 12, 300, 86);
    text(`$${state.money}`, 26, 40, 24, PALETTE.text, 'left');
    // Health bar.
    context.fillStyle = '#3a3f4a';
    context.fillRect(26, 52, 150, 12);
    context.fillStyle = player.health > 30 ? PALETTE.health : PALETTE.healthLow;
    context.fillRect(26, 52, 150 * Math.max(0, player.health / 100), 12);
    text(`${Math.ceil(player.health)}`, 184, 64, 14, PALETTE.muted, 'left');
    // Wanted stars, top-right of the panel.
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.police.wanted ? STAR : '☆';
    text(stars, 26, 88, 20, state.police.wanted > 0 ? PALETTE.star : PALETTE.starEmpty, 'left');
    // Speed, bottom-left, when driving (with a dark backing so it reads over roads).
    if (player.inCar && player.car) {
      const kmh = Math.round(Math.abs(player.car.speed) * SPEED_TO_KMH);
      context.fillStyle = 'rgba(16, 15, 20, 0.72)';
      context.fillRect(14, VIEW.height - 96, 150, 72);
      text(`${kmh}`, 26, VIEW.height - 52, 44, PALETTE.text, 'left');
      text('km/h', 92, VIEW.height - 52, 16, PALETTE.muted, 'left');
      text('E — get out   Space — brake', 26, VIEW.height - 24, 14, PALETTE.muted, 'left');
    } else {
      text('WASD — move   Shift — run   E — enter car   F — shoot   G — punch', 26, VIEW.height - 24, 14, PALETTE.muted, 'left');
    }
    // Mission objective, top centre.
    const objective = state.missions.objective();
    const timer = state.missions.active && state.missions.timeLeft > 0 ? `  —  ${state.missions.timeLeft}s` : '';
    text(objective + timer, VIEW.width / 2, 36, 18, PALETTE.text, 'center');
    // Mission dialogue / toast under the objective.
    const toast = state.missions.toast;
    if (toast) {
      text(toast, VIEW.width / 2, 64, 15, PALETTE.marker, 'center');
    }
    // Save flash.
    if (state.savedFlash > 0) text('Saved.', VIEW.width / 2, 92, 14, PALETTE.health, 'center');
    // Mute state.
    if (state.muted) text('Muted (M)', VIEW.width - 26, 36, 14, PALETTE.muted, 'right');
    drawMinimap(state);
  }

  function drawPanel(title, lines, prompt) {
    const width = 640;
    const height = 150 + lines.length * 34 + 60;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.panelBorder;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 72, 46, PALETTE.text, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 128 + i * 34, 18, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 34, 20, PALETTE.marker, 'center');
  }

  /** Paint one frame: the world through the camera, then the HUD or a menu screen. */
  function draw(state, screen) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, view.w, view.h);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const shakeX = state.effects.shakeX;
    const shakeY = state.effects.shakeY;
    // World space, with the camera and the shake.
    context.save();
    context.translate(-state.camera.x + shakeX, -state.camera.y + shakeY);
    drawCity(state);
    drawCash(state);
    drawMarker(state);
    drawEntities(state);
    context.restore();
    // Screen space: HUD and menus.
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawPanel('SOLMAR BAY', [
        'A driver for hire. A city that never sleeps.',
        'Steal cars, outrun the cops, run Marla\'s jobs — and get paid.',
        'WASD move · Shift run · E enter car · F shoot · G punch · P pause · M mute',
      ], 'Press Space or click to start');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['Take a breath. The city waits.', 'L — save your progress'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel('Busted', [
        `The cops got you, Rico. You earned $${state.money} this run.`,
        `Best: $${state.best}`,
      ], 'Press Space to try again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, resize, view };
}
