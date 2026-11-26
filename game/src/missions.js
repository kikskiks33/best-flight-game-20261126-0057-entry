// The sortie: three jobs in order, one score, one clock. This file owns
// the mission state machine — what the pilot has to do next, whether the
// last thing they did counted, and how many points it was worth — so the
// flight model stays dumb about goals and the HUD stays dumb about rules.

import { MISSIONS, RINGS, DROP_ZONES, TUNE } from './config.js';
import { groundHeight, isWater } from './terrain.js';
import { isOnRunway } from './plane.js';

export function makeSortie() {
  return {
    missionIndex: 0, // 0 rings, 1 drops, 2 landing, 3 done
    ringIndex: 0,
    ringsDone: 0,
    dropsDone: 0,
    parcelsLeft: DROP_ZONES.length,
    parcels: [], // parcels in the air: { x, y, z, vy }
    parcelsLanded: [], // { x, z, hit, farm }
    score: 0,
    time: 0, // seconds since takeoff roll
    started: false,
    finished: false,
    result: null, // 'landed' | 'crashed' | 'ditched' | 'out-of-fuel'
    message: '', // the line the HUD shows about the last event
    messageUntil: 0,
    // Ring feedback: the last ring flashed green this long.
    ringFlashUntil: 0,
    // Landing verdict details, for the results screen.
    landing: null,
  };
}

function say(sortie, text, now, seconds = 3) {
  sortie.message = text;
  sortie.messageUntil = now + seconds;
}

// The next ring the pilot is aiming for, or null when the run is done.
export function nextRing(sortie) {
  return sortie.ringIndex < RINGS.length ? RINGS[sortie.ringIndex] : null;
}

export function currentMission(sortie) {
  return MISSIONS[Math.min(sortie.missionIndex, MISSIONS.length - 1)];
}

// Called when the pilot presses SPACE while flying the mail.
export function dropParcel(sortie, plane, now) {
  if (sortie.missionIndex !== 1) return false;
  if (sortie.parcelsLeft <= 0) return false;
  if (plane.speed > 130) {
    say(sortie, 'Too fast to drop — slow below 120 knots', now);
    return false;
  }
  if (plane.y > 320) {
    say(sortie, 'Too high — get under 1,000 feet to drop', now);
    return false;
  }
  sortie.parcelsLeft--;
  sortie.parcels.push({ x: plane.x, y: plane.y - 2, z: plane.z, vy: 0 });
  return true;
}

function scoreDrop(sortie, parcel, now) {
  let best = null;
  let bestD = Infinity;
  for (const zone of DROP_ZONES) {
    const d = Math.hypot(parcel.x - zone.x, parcel.z - zone.z);
    if (d < bestD) {
      bestD = d;
      best = zone;
    }
  }
  const hit = bestD <= TUNE.dropRadius;
  sortie.parcelsLanded.push({ x: parcel.x, z: parcel.z, hit, farm: best.farm });
  if (hit) {
    sortie.dropsDone++;
    sortie.score += TUNE.dropPoints;
    say(sortie, `Parcel on the mark at ${best.farm}! +${TUNE.dropPoints}`, now, 3.5);
    if (sortie.dropsDone >= DROP_ZONES.length) {
      sortie.missionIndex = 2;
      say(sortie, 'All mail delivered — head home and land on the strip', now, 5);
    }
  } else {
    say(sortie, `Parcel missed ${best.farm} by ${Math.round(bestD)} m`, now, 3.5);
  }
  return hit;
}

