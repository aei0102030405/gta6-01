// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between four screens: title, play, paused and game over.
//
// ?seed=N fixes the city and traffic. ?shot=start|drive|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CRASH, EVENT_GAME_OVER, EVENT_MISSION_DONE, EVENT_MISSION_FAIL } from './world.js';
import { createAudio } from './audio.js';
import { loadSave, saveGame, saveBest } from './save.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_SAVE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
/** The seed space: any 32-bit value. */
const SEED_MAX = 4294967296;
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * SEED_MAX);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const saved = loadSave();
const world = createWorld(createRandom(seed), audio);
const renderer = createRenderer(canvas);

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset(saved);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Steal a car and bring it to Marla\'s garage.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.money > world.state.best) {
      world.state.best = world.state.money;
      saveBest(world.state.best);
    }
    saveGame(world.state);
    announce(`Busted. You earned $${world.state.money}. Best $${world.state.best}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_MISSION_DONE) {
      audio.missionDone();
      saveGame(world.state);
      announce(`Job done. $${world.state.money}.`);
    } else if (events & EVENT_MISSION_FAIL) {
      audio.missionFail();
      announce('Job failed. Press Enter to try the next job.');
    } else if (events & EVENT_GAME_OVER) {
      endGame();
    }
    if (events & EVENT_CRASH) {
      announce('Crash.');
    }
  }

  function handleActions(actions) {
    if (actions & ACTION_SAVE) {
      if (saveGame(world.state)) {
        world.state.savedFlash = 2;
        announce('Progress saved.');
      }
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      audio.unlock();
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Take the one-shot presses once per frame: the screen handler and the first
    // world step share them, so a press is never lost and never counted twice.
    let actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        const events = world.step(STEP, input, actions, () => {});
        actions = 0;
        handleEvents(events);
        accumulator -= STEP;
        if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) break;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar Bay. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
