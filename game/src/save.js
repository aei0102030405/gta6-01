// Save and load: money, finished jobs, and the best money earned, kept in the
// browser's local storage. Nothing here touches the game rules; the world calls
// save() when a job pays out and on demand (L), and load() at boot.

import { BEST_KEY, MISSIONS, SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      money: typeof data.money === 'number' ? data.money : 0,
      done: Array.isArray(data.done) && data.done.length === MISSIONS.length ? data.done.map(Boolean) : MISSIONS.map(() => false),
      best: typeof data.best === 'number' ? data.best : 0,
    };
  } catch {
    return null;
  }
}

export function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.money,
      done: state.missions.done,
      best: state.best,
    }));
    return true;
  } catch {
    return false;
  }
}

export function loadBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit only.
  }
}
