// The cockpit and the HUD: everything the pilot reads while flying.
// Two jobs live here: the lit instrument panel (drawn when the pilot
// picks the cockpit camera) and the glass HUD that floats over either
// view — altitude, speed and heading always in sight, plus fuel,
// throttle, the mission and the clock. Plus the title, pause, crash and
// results screens, which are just the same canvas wearing a menu.

import { TUNE, MISSIONS, PALETTE } from './config.js';
import { currentMission } from './missions.js';

const AMBER = PALETTE.hudAmber;
const GREEN = PALETTE.hudGreen;
const RED = PALETTE.hudRed;

function chip(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,18,24,0.62)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,200,87,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// --- one round gauge, lit like a real instrument ---
// `draw` is called with the face already clipped to a circle; it paints
// the needle, the ball or the numbers for this gauge.
function gauge(ctx, cx, cy, r, label, draw) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#101a20';
  ctx.fill();
  ctx.clip();
  draw(ctx, cx, cy, r);
  ctx.restore();
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // The little screws and the label under the glass.
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.7, cy - r * 0.7, 1.5, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.7, cy - r * 0.7, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = AMBER;
  ctx.font = `bold ${Math.max(9, r * 0.22)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy + r + 13);
}

function ticks(ctx, cx, cy, r, count, majorEvery) {
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    const major = i % majorEvery === 0;
    const r1 = r - (major ? 8 : 4);
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
    ctx.stroke();
  }
}

// The artificial horizon ball: sky above, ground below, rolling with
// the plane and sliding with the pitch.
function drawHorizonFace(ctx, cx, cy, r, plane) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.roll);
  const shift = plane.pitch * r * 1.4;
  ctx.fillStyle = '#5fa8dd';
  ctx.fillRect(-r, -r + shift - r, r * 2, r * 2);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r, shift, r * 2, r * 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, shift);
  ctx.lineTo(r, shift);
  ctx.stroke();
  ctx.restore();
  // The fixed wings that never move: the pilot reads the ball against them.
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy);
  ctx.lineTo(cx - r * 0.18, cy);
  ctx.moveTo(cx + r * 0.18, cy);
  ctx.lineTo(cx + r * 0.55, cy);
  ctx.stroke();
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
}

function needleGauge(ctx, cx, cy, r, value, max, label, unit) {
  gauge(ctx, cx, cy, r, label, (c, x, y, rr) => {
    ticks(c, x, y, rr, 12, 3);
    const a = -Math.PI * 0.75 + (Math.max(0, Math.min(1, value / max)) * Math.PI * 1.5);
    c.strokeStyle = AMBER;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * (rr - 10), y + Math.sin(a) * (rr - 10));
    c.stroke();
    c.fillStyle = '#fff';
    c.font = `bold ${Math.max(11, rr * 0.3)}px system-ui, sans-serif`;
    c.textAlign = 'center';
    c.fillText(String(Math.round(value)), x, y + rr * 0.45);
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.font = `${Math.max(8, rr * 0.18)}px system-ui, sans-serif`;
    c.fillText(unit, x, y + rr * 0.68);
  });
}

// --- the cockpit camera: dashboard, glareshield, nose and wingtips ---
export function drawCockpit(ctx, W, H, plane, time) {
  // The nose, just visible over the panel.
  ctx.fillStyle = '#3a3f45';
  ctx.beginPath();
  ctx.moveTo(W * 0.42, H);
  ctx.lineTo(W * 0.5, H * 0.70);
  ctx.lineTo(W * 0.58, H);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(W * 0.47, H);
  ctx.lineTo(W * 0.5, H * 0.72);
  ctx.lineTo(W * 0.53, H);
  ctx.closePath();
  ctx.fill();
  // Wingtips peeking in at the edges.
  ctx.fillStyle = PALETTE.planeCream;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.86);
  ctx.lineTo(W * 0.10, H * 0.82);
  ctx.lineTo(W * 0.10, H * 0.88);
  ctx.lineTo(0, H * 0.92);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W, H * 0.86);
  ctx.lineTo(W * 0.90, H * 0.82);
  ctx.lineTo(W * 0.90, H * 0.88);
  ctx.lineTo(W, H * 0.92);
  ctx.closePath();
  ctx.fill();

  // The panel itself: dark leather, lit gauges, a warm glow.
  const panelTop = H * 0.66;
  const g = ctx.createLinearGradient(0, panelTop, 0, H);
  g.addColorStop(0, '#2b2f36');
  g.addColorStop(1, '#171a1e');
  ctx.fillStyle = g;
  ctx.fillRect(0, panelTop, W, H - panelTop);
  ctx.fillStyle = 'rgba(255,200,87,0.12)';
  ctx.fillRect(0, panelTop, W, 3);

  const cy = panelTop + (H - panelTop) * 0.48;
  const r = Math.min(52, (H - panelTop) * 0.36);
  const spread = Math.min(W * 0.15, 190);
  const cx = W / 2;
  // Horizon, airspeed, altimeter across the middle; heading, fuel and
  // throttle flanking them.
  gauge(ctx, cx - spread * 2.2, cy, r * 0.82, 'HDG', (c, x, y, rr) => {
    ticks(c, x, y, rr, 12, 3);
    const hdg = ((plane.heading * 180) / Math.PI % 360 + 360) % 360;
    c.save();
    c.translate(x, y);
    c.rotate((hdg * Math.PI) / 180);
    c.fillStyle = '#fff';
    c.font = `bold ${Math.max(10, rr * 0.28)}px system-ui, sans-serif`;
    c.textAlign = 'center';
    c.fillText('N', 0, -rr + 16);
    c.fillText('E', rr - 14, 4);
    c.fillText('S', 0, rr - 8);
    c.fillText('W', -rr + 14, 4);
    c.restore();
    c.fillStyle = AMBER;
    c.beginPath();
    c.moveTo(x - 5, y - rr + 2);
    c.lineTo(x + 5, y - rr + 2);
    c.lineTo(x, y - rr + 12);
    c.closePath();
    c.fill();
    c.fillStyle = '#fff';
    c.font = `bold ${Math.max(11, rr * 0.3)}px system-ui, sans-serif`;
    c.textAlign = 'center';
    c.fillText(String(Math.round(hdg)).padStart(3, '0'), x, y + rr * 0.45);
  });
  gauge(ctx, cx - spread * 1.1, cy, r * 0.82, 'AIRSPEED', (c, x, y, rr) => {
    ticks(c, x, y, rr, 12, 3);
    const a = -Math.PI * 0.75 + (Math.min(1, plane.speed / 180) * Math.PI * 1.5);
    c.strokeStyle = plane.speed < TUNE.stallSpeed && plane.airborne ? RED : AMBER;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * (rr - 10), y + Math.sin(a) * (rr - 10));
    c.stroke();
    c.fillStyle = '#fff';
    c.font = `bold ${Math.max(11, rr * 0.3)}px system-ui, sans-serif`;
    c.textAlign = 'center';
    c.fillText(String(Math.round(plane.speed)), x, y + rr * 0.45);
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.font = `${Math.max(8, rr * 0.18)}px system-ui, sans-serif`;
    c.fillText('KT', x, y + rr * 0.68);
  });
  gauge(ctx, cx, cy, r, 'ATTITUDE', (c, x, y, rr) => drawHorizonFace(c, x, y, rr, plane));
  needleGauge(ctx, cx + spread * 1.1, cy, r * 0.82, plane.y * 3.28, 12000, 'ALTITUDE', 'FT');
  gauge(ctx, cx + spread * 2.2, cy, r * 0.82, 'FUEL', (c, x, y, rr) => {
    ticks(c, x, y, rr, 8, 2);
    const a = -Math.PI * 0.75 + (Math.max(0, plane.fuel / 100) * Math.PI * 1.5);
    c.strokeStyle = plane.fuel < 20 ? RED : GREEN;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * (rr - 10), y + Math.sin(a) * (rr - 10));
    c.stroke();
    c.fillStyle = '#fff';
    c.font = `bold ${Math.max(11, rr * 0.3)}px system-ui, sans-serif`;
    c.textAlign = 'center';
    c.fillText(String(Math.round(plane.fuel)) + '%', x, y + rr * 0.45);
  });
  // Throttle lever, far right, with its quadrant markings.
  const lx = W - 70;
  const ly0 = panelTop + 16;
  const ly1 = H - 26;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(lx, ly0);
  ctx.lineTo(lx, ly1);
  ctx.stroke();
  const ty = ly1 - plane.throttle * (ly1 - ly0);
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.arc(lx, ty, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THR', lx, ly0 - 6);
}

// --- the HUD, over either view ---
export function drawHUD(ctx, W, H, plane, sortie, time, camMode) {
  const altFt = Math.round(plane.y * 3.28);
  const hdg = Math.round(((plane.heading * 180) / Math.PI % 360 + 360) % 360);
  const vsFpm = Math.round(plane.vspeed * 196.85);

  // The three numbers that matter, big and amber, with the vertical
  // speed tucked inside the chip instead of hanging off its edge.
  chip(ctx, 14, 14, 218, 108);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('ALT', 26, 34);
  ctx.fillText('SPD', 26, 60);
  ctx.fillText('HDG', 26, 86);
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 22px system-ui, monospace';
  ctx.fillText(`${altFt.toLocaleString()} ft`, 78, 37);
  ctx.fillText(`${Math.round(plane.speed)} kt`, 78, 63);
  ctx.fillText(`${String(hdg).padStart(3, '0')}°`, 78, 89);
  // Vertical speed, small, on the chip's own bottom line.
  ctx.fillStyle = vsFpm >= 0 ? GREEN : RED;
  ctx.font = 'bold 13px system-ui, monospace';
  ctx.fillText(`${vsFpm >= 0 ? '+' : ''}${vsFpm} fpm`, 78, 110);

  // Compass tape across the top: ticks, cardinals, a caret at the nose.
  const tapeY = 34;
  const tapeW = Math.min(420, W * 0.4);
  const tapeX = (W - tapeW) / 2;
  chip(ctx, tapeX - 8, 10, tapeW + 16, 44);
  ctx.save();
  ctx.beginPath();
  ctx.rect(tapeX, 10, tapeW, 44);
  ctx.clip();
  const pxPerDeg = tapeW / 90;
  // Walk the absolute degree marks, not the offset grid: labels must
  // land on the cardinals whatever the heading is, not only when the
  // heading happens to be a multiple of five.
  const firstMark = Math.floor((hdg - 45) / 5) * 5;
  for (let deg = firstMark; deg <= hdg + 45; deg += 5) {
    const norm = ((deg % 360) + 360) % 360;
    const d = ((norm - hdg + 540) % 360) - 180;
    const x = tapeX + tapeW / 2 + d * pxPerDeg;
    const major = norm % 30 === 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, major ? 18 : 24);
    ctx.lineTo(x, 34);
    ctx.stroke();
    if (major) {
      const names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(names[norm] ?? String(norm), x, 48);
    }
  }
  ctx.restore();
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 7, 12);
  ctx.lineTo(W / 2 + 7, 12);
  ctx.lineTo(W / 2, 24);
  ctx.closePath();
  ctx.fill();

  // Top-right: mission, progress, clock and score.
  const mission = currentMission(sortie);
  const mw = 268;
  chip(ctx, W - mw - 14, 14, mw, 86);
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(mission.name.toUpperCase(), W - mw + 2, 34);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(mission.goal, W - mw + 2, 54);
  let progress = '';
  if (sortie.missionIndex === 0) progress = `Rings ${sortie.ringsDone}/6`;
  else if (sortie.missionIndex === 1) progress = `Parcels ${sortie.dropsDone}/3 · ${sortie.parcelsLeft} left`;
  else if (sortie.missionIndex === 2) progress = 'Final: land on the strip';
  else progress = 'Sortie complete';
  ctx.fillStyle = GREEN;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(progress, W - mw + 2, 74);
  const mm = Math.floor(sortie.time / 60);
  const ss = Math.floor(sortie.time % 60).toString().padStart(2, '0');
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px system-ui, monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${mm}:${ss}`, W - 26, 34);
  ctx.fillText(`★ ${sortie.score}`, W - 26, 74);
  ctx.textAlign = 'left';

  // Bottom-right: throttle and fuel bars.
  const bx = W - 214;
  const by = H - 64;
  chip(ctx, bx, by, 200, 50);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('THR', bx + 12, by + 20);
  ctx.fillText('FUEL', bx + 12, by + 40);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(bx + 56, by + 9, 132, 10);
  ctx.fillRect(bx + 56, by + 29, 132, 10);
  ctx.fillStyle = AMBER;
  ctx.fillRect(bx + 56, by + 9, 132 * plane.throttle, 10);
  ctx.fillStyle = plane.fuel < 20 ? RED : GREEN;
  ctx.fillRect(bx + 56, by + 29, 132 * (plane.fuel / 100), 10);

  // Bottom-left: a small horizon ball, so the pilot never loses the sky.
  if (camMode !== 'cockpit') {
    const hx = 74;
    const hy = H - 74;
    gauge(ctx, hx, hy, 46, 'ATTITUDE', (c, x, y, rr) => drawHorizonFace(c, x, y, rr, plane));
  }

  // The flight-path marker: a little circle where the nose is pointing.
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(W / 2, H * 0.44, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W / 2 - 16, H * 0.44);
  ctx.lineTo(W / 2 - 10, H * 0.44);
  ctx.moveTo(W / 2 + 10, H * 0.44);
  ctx.lineTo(W / 2 + 16, H * 0.44);
  ctx.moveTo(W / 2, H * 0.44 - 16);
  ctx.lineTo(W / 2, H * 0.44 - 10);
  ctx.stroke();

  // Stall warning: flashing, because a stall near the ground is the one
  // mistake this valley does not forgive.
  if (plane.airborne && plane.speed < TUNE.stallSpeed + 8) {
    const on = Math.sin(time * 10) > 0;
    if (on) {
      ctx.fillStyle = RED;
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ STALL — NOSE DOWN, POWER UP', W / 2, H * 0.30);
      ctx.textAlign = 'left';
    }
  }

  // The message line: what just happened, or what to do next.
  if (sortie.message && time < sortie.messageUntil) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sortie.message, W / 2, H * 0.16);
    ctx.textAlign = 'left';
  }

  // Controls reminder, faint, bottom centre — there until the pilot knows.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Arrows / WASD fly · Shift throttle up · Ctrl throttle down · Space drop · C camera · P pause · M mute', W / 2, H - 10);
  ctx.textAlign = 'left';
}

