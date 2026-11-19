// Every tuning number and colour for Solmar Bay, in one place.
// The world is a fixed 3200x2400 city; the renderer shows a 1280x720 window of it
// through a camera that follows the player, so no rule below depends on the screen size.

export const WORLD = { width: 3200, height: 2400 };

/** Logical viewport the camera shows. */
export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** City grid: road centre lines and width; blocks sit between them. */
export const CITY = {
  roadWidth: 84,
  verticalRoads: [200, 600, 1000, 1400, 1800, 2200, 2600, 3000],
  horizontalRoads: [200, 600, 1000, 1400, 1800, 2200],
  /** South edge is a beach: sand from here, water from here. */
  beachY: 2260,
  waterY: 2330,
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 240,
  runSpeed: 370,
  health: 100,
  /** Health regained per second while wanted is 0 and undamaged for a while. */
  regen: 2,
  regenDelay: 5,
};

export const CAR = {
  length: 46,
  width: 22,
  maxSpeed: 560,
  reverseSpeed: 200,
  accel: 430,
  brake: 700,
  drag: 0.55,
  /** Steering rate at full speed, radians per second; sharper when slow. */
  turnRate: 2.7,
  /** Damage taken on a hard building hit, scaled by impact speed. */
  crashDamage: 26,
};

export const TRAFFIC = {
  count: 14,
  speed: 150,
  speedJitter: 50,
  colors: ['#c94f42', '#3f7fb5', '#d9a441', '#7a9a52', '#8e6fb5', '#c9c9c9', '#4a4a52'],
};

export const POLICE = {
  carSpeed: 545,
  carHealth: 60,
  ramDamage: 5,
  ramCooldown: 1.3,
  /** Shots start at this wanted level; police bullets are slow and dodgeable. */
  shootWanted: 3,
  bulletSpeed: 420,
  bulletDamage: 10,
  shootInterval: 1.6,
  /** How long without a crime before wanted starts to fall, and the fall rate. */
  decayDelay: 18,
  decayInterval: 6,
};

export const PED = {
  count: 42,
  walkSpeed: 55,
  walkJitter: 25,
  radius: 10,
};

export const WEAPON = {
  /** Pistol damage per bullet, and the time between shots. */
  damage: 20,
  cooldown: 0.28,
  bulletSpeed: 780,
  bulletRange: 520,
  /** Melee punch: reach and damage, used when the target is close. */
  punchReach: 34,
  punchDamage: 12,
  punchCooldown: 0.45,
};

export const MISSIONS = [
  {
    id: 'wheels',
    name: 'First Wheels',
    giver: 'Marla',
    brief:
      'Rico, you need wheels. Any car will do — just don\'t get caught. Bring it to my garage on Palm Row.',
    objective: 'Steal a car (E) and bring it to the garage',
    reward: 200,
  },
  {
    id: 'package',
    name: 'The Package',
    giver: 'Marla',
    brief:
      'A package is waiting at the south docks. Pick it up and get it to the Seaview Motel. Ninety seconds. Don\'t dawdle.',
    objective: 'Pick up the package, deliver it to the motel',
    reward: 350,
    timeLimit: 90,
  },
  {
    id: 'heat',
    name: 'Lose the Heat',
    giver: 'Marla',
    brief:
      'The cops saw you lift my car, Rico. You\'ve got two stars on you. Shake them off and get back here clean.',
    objective: 'Lose the cops — bring your wanted level to 0',
    reward: 500,
    timeLimit: 150,
    startWanted: 2,
  },
];

/** Cash bundles lying around the city: value range and how many at once. */
export const CASH = { count: 6, min: 25, max: 60 };

/** Dusk palette: warm sun-soaked streets, teal sea, terracotta roofs. */
export const PALETTE = {
  backdrop: '#1d1a24',
  grass: '#7fae62',
  park: '#6da054',
  sand: '#e8c98a',
  water: '#3a7ca5',
  waterDeep: '#2c638a',
  road: '#3a3f4a',
  roadEdge: '#2e323c',
  lane: '#e8d27a',
  sidewalk: '#9a938a',
  buildingRoof: ['#c96f4a', '#b5533c', '#d9a441', '#7a9a52', '#4a7a8c', '#a87a5a', '#8e6fb5'],
  buildingSide: '#5a5148',
  palm: '#3f7a44',
  palmTrunk: '#8a6f4d',
  player: '#f2c94c',
  playerJacket: '#2f6fb5',
  police: '#2f6fb5',
  policeLight: '#e5534b',
  pedShirt: ['#d96f5a', '#5a8fd9', '#7ab56a', '#d9a441', '#9a6fb5', '#e8e8e8'],
  carWindow: '#22303c',
  marker: '#f2c94c',
  markerRing: '#ffffff',
  text: '#f4efe4',
  muted: '#b8b0a0',
  panel: 'rgba(20, 18, 28, 0.82)',
  panelBorder: '#f2c94c',
  health: '#5ac96f',
  healthLow: '#e5534b',
  star: '#f2c94c',
  starEmpty: '#5a5548',
  minimapBg: 'rgba(20, 18, 28, 0.78)',
  minimapRoad: '#8a8578',
  minimapWater: '#3a7ca5',
  minimapPlayer: '#f2c94c',
  minimapPolice: '#e5534b',
  minimapMarker: '#f2c94c',
  minimapCar: '#b8b0a0',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
/** Cash Rico starts with, before any job or pickup. */
export const START_MONEY = 50;

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'solmar-bay.save.v1';
export const BEST_KEY = 'solmar-bay.best.v1';
