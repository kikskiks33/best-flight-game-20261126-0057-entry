// Screenshot poses: fixed, hand-picked moments of the game, driven by
// the same flight state the player flies with. `?shot=1` (and so on) in
// the URL puts the Kestrel exactly there, the clock frozen, so the four
// screenshots are real renders of the game's own code — the same code
// path a player sees, just with the pilot's hands off the stick.
//
// 1 — cover: chase view, ring 1 dead ahead over the lake road, the strip
//    behind us, HUD lit, instruments warm.
// 2 — ring run: low over the river, ring 3 ahead, town on the right.
// 3 — the approach: cockpit camera, lined up on the runway, threshold
//    bars and the windsock in sight.
// 4 — mail drop: over Hollowbrook Farm, parcel away, smoke marking the
//    field, the valley spread out below.

import { makePlane } from './plane.js';
import { makeSortie } from './missions.js';

// Each pose sets the plane, the sortie progress and the camera, then
// hands back the frozen clock the renderer should use.
export function applyShot(shot, plane, sortie) {
  const poses = {
    1: () => {
      // Climbing away from the strip, ring 1 right in front of the nose.
      plane.x = 0;
      plane.y = 95;
      plane.z = 330;
      plane.heading = 0.06;
      plane.pitch = 0.08;
      plane.roll = 0.1;
      plane.speed = 118;
      plane.throttle = 0.78;
      plane.throttleTarget = 0.78;
      plane.fuel = 96;
      plane.airborne = true;
      plane.vspeed = 6;
      sortie.started = true;
      sortie.time = 42;
      sortie.score = 0;
    },
    2: () => {
      // Threading the loop low over the river, banked toward ring 3,
      // the town on the right and the lake ahead.
      plane.x = 100;
      plane.y = 160;
      plane.z = 1400;
      plane.heading = -0.6;
      plane.pitch = 0.02;
      plane.roll = -0.3;
      plane.speed = 132;
      plane.throttle = 0.85;
      plane.throttleTarget = 0.85;
      plane.fuel = 88;
      plane.airborne = true;
      plane.vspeed = 2;
      sortie.started = true;
      sortie.time = 118;
      sortie.score = 200;
      sortie.ringIndex = 2;
      sortie.ringsDone = 2;
      sortie.ringFlashUntil = 999;
    },
    3: () => {
      // Final approach, cockpit view, lined up on the runway — the
      // strip close enough to read its markings, the windsock in sight.
      plane.x = 6;
      plane.y = 42;
      plane.z = 520;
      plane.heading = Math.PI; // heading south, back down the runway
      plane.pitch = -0.06;
      plane.roll = 0.02;
      plane.speed = 74;
      plane.throttle = 0.3;
      plane.throttleTarget = 0.3;
      plane.fuel = 61;
      plane.airborne = true;
      plane.vspeed = -3.2;
      sortie.started = true;
      sortie.time = 268;
      sortie.score = 650;
      sortie.missionIndex = 2;
      sortie.ringIndex = 6;
      sortie.ringsDone = 6;
      sortie.dropsDone = 3;
      sortie.parcelsLeft = 0;
    },
    4: () => {
      // Over Hollowbrook Farm just after the drop, parcel falling, the
      // whole valley open ahead and the lake glinting to the left.
      plane.x = -430;
      plane.y = 210;
      plane.z = 560;
      plane.heading = 0.35;
      plane.pitch = 0.0;
      plane.roll = -0.22;
      plane.speed = 108;
      plane.throttle = 0.7;
      plane.throttleTarget = 0.7;
      plane.fuel = 79;
      plane.airborne = true;
      plane.vspeed = -1;
      sortie.started = true;
      sortie.time = 176;
      sortie.score = 350;
      sortie.missionIndex = 1;
      sortie.ringIndex = 6;
      sortie.ringsDone = 6;
      sortie.parcelsLeft = 2;
      sortie.dropsDone = 1;
      sortie.parcels.push({ x: -455, y: 190, z: 700, vy: 6 });
    },
  };
  const pose = poses[shot] || poses[1];
  pose();
  return { time: 12.4 + shot * 1.7, camMode: shot === 3 ? 'cockpit' : 'chase' };
}

export function shotCount() {
  return 4;
}

export { makePlane, makeSortie };
