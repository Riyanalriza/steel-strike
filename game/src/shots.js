// The screenshot scenes behind ?shot=start|play|end. Each one stages a real game
// state (never a mock render): start shows the title over the map, play runs the
// live rules forward for a fixed 10 s from a seeded RNG, end shows a won round at
// Site A. Same seed, same frame — no wall clock is read anywhere in staging.
import { STEP } from './config.js';
import { collide, losBlocked } from './world.js';

// Fixed-step the live game forward with the player standing still; bots play.
function simulate(game, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    if (game.phase !== 'live') break;
    game.step(STEP);
  }
}

export function stageShot(name, game, hud) {
  if (name === 'play') {
    game.startMatch();
    game.phaseT = 0;
    game.phase = 'live';
    game.roundT = 82;
    game.buyOpen = false;
    game.debugNoLock = true;
    // The player waits at spawn during the sim (out of the fight, so the cover
    // frame is not a death cam); the camera cuts to the action afterwards.
    simulate(game, 10);
    // Frame a real firefight: the closest attacker/defender pair with line of
    // sight between them. Camera angle only — both bots stand where the sim
    // put them. (A fixed camera kept landing on empty walls: the foes were
    // behind cover; a camera straight behind the attacker hid the defender
    // behind the attacker's back; a camera at the pair's midpoint could not
    // fit both bots in frame.) So the camera stands behind the attacker and
    // off to the side of the pair line, looking at the defender — the
    // attacker stays in frame off-centre, the defender centred. The camera
    // point must be free space: try several back/side offsets and keep the
    // first one collide() leaves untouched.
    let best = null, bestD = 30;
    for (const a of game.bots.filter((b) => b.alive && b.team === 'atk')) {
      for (const d of game.bots.filter((b) => b.alive && b.team === 'def')) {
        const dist = Math.hypot(a.x - d.x, a.z - d.z);
        if (dist < bestD && !losBlocked(a.x, a.z, d.x, d.z)) { bestD = dist; best = { a, d }; }
      }
    }
    let framed = false;
    if (best) {
      const dx = best.d.x - best.a.x, dz = best.d.z - best.a.z;
      const len = Math.hypot(dx, dz) || 1;
      const ux = dx / len, uz = dz / len;
      const px2 = -uz, pz2 = ux;
      for (const back of [5, 6.5, 4]) {
        for (const side of [2.5, -2.5, 1.5, -1.5, 0]) {
          const px = best.a.x - ux * back + px2 * side;
          const pz = best.a.z - uz * back + pz2 * side;
          const [cx, cz] = collide(px, pz, 0.42);
          if (cx === px && cz === pz) {
            game.player.x = cx; game.player.z = cz;
            const tdx = best.d.x - cx, tdz = best.d.z - cz;
            game.player.yaw = Math.atan2(-tdx, -tdz);
            game.player.pitch = Math.atan2(1.1 - game.player.eyeY, Math.hypot(tdx, tdz));
            framed = true;
            break;
          }
        }
        if (framed) break;
      }
    }
    if (!framed) {
      game.player.x = 0; game.player.z = -6; game.player.yaw = 0; game.player.pitch = 0.02;
    }
    game.renderer.clearTracers();
    game.renderer.clearFlash();
    hud.hideBanner();
    hud.screen(null);
    return;
  }
  if (name === 'end') {
    game.startMatch();
    game.score = { atk: 1, def: 0 };
    game.phase = 'roundEnd';
    game.phaseT = 5;
    game.devicePlanted = true;
    game.deviceSite = 'A';
    game.devicePos = { x: -22, z: -10 };
    game.deviceFuseLeft = 24;
    game.playerCarriesDevice = false;
    game.renderer.setDevice(-22, -10, true);
    game.renderer.clearTracers();
    game.renderer.clearFlash();
    // Player inside Site A, looking at the planted device; bots nearby. The
    // camera must stand inside the site and clear of the tall crate at
    // (-20.8..-19.2, -8.2..-6.8): from (-19,-4) that crate filled the frame
    // and hid the device behind it.
    game.player.x = -21; game.player.z = -4; game.player.yaw = 0.17; game.player.pitch = -0.1;
    for (const b of game.bots.slice(0, 3)) {
      b.x = -24 + b.id; b.z = -7 - b.id * 0.5; b.yaw = -2.4 - b.id * 0.25; b.alive = true; b.dead = false;
    }
    hud.screen(null);
    hud.banner('ROUND WON', 'Device detonated at Furnace Hall  ·  EMBER 1 — 0 AEGIS', '#7dff8a');
    return;
  }
  // start (default): title screen over a slow orbit of the map.
  game.phase = 'menu';
  hud.screen('startScreen');
}