// --- screens ---
function dim(ctx, W, H, alpha = 0.55) {
  ctx.fillStyle = `rgba(8,14,20,${alpha})`;
  ctx.fillRect(0, 0, W, H);
}

function panel(ctx, W, H, pw, ph) {
  const x = (W - pw) / 2;
  const y = (H - ph) / 2;
  ctx.fillStyle = 'rgba(10,20,26,0.88)';
  ctx.beginPath();
  ctx.roundRect(x, y, pw, ph, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,200,87,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  return { x, y };
}

export function drawTitle(ctx, W, H, time) {
  dim(ctx, W, H, 0.42);
  const { x, y } = panel(ctx, W, H, 620, 430);
  ctx.textAlign = 'center';
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('KESTREL MAIL RUN', W / 2, y + 62);
  ctx.fillStyle = '#fff';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('One little bush plane. One valley. Three jobs before dark.', W / 2, y + 94);
  ctx.fillStyle = GREEN;
  ctx.font = 'bold 16px system-ui, sans-serif';
  const jobs = [
    '1 · Thread 6 sky rings over the lake',
    '2 · Drop the mail on 3 farms',
    '3 · Bring her home onto the Aldermere strip',
  ];
  jobs.forEach((job, i) => ctx.fillText(job, W / 2, y + 138 + i * 26));
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '14px system-ui, sans-serif';
  const controls = [
    'Arrows or WASD — pitch and bank  ·  Shift / Ctrl — throttle',
    'Space — drop a parcel  ·  C — chase / cockpit camera',
    'P — pause  ·  M — mute  ·  R — fly again',
  ];
  controls.forEach((line, i) => ctx.fillText(line, W / 2, y + 240 + i * 22));
  const pulse = 0.65 + 0.35 * Math.sin(time * 3);
  ctx.fillStyle = `rgba(255,200,87,${pulse})`;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('Press ENTER or click to fly', W / 2, y + 340);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('Watch your speed — below 52 knots the wing stops flying. Mind the fuel.', W / 2, y + 372);
  ctx.fillText('Aldermere Valley · a wholly invented place, flown by the Kestrel K-7', W / 2, y + 396);
  ctx.textAlign = 'left';
}

export function drawPaused(ctx, W, H) {
  dim(ctx, W, H, 0.5);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText('Paused', W / 2, H / 2 - 10);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Press P to keep flying', W / 2, H / 2 + 26);
  ctx.textAlign = 'left';
}

export function drawResults(ctx, W, H, plane, sortie, resultText, medal) {
  dim(ctx, W, H, 0.55);
  const { x, y } = panel(ctx, W, H, 620, 420);
  ctx.textAlign = 'center';
  ctx.fillStyle = sortie.result === 'landed' ? GREEN : RED;
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(sortie.result === 'landed' ? 'Sortie complete!' : 'Flight over', W / 2, y + 56);
  if (medal) {
    ctx.fillStyle = AMBER;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('★ ' + medal + ' ★', W / 2, y + 90);
  }
  ctx.fillStyle = '#fff';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(resultText, W / 2, y + 122);
  const mm = Math.floor(sortie.time / 60);
  const ss = Math.floor(sortie.time % 60).toString().padStart(2, '0');
  const rows = [
    ['Rings flown', `${sortie.ringsDone} / 6`],
    ['Parcels delivered', `${sortie.dropsDone} / 3`],
    ['Time', `${mm}:${ss}`],
    ['Top speed', `${Math.round(plane.topSpeed)} kt`],
    ['Highest', `${Math.round(plane.maxAlt * 3.28).toLocaleString()} ft`],
    ['Fuel left', `${Math.round(plane.fuel)}%`],
    ['Score', `${sortie.score}`],
  ];
  ctx.font = '16px system-ui, sans-serif';
  rows.forEach(([label, value], i) => {
    const ry = y + 158 + i * 26;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'right';
    ctx.fillText(label, W / 2 - 12, ry);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(value, W / 2 + 12, ry);
  });
  const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 300);
  ctx.fillStyle = `rgba(255,200,87,${pulse})`;
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Press R to fly again', W / 2, y + 372);
  ctx.textAlign = 'left';
}
