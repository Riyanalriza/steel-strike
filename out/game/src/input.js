// FPS input: WASD + mouse look with pointer lock, fire, ADS, reload, use (E),
// buy toggle (B), pause (Esc/P). Mouse deltas accumulate between frames; one-shot
// presses are queued so a press between two frames is never lost.
export const ACTION_RELOAD = 1;
export const ACTION_PAUSE = 2;
export const ACTION_BUY = 4;
export const ACTION_RESTART = 8;

export function createInput(canvas, onLockChange) {
  const keys = new Set();
  let actions = 0;
  let mouseDX = 0, mouseDY = 0;
  let fireHeld = false;
  let firePressed = false;
  let adsHeld = false;
  let locked = false;
  let wheelDir = 0;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'KeyR') actions |= ACTION_RELOAD;
    else if (event.code === 'KeyB') actions |= ACTION_BUY;
    else if (event.code === 'Escape' || event.code === 'KeyP') actions |= ACTION_PAUSE;
    else if (event.code === 'Enter') actions |= ACTION_RESTART;
    if (['Space', 'Tab'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); fireHeld = false; adsHeld = false; });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (onLockChange) onLockChange(locked);
  });
  document.addEventListener('mousemove', (event) => {
    if (!locked) return;
    mouseDX += event.movementX;
    mouseDY += event.movementY;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (!locked) return;
    if (event.button === 0) { fireHeld = true; firePressed = true; }
    if (event.button === 2) adsHeld = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) fireHeld = false;
    if (event.button === 2) adsHeld = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('wheel', (event) => {
    wheelDir += event.deltaY > 0 ? 1 : -1;
    event.preventDefault();
  }, { passive: false });

  return {
    get locked() { return locked; },
    lock() {
      try { canvas.requestPointerLock(); } catch { /* headless or denied */ }
    },
    unlock() {
      try { document.exitPointerLock(); } catch { /* noop */ }
    },
    move() {
      const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      return {
        f, s,
        jump: keys.has('Space'),
        // No sprint: Shift is a slow silent walk; Ctrl/C is a crouch.
        slow: keys.has('ShiftLeft') || keys.has('ShiftRight'),
        crouch: keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC'),
        use: keys.has('KeyE'),
      };
    },
    takeWheel() {
      const d = wheelDir;
      wheelDir = 0;
      return d;
    },
    scoreboard() { return keys.has('Tab'); },
    takeMouse() {
      const d = { dx: mouseDX, dy: mouseDY };
      mouseDX = 0; mouseDY = 0;
      return d;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeFire() {
      const pressed = firePressed;
      firePressed = false;
      return { held: fireHeld, pressed };
    },
    get ads() { return adsHeld; },
  };
}
