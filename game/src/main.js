// Boot and the one loop: input is read every frame, the game advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), the renderer paints
// what is there and the HUD follows. ?shot=start|play|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createGame } from './game.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const rng = createRandom(seed);

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas, rng);
const hud = createHud((id) => game.buy(id));
const input = createInput(canvas, (locked) => {
  // Esc (or Alt-Tab) drops pointer lock: pause a live round instead of letting
  // the player stand still while bots keep playing.
  if (!locked && (game.phase === 'live' || game.phase === 'buy')) game.pause();
});
const game = createGame(renderer, hud, input, rng);

// Headless self-test hook: drives the match without pointer lock or a mouse.
window.__steel = {
  game, renderer,
  start: () => { game.debugNoLock = true; game.startMatch(); },
  aimAt(x, y, z) {
    const p = game.player;
    const dx = x - p.x, dy = y - p.eyeY, dz = z - p.z;
    p.yaw = Math.atan2(-dx, -dz);
    p.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  },
  fire() { game.debugFire(); },
  key(code, down) { window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code })); },
  debugBot(i) {
    const b = game.bots[i];
    return b ? { ...b, path: b.path.slice(), rng: undefined } : null;
  },
  canPlant: () => game.canPlantHere(),
  channel: () => game.channel && { type: game.channel.type, t: +game.channel.t.toFixed(2), frac: +game.channel.frac.toFixed(2) },
  state: () => ({
    phase: game.phase, round: game.round, maxRounds: game.maxRounds, winThreshold: game.winThreshold,
    score: game.score, playerTeam: game.playerTeam, mvp: game.mvp,
    player: { x: +game.player.x.toFixed(2), z: +game.player.z.toFixed(2), hp: game.player.hp, alive: game.player.alive, credits: game.player.credits, weapon: game.player.weaponId, armor: game.player.armor, helmet: game.player.helmet, hasKit: game.player.hasKit, grenades: game.player.grenades, blindT: +game.player.blindT.toFixed(2), spectateId: game.player.spectateId, roundKills: game.player.roundKills },
    botsAlive: game.bots.filter((b) => b.alive).length,
    bots: game.bots.map((b) => ({ id: b.id, team: b.team, x: +b.x.toFixed(1), z: +b.z.toFixed(1), hp: b.hp, alive: b.alive, state: b.state, kills: b.kills, weapon: b.weaponId })),
    planted: game.devicePlanted, roundT: Math.round(game.roundT),
    smokes: game.smokes.length, fires: game.fires.length, nades: game.grenades.length,
  }),
};

if (shot) {
  stageShot(shot, game, hud);
  let painted = 0;
  const t0 = performance.now();
  function paint() {
    renderer.update(game, STEP, t0 + painted * 16);
    hud.update(game);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
} else {
  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    while (accumulator >= STEP) {
      game.step(STEP);
      accumulator -= STEP;
    }
    renderer.update(game, STEP, now);
    hud.update(game);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (game.phase === 'live' || game.phase === 'buy')) game.pause();
  });
  requestAnimationFrame(frame);
}
