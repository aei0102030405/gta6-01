// A working gta6-01 entry (Node 22, standard library only): the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html and its ES
// modules, no library and no network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library. Only the plumbing, not an open world: Block
// Dodger, a plain 2D canvas game where a paddle dodges falling blocks and catches coins, with a
// title screen, score, lives and levels, game over and restart, flat colours and no sound. Build
// your own open-world crime game in its place (three.js or any library you vendor under game/),
// put your 3 or 4 PNG or JPEG screenshots in screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Gate caps from the scorer (reference/gate.json): at most 993 files and 48 MiB
// under game/, and 3–4 screenshots of at most 256 KiB each.
const GAME_MAX_FILES = 993;
const GAME_MAX_BYTES = 48 * 1024 * 1024;
const SHOTS_MIN = 3;
const SHOTS_MAX = 4;
const SHOT_MAX_BYTES = 256 * 1024;

function logInfo(message: string): void {
  process.stdout.write(`[entry] ${message}\n`);
}

function fail(message: string): never {
  throw new Error(`[entry] ${message}`);
}

// Recursively list every file under dir as [relativePath, bytes] pairs.
function listFiles(dir: string, base = dir): Array<[string, number]> {
  const found: Array<[string, number]> = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listFiles(full, base));
    else if (entry.isFile()) found.push([full.slice(base.length + 1), statSync(full).size]);
  }
  return found;
}

// Pre-flight: refuse to hand in a game the scorer would reject, with a clear
// reason, before anything is copied.
function validate(): { gameFiles: Array<[string, number]>; shotFiles: Array<[string, number]> } {
  const indexHtml = join(here, 'game', 'index.html');
  if (!existsSync(indexHtml)) fail('game/index.html is missing — nothing to hand in');
  const gameFiles = listFiles(join(here, 'game'));
  const gameBytes = gameFiles.reduce((sum, [, size]) => sum + size, 0);
  if (gameFiles.length > GAME_MAX_FILES) {
    fail(`game/ holds ${gameFiles.length} files, over the ${GAME_MAX_FILES} cap`);
  }
  if (gameBytes > GAME_MAX_BYTES) {
    fail(`game/ totals ${gameBytes} bytes, over the ${GAME_MAX_BYTES} cap`);
  }
  const shotsDir = join(here, 'screenshots');
  if (!existsSync(shotsDir)) fail('screenshots/ is missing — the entry needs 3–4 screenshots');
  const shotFiles = listFiles(shotsDir);
  if (shotFiles.length < SHOTS_MIN || shotFiles.length > SHOTS_MAX) {
    fail(`screenshots/ holds ${shotFiles.length} files, need ${SHOTS_MIN}–${SHOTS_MAX}`);
  }
  for (const [name, size] of shotFiles) {
    if (size > SHOT_MAX_BYTES) fail(`screenshot ${name} is ${size} bytes, over the ${SHOT_MAX_BYTES} cap`);
  }
  return { gameFiles, shotFiles };
}

const { gameFiles, shotFiles } = validate();
logInfo(`pre-flight ok: game/ has ${gameFiles.length} files, screenshots/ has ${shotFiles.length}`);

mkdirSync(out, { recursive: true });
logInfo('copying game/ ...');
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
logInfo('copying screenshots/ ...');
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
const dossierPath = join(out, 'dossier.json');
writeFileSync(dossierPath, dossier);
const dossierBytes = statSync(dossierPath).size;
logInfo(`done: ${gameFiles.length} game files, ${shotFiles.length} screenshots, dossier.json ${dossierBytes} bytes`);