// One tick of mission logic. Returns an event string the main loop can
// turn into a sound: 'ring' | 'drop' | 'landed' | 'crashed' | 'ditched' | null.
export function stepSortie(sortie, plane, dt, now) {
  if (!sortie.started || sortie.finished) return null;
  sortie.time += dt;

  // --- Rings: did we just fly through the next one? ---
  const ring = nextRing(sortie);
  if (sortie.missionIndex === 0 && ring) {
    const d = Math.hypot(plane.x - ring.x, plane.y - ring.y, plane.z - ring.z);
    if (d < TUNE.ringRadius) {
      sortie.ringIndex++;
      sortie.ringsDone++;
      sortie.score += TUNE.ringPoints;
      sortie.ringFlashUntil = now + 1.2;
      if (sortie.ringIndex >= RINGS.length) {
        sortie.missionIndex = 1;
        say(sortie, 'Ring run complete! Mail run next — 3 fields, 3 parcels', now, 5);
      } else {
        say(sortie, `Ring ${sortie.ringsDone} of ${RINGS.length} — +${TUNE.ringPoints}`, now, 2.5);
      }
      return 'ring';
    }
  }

  // --- Parcels falling: they drift down, then they land somewhere. ---
  for (let i = sortie.parcels.length - 1; i >= 0; i--) {
    const parcel = sortie.parcels[i];
    parcel.vy = Math.min(parcel.vy + 22 * dt, 26);
    parcel.y -= parcel.vy * dt;
    if (parcel.y <= groundHeight(parcel.x, parcel.z) + 1) {
      sortie.parcels.splice(i, 1);
      const hit = scoreDrop(sortie, parcel, now);
      return hit ? 'drop' : 'drop-miss';
    }
  }

  // --- Terrain: the ground is not a suggestion. ---
  const ground = groundHeight(plane.x, plane.z);
  if (plane.y <= ground + 0.6) {
    plane.y = ground + 0.6;
    const onStrip = isOnRunway(plane);
    const gentle = Math.abs(plane.vspeed) <= TUNE.hardLandingVs;
    const slow = plane.speed < TUNE.crashSpeed;
    // Lined up means pointing along the strip, either way: the strip
    // runs north-south, so the heading must be near 0 or near 180°.
    const along = ((plane.heading % Math.PI) + Math.PI) % Math.PI;
    const linedUp = Math.min(along, Math.PI - along) < 0.35;
    if (sortie.missionIndex === 2 && onStrip && gentle && slow && linedUp) {
      // A landing! Grade it: soft is a proud one, firm is fine.
      const soft = Math.abs(plane.vspeed) <= TUNE.softLandingVs;
      const fuelBonus = Math.round(plane.fuel);
      const timeBonus = Math.max(0, Math.round(600 - sortie.time) * TUNE.timeBonusPerSecond);
      sortie.score += TUNE.landingPoints + fuelBonus + timeBonus;
      sortie.finished = true;
      sortie.result = 'landed';
      sortie.landing = { soft, fuelBonus, timeBonus };
      return 'landed';
    }
    // Water first: wheels and water never end well, however softly you
    // arrive — a water touchdown is a ditching, not a landing.
    if (isWater(plane.x, plane.z)) {
      sortie.finished = true;
      sortie.result = 'ditched';
      plane.damage = 100;
      return 'crashed';
    }
    if (gentle && slow) {
      // A gentle touchdown somewhere that is not the strip, or not the
      // landing the sortie asked for: down safe, but the sortie is over
      // — you cannot take off again from a farmer's field here.
      sortie.finished = true;
      sortie.result = 'landed-early';
      return 'landed';
    }
    // Anything else at ground level is a crash.
    sortie.finished = true;
    sortie.result = 'crashed';
    plane.damage = 100;
    return 'crashed';
  }

  // --- Out of fuel over nowhere: a glide that ends where it ends. ---
  if (plane.fuel <= 0 && plane.speed < 40 && plane.airborne) {
    // The plane will sink on its own; the ground check above finishes it.
  }

  return null;
}

// A one-line summary for the results screen.
export function resultLine(sortie) {
  if (sortie.result === 'landed') {
    const soft = sortie.landing && sortie.landing.soft;
    return soft
      ? 'A greaser — the Kestrel barely kissed the grass.'
      : 'Down safe on the strip. The mail is late, but it is here.';
  }
  if (sortie.result === 'landed-early') return 'Down in a field, short of the strip. The sortie ends here.';
  if (sortie.result === 'ditched') return 'Ditched in the river. The pilot is fine; the mail is soggy.';
  return 'The Kestrel came down hard in the valley. The pilot walked away.';
}

export function medalFor(sortie) {
  if (sortie.result !== 'landed') return null;
  if (sortie.time < 420) return 'Gold wings';
  if (sortie.time < 540) return 'Silver wings';
  return 'Bronze wings';
}
