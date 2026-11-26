// Input: keyboard, mouse and the buttons on the title screen, all read
// through one little state object so the flight model never touches the
// DOM. Keys are tracked by `code` (KeyW, ArrowUp...) so layouts do not
// matter, and every press the game cares about also wakes the audio.

export function makeInput(canvas) {
  const keys = new Set();
  const input = {
    keys,
    // -1..1 stick deflection, recomputed every frame from the keys.
    pitch: 0,
    roll: 0,
    // Mouse steering: hold the left button and drag, or just move the
    // mouse — the plane banks gently toward where the pointer sits.
    mouseX: 0.5,
    mouseY: 0.5,
    mouseSteer: false,
    // Edge-triggered actions, consumed by the game loop each frame.
    pressed: new Set(),
    // Buttons the title and results screens offer, by id.
    clickedButton: null,
  };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    if (e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) input.pressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - rect.left) / rect.width;
    input.mouseY = (e.clientY - rect.top) / rect.height;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.mouseSteer = true;
  });
  window.addEventListener('mouseup', () => {
    input.mouseSteer = false;
  });

  return input;
}

// Fold the keys into a stick position for this frame. Arrows and WASD
// both fly the plane; the mouse adds a nudge when it is held down.
export function readStick(input) {
  const k = input.keys;
  let roll = 0;
  let pitch = 0;
  if (k.has('ArrowLeft') || k.has('KeyA')) roll -= 1;
  if (k.has('ArrowRight') || k.has('KeyD')) roll += 1;
  if (k.has('ArrowUp') || k.has('KeyW')) pitch += 1;
  if (k.has('ArrowDown') || k.has('KeyS')) pitch -= 1;
  if (input.mouseSteer) {
    roll += (input.mouseX - 0.5) * 1.6;
    pitch += (0.5 - input.mouseY) * 1.2;
  }
  input.roll = Math.max(-1, Math.min(1, roll));
  input.pitch = Math.max(-1, Math.min(1, pitch));
  return input;
}

// Did this key go down since the last frame? Consumes the press.
export function wasPressed(input, code) {
  if (input.pressed.has(code)) {
    input.pressed.delete(code);
    return true;
  }
  return false;
}

// Throttle keys: Shift (or PageUp) opens it up, Control (or PageDown)
// pulls it back. Returns the new target, or null when untouched.
export function throttleKeys(input, current) {
  const k = input.keys;
  let target = current;
  if (k.has('ShiftLeft') || k.has('ShiftRight') || k.has('PageUp')) {
    target = Math.min(1, current + 0.9 / 60);
  }
  if (k.has('ControlLeft') || k.has('ControlRight') || k.has('PageDown')) {
    target = Math.max(0, current - 0.9 / 60);
  }
  // Number keys jump straight to a throttle setting: 0 idle, 9 full.
  for (let n = 0; n <= 9; n++) {
    if (input.pressed.has('Digit' + n)) target = n / 9;
  }
  return target;
}

export function clearPresses(input) {
  input.pressed.clear();
}
