// Aldermere valley: the ground everything flies over. One height function
// rules it all — the renderer, the crash checks and the shadow all ask this
// file how high the ground is at (x, z), so the plane can never disagree
// with what the player sees.
//
// The valley is a bowl: gentle rolling fields near the airfield, a river
// winding down its west side into a lake, and proper mountains hemming the
// edges in, so turning back always feels like coming home.

import { fbm, mulberry32 } from './random.js';
import { TUNE } from './config.js';

export const SEED = 20261126;

// Where the river runs: a slow S-curve down the west of the valley.
export function riverX(z) {
  return -520 + 230 * Math.sin(z * 0.0009 + 0.6) + 90 * Math.sin(z * 0.0023);
}

// The lake the river feeds, an ellipse in the north-west.
export const LAKE = { x: -720, z: 1560, rx: 300, rz: 420 };

function inLake(x, z) {
  const dx = (x - LAKE.x) / LAKE.rx;
  const dz = (z - LAKE.z) / LAKE.rz;
  return dx * dx + dz * dz < 1;
}

// Distance from the runway strip, so the airfield can be graded flat.
function runwayDist(x, z) {
  const r = TUNE.runway;
  const dx = Math.max(0, Math.abs(x - r.x) - r.halfWidth);
  const dz = Math.max(0, Math.max(r.z0 - z, z - r.z1));
  return Math.hypot(dx, dz);
}

// The one height function. Rolling fbm hills, mountains at the rim,
// a carve where the river and lake sit, and a flat apron at the airfield.
export function groundHeight(x, z) {
  const hills = fbm(x * 0.0011, z * 0.0011, SEED, 3);
  let h = 6 + hills * 46;

  // The rim: the further from the middle, the higher the ground climbs.
  const edge = Math.max(Math.abs(x), Math.abs(z)) / TUNE.worldHalf;
  if (edge > 0.62) {
    const t = (edge - 0.62) / 0.38;
    h += t * t * 210;
  }

  // River carve: the ground dips toward the waterline near the river.
  const dRiver = Math.abs(x - riverX(z));
  if (dRiver < 90) h = Math.min(h, 2 + (dRiver / 90) * 10);
  if (inLake(x, z)) h = 1.5;

  // The airfield apron: flat enough to land on, blending out over 120 m.
  const dRun = runwayDist(x, z);
  if (dRun < 130) {
    const t = Math.min(1, dRun / 130);
    h = 2.5 + (h - 2.5) * t * t;
  }
  return h;
}

export function isWater(x, z) {
  if (inLake(x, z)) return true;
  return Math.abs(x - riverX(z)) < 26 && groundHeight(x, z) <= TUNE.waterLevel + 1.5;
}

// Pines: seeded once at load, only where the ground is gentle, dry, and
// out of the way of the strip, the river and the town.
function scatterTrees() {
  const rand = mulberry32(SEED + 7);
  const trees = [];
  let guard = 0;
  while (trees.length < 520 && guard++ < 9000) {
    const x = (rand() * 2 - 1) * (TUNE.worldHalf - 120);
    const z = (rand() * 2 - 1) * (TUNE.worldHalf - 120);
    const h = groundHeight(x, z);
    if (h < 6 || h > 105) continue;
    if (Math.abs(x - riverX(z)) < 60) continue;
    if (runwayDist(x, z) < 110) continue;
    if (Math.hypot(x - 350, z - 900) < 260) continue; // the town clearing
    if (inLake(x, z)) continue;
    trees.push({ x, z, h, s: 0.8 + rand() * 0.7, lean: (rand() - 0.5) * 0.12 });
  }
  return trees;
}

// Aldermere town: a loose grid of little houses east of the strip, each
// with a warm wall, a pitched roof and a lit window or two.
function scatterHouses() {
  const rand = mulberry32(SEED + 21);
  const houses = [];
  for (let gx = 0; gx < 6; gx++) {
    for (let gz = 0; gz < 6; gz++) {
      if (rand() < 0.22) continue; // gaps keep it a village, not a grid
      const x = 220 + gx * 52 + (rand() - 0.5) * 22;
      const z = 700 + gz * 56 + (rand() - 0.5) * 22;
      houses.push({
        x, z,
        h: groundHeight(x, z),
        w: 14 + rand() * 8,
        d: 12 + rand() * 8,
        tall: 9 + rand() * 5,
        roof: rand() < 0.5 ? 0 : 1,
        lit: rand() < 0.6,
      });
    }
  }
  return houses;
}

// Clouds: a handful of soft billboards that drift slowly downwind.
function scatterClouds() {
  const rand = mulberry32(SEED + 33);
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    clouds.push({
      x: (rand() * 2 - 1) * 2400,
      z: (rand() * 2 - 1) * 2400,
      y: 420 + rand() * 180,
      s: 120 + rand() * 160,
      drift: 2 + rand() * 3,
    });
  }
  return clouds;
}

export const TREES = scatterTrees();
export const HOUSES = scatterHouses();
export const CLOUDS = scatterClouds();
