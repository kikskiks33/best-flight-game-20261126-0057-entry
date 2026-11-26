// Kestrel Mail Run — the main loop. This is the one file that knows
// about everything at once: it asks the input what the pilot wants, asks
// the plane to fly, asks the sortie whether anything counted, and then
// asks the renderer to paint it all. Nothing clever lives here on
// purpose — when something looks wrong in the air, this is the first
// place you look, and it should read like a checklist, not a puzzle.
//
// States: title → flying ⇄ paused → done (landed, crashed or ditched).
// A `?shot=N` in the URL freezes the game into a screenshot pose
// instead, so the pictures the bounty judges are the game itself,
// mid-flight, with the pilot's hands off the stick.
//
// The canvas is fixed at 1280×720 inside and scaled by CSS, so the
// screenshots and the player's window always see the same framing.

import { TUNE } from './config.js';
import { makePlane, stepPlane } from './plane.js';
import { makeSortie, stepSortie, dropParcel, resultLine, medalFor } from './missions.js';
import { makeInput, readStick, wasPressed, throttleKeys, clearPresses } from './input.js';
import {
  startAudio, updateEngine, ringChime, dropThud, clickSound,
  landFanfare, crashSound, stallWarning, toggleMute,
} from './audio.js';
import {
  makeCamera, drawSky, drawTerrain, drawRunway, drawVegetation,
  drawRings, drawDropZones, drawParcels, drawShadow, drawPlaneSprite,
} from './render.js';
import { drawCockpit, drawHUD, drawTitle, drawPaused, drawResults } from './hud.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = 1280;
const H = 720;
// ~70° vertical field of view: wide enough to feel fast, narrow enough
// that the rings read as gates instead of dots.
const FOCAL = (H / 2) / Math.tan(0.61);

const params = new URLSearchParams(location.search);
const shotNum = Number(params.get('shot') || 0);
const shotMode = shotNum >= 1 && shotNum <= 4;

const input = makeInput(canvas);
let plane = makePlane();
let sortie = makeSortie();
let state = 'title'; // title | flying | paused | done
let camMode = 'chase'; // chase | cockpit
let clock = 0; // seconds of game time; drives the sky, the warnings, the messages
let lastStallBeep = 0;

// A screenshot pose: fixed plane, fixed sortie, frozen clock, one frame
// and then nothing — the browser paints it once and sits still.
if (shotMode) {
  const pose = applyShot(shotNum, plane, sortie);
  clock = pose.time;
  camMode = pose.camMode;
  state = 'flying';
}

// The title screen flies itself: the camera drifts in a slow circle
// over the valley with the Kestrel parked on the strip, so the menu is
// a view out of the window rather than a black box with a logo.
const attract = { angle: 0 };

function render(now) {
  const cam = makeCamera(plane, now);
  drawSky(ctx, W, H, cam, plane);
  drawTerrain(ctx, W, H, cam, FOCAL);
  drawRunway(ctx, W, H, cam, FOCAL);
  drawVegetation(ctx, W, H, cam, FOCAL);
  drawDropZones(ctx, W, H, cam, FOCAL, sortie);
  drawRings(ctx, W, H, cam, FOCAL, sortie, now);
  drawParcels(ctx, W, H, cam, FOCAL, sortie);
  if (plane.airborne) drawShadow(ctx, W, H, cam, FOCAL, plane);
  if (camMode === 'chase') drawPlaneSprite(ctx, W, H, plane, now);
  if (camMode === 'cockpit') drawCockpit(ctx, W, H, plane, now);
  drawHUD(ctx, W, H, plane, sortie, now, camMode);
}

function freshFlight() {
  plane = makePlane();
  sortie = makeSortie();
  state = 'flying';
  camMode = 'chase';
  sortie.started = true;
  clock = 0;
}

function takeOff() {
  startAudio();
  clickSound();
  freshFlight();
}

canvas.addEventListener('click', () => {
  startAudio();
  if (state === 'title') takeOff();
});
canvas.addEventListener('mousedown', () => startAudio());

let last = performance.now();

function frame(nowMs) {
  const dt = Math.min(0.05, Math.max(0.001, (nowMs - last) / 1000));
  last = nowMs;

  // A frozen screenshot: paint once and stop. No loop, no clock.
  if (shotMode) {
    render(clock);
    return;
  }

  clock += dt;
  readStick(input);

  if (state === 'title') {
    attract.angle += dt * 0.04;
    plane.heading = attract.angle;
    plane.x = Math.sin(attract.angle) * 40;
    plane.z = -180 + Math.cos(attract.angle) * 40;
    render(clock);
    drawTitle(ctx, W, H, clock);
    if (wasPressed(input, 'Enter') || wasPressed(input, 'Space')) takeOff();
    clearPresses(input);
    requestAnimationFrame(frame);
    return;
  }

  if (state === 'paused') {
    render(clock);
    drawPaused(ctx, W, H);
    if (wasPressed(input, 'KeyP') || wasPressed(input, 'Escape')) {
      state = 'flying';
      clickSound();
    }
    clearPresses(input);
    requestAnimationFrame(frame);
    return;
  }

  if (state === 'done') {
    render(clock);
    drawResults(ctx, W, H, plane, sortie, resultLine(sortie), medalFor(sortie));
    if (wasPressed(input, 'KeyR') || wasPressed(input, 'Enter')) takeOff();
    clearPresses(input);
    requestAnimationFrame(frame);
    return;
  }

  // --- flying: keys first, then physics, then the mission's verdict ---
  plane.throttleTarget = throttleKeys(input, plane.throttleTarget);
  if (wasPressed(input, 'KeyP') || wasPressed(input, 'Escape')) {
    state = 'paused';
    clickSound();
    clearPresses(input);
    requestAnimationFrame(frame);
    return;
  }
  if (wasPressed(input, 'KeyC')) {
    camMode = camMode === 'chase' ? 'cockpit' : 'chase';
    clickSound();
  }
  if (wasPressed(input, 'KeyM')) toggleMute();
  if (wasPressed(input, 'Space') && dropParcel(sortie, plane, clock)) dropThud();
  if (wasPressed(input, 'KeyR')) {
    takeOff();
    clearPresses(input);
    requestAnimationFrame(frame);
    return;
  }

  stepPlane(plane, { pitch: input.pitch, roll: input.roll }, dt);
  const event = stepSortie(sortie, plane, dt, clock);
  if (event === 'ring') ringChime();
  else if (event === 'drop') dropThud();
  else if (event === 'landed') landFanfare();
  else if (event === 'crashed') crashSound();

  // The stall buzzer, at most once a second, while the wing is giving up.
  if (plane.airborne && plane.speed < TUNE.stallSpeed + 5 && clock - lastStallBeep > 1) {
    stallWarning();
    lastStallBeep = clock;
  }
  updateEngine(plane.throttle, plane.speed, plane.airborne);

  if (sortie.finished) state = 'done';

  render(clock);
  clearPresses(input);
  requestAnimationFrame(frame);
}

// A little probe for play-testing: the state a driver can read without
// poking at the canvas. Harmless in the shipped game.
window.__kestrel = {
  get state() { return state; },
  get plane() { return { ...plane }; },
  get sortie() {
    return {
      mission: sortie.missionIndex,
      rings: sortie.ringsDone,
      drops: sortie.dropsDone,
      score: sortie.score,
      time: sortie.time,
      result: sortie.result,
      finished: sortie.finished,
    };
  },
  start: takeOff,
};

requestAnimationFrame(frame);
