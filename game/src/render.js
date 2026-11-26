// The renderer: a small software 3D engine on a plain 2D canvas. No
// library, no WebGL — the valley is drawn one projected quad at a time,
// far to near, so a desktop browser with no network can run it anywhere.
//
// The camera chases the Kestrel from behind and above; the world is
// projected with a pinhole camera, and everything the pilot sees — hills,
// river, town, runway, rings — is the same groundHeight() the flight
// model trusts, so the picture and the physics can never disagree.

import { TUNE, PALETTE, RINGS, DROP_ZONES } from './config.js';
import {
  groundHeight, isWater, riverX, TREES, HOUSES, CLOUDS, LAKE,
} from './terrain.js';

// --- little colour helpers: everything is an [r, g, b] array here, so
// a colour can be mixed with another as often as needed without ever
// turning back into a string halfway through (a string fed back into
// the mixer once painted the whole valley the wrong colour). ---
function parseColor(c) {
  if (c[0] === '#') {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = c.match(/(\d+)[, ]+(\d+)[, ]+(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : [0, 0, 0];
}
function mix(a, b, t) {
  const ca = typeof a === 'string' ? parseColor(a) : a;
  const cb = typeof b === 'string' ? parseColor(b) : b;
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return [r, g, bl];
}
function css(rgb) {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}
function hash01(x, z) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

// --- the camera ---
// Builds the basis from the plane: forward from its heading and pitch,
// right and up from the world, then rolls the frame a little with the
// plane so the horizon tilts the way a pilot expects.
export function makeCamera(plane, time) {
  const fwd = {
    x: Math.sin(plane.heading) * Math.cos(plane.pitch),
    y: Math.sin(plane.pitch),
    z: Math.cos(plane.heading) * Math.cos(plane.pitch),
  };
  const back = TUNE.camBack;
  const pos = {
    x: plane.x - fwd.x * back,
    y: Math.max(plane.y + TUNE.camUp - fwd.y * back, groundHeight(plane.x, plane.z) + 3),
    z: plane.z - fwd.z * back,
  };
  const look = {
    x: plane.x + fwd.x * TUNE.camLookAhead,
    y: plane.y + fwd.y * TUNE.camLookAhead,
    z: plane.z + fwd.z * TUNE.camLookAhead,
  };
  let f = norm({
    x: look.x - pos.x,
    y: look.y - pos.y,
    z: look.z - pos.z,
  });
  // Right = forward x world-up, then up = right x forward.
  let r = norm(cross(f, { x: 0, y: 1, z: 0 }));
  let u = cross(r, f);
  // Roll the camera with the plane, but only half as much — a full roll
  // would be honest and unreadable in equal measure.
  const roll = plane.roll * 0.55;
  const cos = Math.cos(roll);
  const sin = Math.sin(roll);
  const r2 = {
    x: r.x * cos + u.x * sin,
    y: r.y * cos + u.y * sin,
    z: r.z * cos + u.z * sin,
  };
  const u2 = {
    x: u.x * cos - r.x * sin,
    y: u.y * cos - r.y * sin,
    z: u.z * cos - r.z * sin,
  };
  return { pos, f, r: r2, u: u2, time };
}

function norm(v) {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}
function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

// Project a world point to screen space. Returns null when it is behind
// the camera or too close to trust.
export function project(cam, p, W, H, focal) {
  const d = { x: p.x - cam.pos.x, y: p.y - cam.pos.y, z: p.z - cam.pos.z };
  const cz = dot(d, cam.f);
  if (cz < 2) return null;
  const cx = dot(d, cam.r);
  const cy = dot(d, cam.u);
  return {
    x: W / 2 + (cx / cz) * focal,
    y: H / 2 - (cy / cz) * focal,
    depth: cz,
  };
}

// --- sky ---
export function drawSky(ctx, W, H, cam, plane) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(0.55, PALETTE.skyMid);
  g.addColorStop(0.8, PALETTE.skyLow);
  g.addColorStop(1, PALETTE.skyLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // The sun sits low in the west, where the light comes from.
  const sunDir = norm({ x: -0.8, y: 0.42, z: -0.45 });
  const s = project(cam, {
    x: cam.pos.x + sunDir.x * 900,
    y: cam.pos.y + sunDir.y * 900,
    z: cam.pos.z + sunDir.z * 900,
  }, W, H, (H / 2) / Math.tan(0.61));
  if (s) {
    const glow = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, 130);
    glow.addColorStop(0, 'rgba(255,243,196,0.95)');
    glow.addColorStop(0.25, 'rgba(255,226,150,0.55)');
    glow.addColorStop(1, 'rgba(255,226,150,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(s.x - 140, s.y - 140, 280, 280);
    ctx.fillStyle = PALETTE.sun;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  // Clouds: soft white billboards, drifting slowly downwind.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const c of CLOUDS) {
    const cx = c.x + cam.time * c.drift;
    const p = project(cam, { x: cx, y: c.y, z: c.z }, W, H, (H / 2) / Math.tan(0.61));
    if (!p || p.depth > 2400) continue;
    const w = (c.s / p.depth) * ((H / 2) / Math.tan(0.61)) * 2;
    if (w < 8) continue;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, w * 0.55, w * 0.16, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x - w * 0.3, p.y + w * 0.05, w * 0.32, w * 0.11, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x + w * 0.32, p.y + w * 0.04, w * 0.3, w * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- terrain ---
// A grid of quads laid out ahead of the camera, far rows first. Each
// quad's colour comes from its height and what is on it: water in the
// river and lake, sand on the banks, rock and snow on the high ground,
// and two greens everywhere else, varied per cell so the fields read.
export function drawTerrain(ctx, W, H, cam, focal) {
  const rows = [26, 44, 66, 92, 122, 158, 200, 250, 310, 380, 460, 550, 660, 790, 930];
  const cols = [-560, -420, -300, -200, -120, -60, -25, 0, 25, 60, 120, 200, 300, 420, 560];
  for (let ri = rows.length - 1; ri >= 0; ri--) {
    const d0 = rows[ri];
    const d1 = ri + 1 < rows.length ? rows[ri + 1] : rows[ri] + 160;
    for (let ci = 0; ci < cols.length - 1; ci++) {
      const l0 = cols[ci];
      const l1 = cols[ci + 1];
      const corners = [];
      let ok = true;
      for (const [d, l] of [[d0, l0], [d0, l1], [d1, l1], [d1, l0]]) {
        const wx = cam.pos.x + cam.f.x * d + cam.r.x * l;
        const wz = cam.pos.z + cam.f.z * d + cam.r.z * l;
        const wy = groundHeight(wx, wz);
        const p = project(cam, { x: wx, y: wy, z: wz }, W, H, focal);
        if (!p) {
          ok = false;
          break;
        }
        corners.push(p);
      }
      if (!ok) continue;
      // Colour from the middle of the quad.
      const mx = cam.pos.x + cam.f.x * ((d0 + d1) / 2) + cam.r.x * ((l0 + l1) / 2);
      const mz = cam.pos.z + cam.f.z * ((d0 + d1) / 2) + cam.r.z * ((l0 + l1) / 2);
      const mh = groundHeight(mx, mz);
      const midDepth = (d0 + d1) / 2;
      let col;
      if (isWater(mx, mz)) {
        col = mix(PALETTE.waterDeep, PALETTE.water, 0.4 + 0.3 * Math.sin(cam.time * 0.8 + mx * 0.05));
      } else if (mh > 185) {
        col = PALETTE.snow;
      } else if (mh > 118) {
        col = mix(PALETTE.rock, PALETTE.snow, (mh - 118) / 70);
      } else if (Math.abs(mx - riverX(mz)) < 42 && mh < 9) {
        col = PALETTE.sand;
      } else {
        const v = hash01(Math.floor(mx / 40), Math.floor(mz / 40));
        col = mix(PALETTE.grassLow, PALETTE.grassHigh, v * 0.7 + Math.min(0.5, mh / 160));
        if (v > 0.82) col = mix(col, PALETTE.meadow, 0.5); // a lighter meadow patch
      }
      // Distance haze: far ground melts into the afternoon light.
      const haze = Math.min(0.55, midDepth / 1600);
      col = mix(col, PALETTE.skyLow, haze);
      ctx.fillStyle = css(col);
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// --- runway ---
export function drawRunway(ctx, W, H, cam, focal) {
  const r = TUNE.runway;
  const strip = [];
  for (let z = r.z0; z <= r.z1; z += 40) {
    const left = project(cam, { x: r.x - r.halfWidth, y: 2.6, z }, W, H, focal);
    const right = project(cam, { x: r.x + r.halfWidth, y: 2.6, z }, W, H, focal);
    if (left && right) strip.push([left, right]);
  }
  if (strip.length < 2) return;
  ctx.fillStyle = PALETTE.runway;
  ctx.beginPath();
  ctx.moveTo(strip[0][0].x, strip[0][0].y);
  for (const [l] of strip) ctx.lineTo(l.x, l.y);
  for (let i = strip.length - 1; i >= 0; i--) ctx.lineTo(strip[i][1].x, strip[i][1].y);
  ctx.closePath();
  ctx.fill();
  // Centreline dashes and the threshold bars at each end.
  ctx.fillStyle = PALETTE.runwayMark;
  for (let z = r.z0 + 20; z < r.z1; z += 60) {
    const a = project(cam, { x: -1.5, y: 2.7, z }, W, H, focal);
    const b = project(cam, { x: 1.5, y: 2.7, z: z + 22 }, W, H, focal);
    if (!a || !b) continue;
    const w = Math.max(1, Math.abs(b.x - a.x));
    ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), w, Math.max(1.5, Math.abs(b.y - a.y)));
  }
  // The windsock: an orange cone on a pole, pointing downwind.
  const sockBase = project(cam, { x: 34, y: 2.6, z: 60 }, W, H, focal);
  const sockTop = project(cam, { x: 34, y: 12, z: 60 }, W, H, focal);
  const sockTip = project(cam, { x: 34 + 9, y: 11, z: 60 }, W, H, focal);
  if (sockBase && sockTop && sockTip) {
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = Math.max(1, 3 - sockBase.depth / 300);
    ctx.beginPath();
    ctx.moveTo(sockBase.x, sockBase.y);
    ctx.lineTo(sockTop.x, sockTop.y);
    ctx.stroke();
    ctx.fillStyle = '#ff7a2e';
    ctx.beginPath();
    ctx.moveTo(sockTop.x, sockTop.y);
    ctx.lineTo(sockTip.x, sockTip.y);
    ctx.lineTo(sockTop.x, sockTop.y + 4);
    ctx.closePath();
    ctx.fill();
  }
}

// --- trees and houses, far to near so near ones overlap far ones ---
export function drawVegetation(ctx, W, H, cam, focal) {
  const items = [];
  for (const t of TREES) {
    const dx = t.x - cam.pos.x;
    const dz = t.z - cam.pos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > 700 * 700) continue;
    items.push({ kind: 0, d: d2, t });
  }
  for (const h of HOUSES) {
    const dx = h.x - cam.pos.x;
    const dz = h.z - cam.pos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > 900 * 900) continue;
    items.push({ kind: 1, d: d2, h });
  }
  items.sort((a, b) => b.d - a.d);
  for (const item of items.slice(0, 260)) {
    if (item.kind === 0) {
      const t = item.t;
      const base = project(cam, { x: t.x, y: t.h, z: t.z }, W, H, focal);
      const top = project(cam, { x: t.x + t.lean * 10, y: t.h + 15 * t.s, z: t.z }, W, H, focal);
      if (!base || !top) continue;
      const w = Math.max(1.5, Math.abs(base.y - top.y) * 0.42);
      ctx.fillStyle = PALETTE.pineDark;
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(base.x - w, base.y);
      ctx.lineTo(base.x + w, base.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PALETTE.pine;
      ctx.beginPath();
      ctx.moveTo(top.x, top.y + (base.y - top.y) * 0.25);
      ctx.lineTo(base.x - w * 0.7, base.y - (base.y - top.y) * 0.28);
      ctx.lineTo(base.x + w * 0.7, base.y - (base.y - top.y) * 0.28);
      ctx.closePath();
      ctx.fill();
    } else {
      const h = item.h;
      const c = project(cam, { x: h.x, y: h.h, z: h.z }, W, H, focal);
      const top = project(cam, { x: h.x, y: h.h + h.tall, z: h.z }, W, H, focal);
      if (!c || !top) continue;
      const w = Math.max(2, Math.abs(c.y - top.y) * 0.9);
      ctx.fillStyle = h.roof === 0 ? PALETTE.wallA : PALETTE.wallB;
      ctx.fillRect(c.x - w / 2, top.y, w, c.y - top.y);
      ctx.fillStyle = h.roof === 0 ? PALETTE.roofA : PALETTE.roofB;
      ctx.beginPath();
      ctx.moveTo(c.x - w / 2 - 2, top.y);
      ctx.lineTo(c.x, top.y - w * 0.35);
      ctx.lineTo(c.x + w / 2 + 2, top.y);
      ctx.closePath();
      ctx.fill();
      if (h.lit && w > 4) {
        ctx.fillStyle = '#ffd977';
        ctx.fillRect(c.x - w * 0.22, top.y + (c.y - top.y) * 0.4, 2, 2);
      }
    }
  }
}

// --- rings and drop zones ---
export function drawRings(ctx, W, H, cam, focal, sortie, now) {
  RINGS.forEach((ring, i) => {
    const done = i < sortie.ringIndex;
    const isNext = sortie.missionIndex === 0 && i === sortie.ringIndex;
    if (!isNext && done && now > sortie.ringFlashUntil) return; // spent rings fade away
    const to = { x: ring.x - cam.pos.x, y: ring.y - cam.pos.y, z: ring.z - cam.pos.z };
    if (dot(to, cam.f) < 10) return;
    // The ring faces the pilot's approach: its plane is square to the
    // line from the previous ring, so it reads as a gate, not a hoop.
    const prev = i === 0 ? { x: 0, y: 60, z: -180 } : RINGS[i - 1];
    const n = norm({ x: ring.x - prev.x, y: ring.y - prev.y, z: ring.z - prev.z });
    const side = norm(cross(n, { x: 0, y: 1, z: 0 }));
    const upv = cross(side, n);
    const pts = [];
    let ok = true;
    for (let s = 0; s <= 26; s++) {
      const a = (s / 26) * Math.PI * 2;
      const px = ring.x + (side.x * Math.cos(a) + upv.x * Math.sin(a)) * TUNE.ringRadius;
      const py = ring.y + (side.y * Math.cos(a) + upv.y * Math.sin(a)) * TUNE.ringRadius;
      const pz = ring.z + (side.z * Math.cos(a) + upv.z * Math.sin(a)) * TUNE.ringRadius;
      const p = project(cam, { x: px, y: py, z: pz }, W, H, focal);
      if (!p) {
        ok = false;
        break;
      }
      pts.push(p);
    }
    if (!ok || pts.length < 4) return;
    const flashing = done && now < sortie.ringFlashUntil;
    ctx.save();
    ctx.strokeStyle = flashing || done ? PALETTE.ringDone : PALETTE.ring;
    ctx.lineWidth = isNext ? 6 : 4;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = isNext ? 16 : 6;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    if (isNext) {
      // The number floats over the next gate so the pilot never wonders.
      const top = project(cam, { x: ring.x, y: ring.y + TUNE.ringRadius + 12, z: ring.z }, W, H, focal);
      if (top) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), top.x, top.y);
      }
    }
  });
}

export function drawDropZones(ctx, W, H, cam, focal, sortie) {
  if (sortie.missionIndex > 1) return;
  DROP_ZONES.forEach((zone, i) => {
    const done = sortie.parcelsLanded.some((pl) => pl.farm === zone.farm && pl.hit);
    const to = { x: zone.x - cam.pos.x, y: 0, z: zone.z - cam.pos.z };
    if (dot(to, cam.f) < 10) return;
    const pts = [];
    for (let s = 0; s <= 20; s++) {
      const a = (s / 20) * Math.PI * 2;
      const px = zone.x + Math.cos(a) * TUNE.dropRadius;
      const pz = zone.z + Math.sin(a) * TUNE.dropRadius;
      const p = project(cam, { x: px, y: groundHeight(px, pz) + 1, z: pz }, W, H, focal);
      if (p) pts.push(p);
    }
    if (pts.length < 4) return;
    ctx.save();
    ctx.fillStyle = done ? 'rgba(88,214,141,0.35)' : 'rgba(255,200,87,0.35)';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = done ? PALETTE.ringDone : PALETTE.hudAmber;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.restore();
    // A lazy column of smoke marks the field from far away.
    const smoke = project(cam, { x: zone.x, y: groundHeight(zone.x, zone.z) + 40, z: zone.z }, W, H, focal);
    if (smoke && !done) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(smoke.x, smoke.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    if (sortie.missionIndex === 1 && !done) {
      const label = project(cam, { x: zone.x, y: groundHeight(zone.x, zone.z) + 26, z: zone.z }, W, H, focal);
      if (label) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(zone.farm, label.x, label.y);
      }
    }
  });
}

// Parcels, falling and landed.
export function drawParcels(ctx, W, H, cam, focal, sortie) {
  for (const parcel of sortie.parcels) {
    const p = project(cam, parcel, W, H, focal);
    if (!p) continue;
    const s = Math.max(3, 260 / p.depth);
    ctx.fillStyle = '#a8763e';
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x - s / 2, p.y - s / 2, s, s);
  }
  for (const pl of sortie.parcelsLanded) {
    const p = project(cam, { x: pl.x, y: groundHeight(pl.x, pl.z) + 1.5, z: pl.z }, W, H, focal);
    if (!p) continue;
    ctx.fillStyle = pl.hit ? '#58d68d' : '#a8763e';
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
  }
}

// The Kestrel's shadow on the ground below: the pilot's best clue for
// how high they really are when the numbers blur.
export function drawShadow(ctx, W, H, cam, focal, plane) {
  const g = groundHeight(plane.x, plane.z);
  const p = project(cam, { x: plane.x, y: g + 1, z: plane.z }, W, H, focal);
  if (!p) return;
  const alt = Math.max(0, plane.y - g);
  const size = Math.max(4, 900 / (alt + 30));
  ctx.fillStyle = `rgba(20,30,20,${Math.max(0.05, 0.35 - alt / 900)})`;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, size, size * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
}

// --- the Kestrel, chase view ---
// Drawn as a vector sprite, banked with the plane, sitting low-centre
// where a chase camera would hold it. Red fuselage, cream wings, a
// spinning prop disc at the nose and the little "K-7" on the tail.
export function drawPlaneSprite(ctx, W, H, plane, time) {
  const cx = W / 2;
  const cy = H * 0.60;
  const size = Math.min(W, H) * 0.30;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.roll * 0.85);
  ctx.scale(1, 1 + plane.pitch * 0.25);

  // Nose and fuselage, blunt at the nose and broad at the shoulders:
  // seen from behind and above, a bush plane is a short, wide shape,
  // not a dart.
  ctx.fillStyle = PALETTE.planeRed;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.36);
  ctx.quadraticCurveTo(size * 0.11, -size * 0.30, size * 0.11, -size * 0.08);
  ctx.quadraticCurveTo(size * 0.10, size * 0.16, size * 0.07, size * 0.30);
  ctx.quadraticCurveTo(size * 0.04, size * 0.38, 0, size * 0.38);
  ctx.quadraticCurveTo(-size * 0.04, size * 0.38, -size * 0.07, size * 0.30);
  ctx.quadraticCurveTo(-size * 0.10, size * 0.16, -size * 0.11, -size * 0.08);
  ctx.quadraticCurveTo(-size * 0.11, -size * 0.30, 0, -size * 0.36);
  ctx.fill();
  // Cream stripe down the spine.
  ctx.fillStyle = PALETTE.planeCream;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.33);
  ctx.quadraticCurveTo(size * 0.045, -size * 0.12, size * 0.04, size * 0.18);
  ctx.quadraticCurveTo(size * 0.03, size * 0.30, 0, size * 0.32);
  ctx.quadraticCurveTo(-size * 0.03, size * 0.30, -size * 0.04, size * 0.18);
  ctx.quadraticCurveTo(-size * 0.045, -size * 0.12, 0, -size * 0.33);
  ctx.fill();
  // Main wings, cream with red tips, set low on the body where a
  // high-wing's shadow falls.
  ctx.fillStyle = PALETTE.planeCream;
  ctx.beginPath();
  ctx.moveTo(-size * 0.56, size * 0.06);
  ctx.quadraticCurveTo(-size * 0.32, -size * 0.02, -size * 0.08, size * 0.02);
  ctx.lineTo(-size * 0.08, size * 0.13);
  ctx.quadraticCurveTo(-size * 0.32, size * 0.16, -size * 0.56, size * 0.14);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(size * 0.56, size * 0.06);
  ctx.quadraticCurveTo(size * 0.32, -size * 0.02, size * 0.08, size * 0.02);
  ctx.lineTo(size * 0.08, size * 0.13);
  ctx.quadraticCurveTo(size * 0.32, size * 0.16, size * 0.56, size * 0.14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.planeRed;
  ctx.fillRect(-size * 0.56, size * 0.05, size * 0.07, size * 0.09);
  ctx.fillRect(size * 0.49, size * 0.05, size * 0.07, size * 0.09);
  // Tailplane and fin, broad enough to see from behind.
  ctx.fillStyle = PALETTE.planeRed;
  ctx.beginPath();
  ctx.moveTo(-size * 0.22, size * 0.32);
  ctx.lineTo(size * 0.22, size * 0.32);
  ctx.lineTo(size * 0.16, size * 0.40);
  ctx.lineTo(-size * 0.16, size * 0.40);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, size * 0.22);
  ctx.lineTo(size * 0.06, size * 0.42);
  ctx.lineTo(-size * 0.06, size * 0.42);
  ctx.closePath();
  ctx.fill();
  // Prop blur, over the nose: a pale disc, spinning too fast to see
  // blades. It goes on last so the fuselage never swallows it.
  ctx.fillStyle = 'rgba(225,230,235,0.30)';
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.34, size * 0.085, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  // Nav lights: red port, green starboard, winking gently.
  const blink = 0.6 + 0.4 * Math.sin(time * 4);
  ctx.fillStyle = `rgba(255,60,50,${blink})`;
  ctx.beginPath();
  ctx.arc(-size * 0.56, size * 0.10, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(80,255,140,${blink})`;
  ctx.beginPath();
  ctx.arc(size * 0.56, size * 0.10, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // The registration, small and proud, under the tail.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `bold ${Math.max(11, size * 0.07)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('K-7', cx, cy + size * 0.48);
}
