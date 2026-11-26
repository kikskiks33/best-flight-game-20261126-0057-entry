# Kestrel Mail Run

A complete original flight game: fly the little bush plane **Kestrel K-7**
over the invented Aldermere Valley — thread 6 sky rings, drop the mail on
3 farms, then bring her home onto the grass strip before dark.

## Play

Open `game/index.html` in a desktop browser (or `node serve.ts` and visit
http://localhost:8080). No network, no build step, no files outside `game/`.

- **Arrows / WASD** — pitch and bank (mouse drag steers too)
- **Shift / Ctrl** — throttle up / down (or keys 0–9)
- **Space** — drop a parcel over a marked field
- **C** — chase / cockpit camera
- **P** — pause · **M** — mute · **R** — fly again

## The sortie

1. **Ring Run** — thread all 6 glowing rings in order over the lake.
2. **Mail Drop** — drop a parcel on each of the 3 marked fields (slow, low).
3. **Home Run** — land on the Aldermere strip: slow, lined up, gentle.

Fuel, speed and the stall limit (52 knots) all matter; the ground, the
river and the mountains are all exactly as high as they look. Score,
timer, medals, and a results screen at the end of every flight.

## How it is built

Plain HTML + canvas 2D with a small software 3D renderer — no libraries,
no WebGL, no network. The valley is a seeded heightmap (the same ground
the flight model trusts), the town, pines, river and lake are generated
from the same seed, and all sound is synthesized live with WebAudio.

- `game/src/config.js` — tuning, missions, rings, palette
- `game/src/random.js` — seeded RNG and value noise
- `game/src/terrain.js` — the valley: height, river, trees, town, clouds
- `game/src/plane.js` — the flight model
- `game/src/missions.js` — rings, drops, landings, scoring
- `game/src/render.js` — software 3D: sky, terrain, plane, rings
- `game/src/hud.js` — lit instruments, HUD, title and results screens
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesized engine, wind and chimes
- `game/src/shots.js` — the four frozen screenshot poses
- `game/src/main.js` — the game loop and states

Screenshots under `screenshots/` are real renders of the game's own code,
taken in desktop Chrome via `?shot=1..4`.

## Entry

Built for the make.fun bounty **best-flight-game-20261126-0057**
("Make the best flight game", $500, top 50 share). `main.ts` hands the
game in; `vendor/makefun-game.ts` is the kit's copy, unchanged. MIT license.
