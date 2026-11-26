// Kestrel Mail Run — tuning knobs, all in one place so the feel can be
// tweaked without hunting through the flight model or the renderer.
// Units are deliberately game-y: 1 unit = 1 metre, speeds in knots-ish,
// altitudes in feet on the HUD (metres * 3.28 under the hood).

export const TUNE = {
  // How fast the Kestrel can go, and where it gives up flying.
  maxSpeed: 165, // knots at full throttle, level
  cruiseSpeed: 118, // knots the throttle naturally settles toward
  stallSpeed: 52, // below this the wing stops pretending to work
  // Throttle: 0..1, eased toward the target so the engine feels weighty.
  throttleRate: 0.55, // per second
  accel: 26, // knots per second toward the throttle's target speed
  // Pitch and roll, in radians per second at full stick.
  pitchRate: 0.62,
  rollRate: 1.9,
  bankTurn: 0.9, // how much bank turns the nose (radians/sec per radian of bank)
  // Gravity's opinion, in metres per second squared, felt when slow.
  sinkRate: 9,
  climbRate: 10, // metres per second of climb from full power above cruise
  // Fuel: a full tank lasts a whole sortie with room to spare if you fly
  // sensibly, and running dry means gliding home, not falling out of the sky.
  fuelBurn: 0.55, // percent per second at full throttle
  fuelStart: 100,
  // Damage: one hard knock is survivable, two is a bad day.
  crashSpeed: 95, // touching terrain above this speed ends the flight
  hardLandingVs: 9, // vertical speed (m/s) above this on touchdown = crash
  softLandingVs: 4.5, // below this on the strip = a landing to be proud of
  // The world.
  worldHalf: 2600, // playable valley, half-width in metres
  waterLevel: 4, // terrain below this near the river is water
  ringRadius: 26, // metres; generous, rings should feel fair
  dropRadius: 42, // metres; the painted circle on the field
  runway: { x: 0, z0: -260, z1: 320, halfWidth: 22 },
  // Camera: how far behind the tail the chase camera sits.
  camBack: 26,
  camUp: 7.5,
  camLookAhead: 46,
  // Scoring.
  ringPoints: 100,
  dropPoints: 150,
  landingPoints: 300,
  timeBonusPerSecond: 2, // shaved off the clock, paid at the end
};

// The three jobs of one sortie, in order. Each one names its own goal so
// the HUD and the briefing never have to guess what "next" means.
export const MISSIONS = [
  {
    id: 'rings',
    name: 'Ring Run',
    goal: 'Thread all 6 sky rings in order',
    hint: 'Bank gently — a hard turn bleeds speed, and speed is lift.',
  },
  {
    id: 'drops',
    name: 'Mail Drop',
    goal: 'Drop a parcel on each marked field',
    hint: 'Slow to under 120 knots, get low, press SPACE over the circle.',
  },
  {
    id: 'landing',
    name: 'Home Run',
    goal: 'Land on the Aldermere strip',
    hint: 'Line up with the runway, throttle back, flare just before touchdown.',
  },
];

// Where the rings hang: a lazy loop out over the lake and back home, each
// one placed so the next is visible from the last — and low enough that a
// straight climb out of the strip can reach the first one.
export const RINGS = [
  { x: 0, y: 70, z: 750 },
  { x: 520, y: 130, z: 1250 },
  { x: -260, y: 170, z: 1850 },
  { x: -720, y: 140, z: 1150 },
  { x: 320, y: 105, z: 520 },
  { x: 0, y: 80, z: 180 },
];

// The three fields waiting for their mail, with the name of the farm that
// gets the parcel (the valley's folk, not anyone real).
export const DROP_ZONES = [
  { x: -460, z: 720, farm: 'Hollowbrook Farm' },
  { x: 620, z: 1620, farm: 'Miller’s Crossing' },
  { x: -180, z: 2150, farm: 'Northfield Dairy' },
];

// Palette: one warm late-afternoon look, shared by terrain, sky and HUD,
// so the whole game reads as a single place rather than a pile of parts.
export const PALETTE = {
  skyTop: '#7db8e8',
  skyMid: '#bcd9ef',
  skyLow: '#f6d9a0',
  sun: '#fff3c4',
  grassLow: '#6fae4e',
  grassHigh: '#4d8a3a',
  meadow: '#8fbf5a',
  rock: '#8d8578',
  snow: '#f2f4f6',
  sand: '#d9c48f',
  water: '#3f8fbf',
  waterDeep: '#2c6d9e',
  pine: '#2e6b34',
  pineDark: '#245628',
  roofA: '#b4563c',
  roofB: '#7a6a4f',
  wallA: '#efe3c8',
  wallB: '#d9c9a3',
  runway: '#5c5c60',
  runwayMark: '#f4f4ee',
  ring: '#ff9a2e',
  ringDone: '#58d68d',
  planeRed: '#c23b2e',
  planeCream: '#f2e6c9',
  hudAmber: '#ffc857',
  hudGreen: '#7ee787',
  hudRed: '#ff6b5e',
};
