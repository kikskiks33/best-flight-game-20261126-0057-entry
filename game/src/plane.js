// The Kestrel itself: a little red-and-cream bush plane with an honest
// flight model. Nothing here is a real aerodynamics textbook — it is a
// handful of rules that feel right on a keyboard: throttle makes speed,
// speed makes lift, bank turns the nose, and slow flight is a negotiation.
//
// State is kept in plain numbers on one object so the renderer, the
// missions and the screenshot poses all read the same truth.

import { TUNE } from './config.js';
import { groundHeight } from './terrain.js';

export function makePlane() {
  return {
    // Position in metres: x east, y up, z north. Starts parked on the
    // strip, nose pointing up the runway, engine idling.
    x: 0,
    y: 3.2,
    z: -180,
    heading: 0, // radians, 0 = north (+z), grows clockwise
    pitch: 0, // nose up positive
    roll: 0, // right wing down positive
    speed: 0, // knots
    vspeed: 0, // vertical speed, m/s, for the landing call
    throttle: 0,
    throttleTarget: 0,
    fuel: TUNE.fuelStart,
    damage: 0,
    airborne: false,
    // Book-keeping the HUD and the results screen like to know.
    topSpeed: 0,
    maxAlt: 0,
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

// One simulation step. `stick` is { pitch: -1..1, roll: -1..1 } from the
// keys or the mouse; `dt` is seconds, clamped by the caller.
export function stepPlane(p, stick, dt) {
  // The throttle eases toward its target — a big lever does not snap.
  p.throttle = lerp(p.throttle, p.throttleTarget, Math.min(1, TUNE.throttleRate * dt * 3));

  // Target speed follows the throttle; the plane chases it.
  const targetSpeed = p.throttle * TUNE.maxSpeed;
  p.speed += clamp(targetSpeed - p.speed, -TUNE.accel * dt, TUNE.accel * dt);
  p.speed = Math.max(0, p.speed);
  p.topSpeed = Math.max(p.topSpeed, p.speed);

  // Roll answers the stick directly; pitch gets heavier as speed falls,
  // because a slow wing is a mushy wing.
  const authority = clamp(p.speed / 90, 0.35, 1);
  p.roll += stick.roll * TUNE.rollRate * dt;
  p.roll = clamp(p.roll, -1.25, 1.25);
  p.pitch += stick.pitch * TUNE.pitchRate * authority * dt;
  p.pitch = clamp(p.pitch, -0.55, 0.5);

  // Bank turns the nose, and the turn tightens with bank.
  p.heading += Math.sin(p.roll) * TUNE.bankTurn * clamp(p.speed / 60, 0, 1.6) * dt;

  // Lift: above stall speed the wing holds the nose where it points;
  // below it, the plane sinks no matter what the pilot wishes. Full
  // throttle alone only climbs gently — a real climb takes pitch — so
  // level flight at cruise power holds its altitude instead of
  // wandering skyward on its own.
  const flying = p.speed > TUNE.stallSpeed;
  const lift = flying ? 1 : Math.max(0, p.speed / TUNE.stallSpeed);
  const climbFromPitch = Math.sin(p.pitch) * p.speed * 0.514 * lift;
  const powerClimb = Math.max(0, p.throttle - 0.62) * TUNE.climbRate * lift;
  const sink = flying ? 0 : (1 - lift) * TUNE.sinkRate;
  p.vspeed = climbFromPitch + powerClimb - sink;
  // On the ground the wheels hold us; in the air the vertical speed rules.
  if (!p.airborne && p.speed < TUNE.stallSpeed) p.vspeed = 0;

  // Move: forward along the heading, up by the vertical speed.
  const fwd = p.speed * 0.514 * dt; // knots -> m/s
  p.x += Math.sin(p.heading) * Math.cos(p.pitch) * fwd;
  p.z += Math.cos(p.heading) * Math.cos(p.pitch) * fwd;
  p.y += p.vspeed * dt;
  p.maxAlt = Math.max(p.maxAlt, p.y);

  // Leaving the ground, and the gentle auto-level that keeps a new pilot
  // from spiralling: the wings want to come back to level on their own.
  if (!p.airborne && p.y > groundHeight(p.x, p.z) + 1.5) p.airborne = true;
  if (p.airborne) {
    p.roll = lerp(p.roll, 0, Math.min(1, 0.25 * dt) * (Math.abs(stick.roll) < 0.05 ? 1 : 0.15));
    p.pitch = lerp(p.pitch, 0, Math.min(1, 0.12 * dt));
  }

  // Fuel: the engine drinks in proportion to how hard it works.
  if (p.throttle > 0.02 && p.fuel > 0) {
    p.fuel = Math.max(0, p.fuel - TUNE.fuelBurn * p.throttle * dt);
    if (p.fuel <= 0) p.throttleTarget = 0; // dry tank: throttle dies
  }

  // Stay inside the valley: the mountains are a wall, not a suggestion.
  const lim = 2450;
  p.x = clamp(p.x, -lim, lim);
  p.z = clamp(p.z, -lim, lim);
  p.y = Math.min(p.y, 900);

  return p;
}

// What the ground is doing under the plane right now — the missions and
// the crash checks both ask this, so there is only one answer.
export function groundUnder(p) {
  return groundHeight(p.x, p.z);
}

export function isOnRunway(p) {
  const r = TUNE.runway;
  return (
    Math.abs(p.x - r.x) <= r.halfWidth &&
    p.z >= r.z0 - 10 &&
    p.z <= r.z1 + 10
  );
}
