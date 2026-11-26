// Sound, synthesized live with WebAudio — no audio files, no network.
// The engine is two detuned sawtooths through a low-pass filter plus a
// breath of filtered noise for the wind; everything else is a short
// envelope on a sine or a burst of noise. It all starts on the first
// click or keypress, because browsers insist the pilot says hello first.

let ctx = null;
let engineOscA = null;
let engineOscB = null;
let engineGain = null;
let engineFilter = null;
let windSrc = null;
let windGain = null;
let windFilter = null;
let muted = false;
let started = false;

function ensure() {
  if (ctx) return true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
  } catch {
    return false;
  }
  // The engine: a low growl whose pitch follows the throttle.
  engineOscA = ctx.createOscillator();
  engineOscB = ctx.createOscillator();
  engineOscA.type = 'sawtooth';
  engineOscB.type = 'sawtooth';
  engineOscB.detune.value = 7;
  engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 420;
  engineFilter.Q.value = 2;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  engineOscA.connect(engineFilter);
  engineOscB.connect(engineFilter);
  engineFilter.connect(engineGain);
  engineGain.connect(ctx.destination);
  engineOscA.start();
  engineOscB.start();

  // The wind: looped noise, brighter and louder the faster we go.
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  windSrc = ctx.createBufferSource();
  windSrc.buffer = buf;
  windSrc.loop = true;
  windFilter = ctx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 700;
  windFilter.Q.value = 0.6;
  windGain = ctx.createGain();
  windGain.gain.value = 0;
  windSrc.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(ctx.destination);
  windSrc.start();
  return true;
}

// Call from any user gesture. Safe to call often; it only starts once.
export function startAudio() {
  if (started) {
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return;
  }
  if (!ensure()) return;
  started = true;
  if (ctx.state === 'suspended') ctx.resume();
}

// Every frame: the engine note and the wind follow throttle and speed.
export function updateEngine(throttle, speed, airborne) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const rpm = 52 + throttle * 68; // Hz, idle grumble to full song
  engineOscA.frequency.setTargetAtTime(rpm, t, 0.08);
  engineOscB.frequency.setTargetAtTime(rpm * 1.5, t, 0.08);
  engineFilter.frequency.setTargetAtTime(320 + throttle * 900, t, 0.1);
  const vol = airborne ? 0.05 + throttle * 0.075 : 0.02 + throttle * 0.05;
  engineGain.gain.setTargetAtTime(vol, t, 0.12);
  const wind = Math.min(1, speed / 170);
  windGain.gain.setTargetAtTime(airborne ? wind * 0.05 : 0, t, 0.2);
  windFilter.frequency.setTargetAtTime(500 + wind * 1400, t, 0.2);
}

function blip(freq, dur, vol, type = 'sine', when = 0) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noiseBurst(dur, vol, freq = 900) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(t0);
}

// The little sounds that tell the pilot something good happened.
export function ringChime() {
  blip(880, 0.22, 0.22);
  blip(1318, 0.35, 0.2, 'sine', 0.09);
}

export function dropThud() {
  noiseBurst(0.16, 0.3, 500);
  blip(196, 0.2, 0.2, 'triangle');
}

export function clickSound() {
  blip(660, 0.07, 0.12, 'square');
}

export function landFanfare() {
  [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.4, 0.18, 'triangle', i * 0.12));
}

export function crashSound() {
  noiseBurst(0.7, 0.5, 700);
  blip(70, 0.6, 0.3, 'sawtooth');
}

export function stallWarning() {
  blip(440, 0.12, 0.1, 'square');
  blip(440, 0.12, 0.1, 'square', 0.16);
}

export function toggleMute() {
  muted = !muted;
  if (ctx) {
    engineGain.gain.value = 0;
    windGain.gain.value = 0;
  }
  return muted;
}

export function isMuted() {
  return muted;
}
