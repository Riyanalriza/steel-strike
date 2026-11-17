// Bot squad AI: waypoint pathfinding, site objectives, plant/defuse, combat with
// reaction time and aim error, strafing and retreating. Bots never see through
// walls: every target check runs the map's line-of-sight test.
import { WEAPONS } from './config.js';
import { collide, findPath, losBlocked, NODES, siteAt } from './world.js';
import { pick, range } from './random.js';

export const BOT_NAMES = ['Vex', 'Rook', 'Mira', 'Sable', 'Onyx', 'Juno', 'Kade', 'Nyx', 'Orin'];

const EYE = 1.45;
const BODY_SPEED = 4.2;

export function makeBot(id, team, name, rng) {
  return {
    id, team, name,
    x: 0, z: 0, yaw: 0, hp: 100, armor: 0, helmet: false, hasKit: false, alive: true, dead: false, deadT: 0,
    weaponId: 'rifle', mag: 30, reserve: 90, reloading: 0,
    state: 'move', path: [], pathIdx: 0, holdX: 0, holdZ: 0, siteKey: 'A',
    carrier: false, target: null, seenT: 0, aimErr: 0.05, burstLeft: 0,
    nextShot: 0, strafeDir: 1, strafeT: 0, thinkT: range(rng, 0, 0.15),
    moving: false, speed: BODY_SPEED,
    kills: 0, deaths: 0, roundKills: 0, blindT: 0,
  };
}

function angleTo(bx, bz, tx, tz) { return Math.atan2(-(tx - bx), -(tz - bz)); }
function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function dist(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }

function visibleEnemy(bot, game) {
  // A flashed bot sees nothing until the flash wears off.
  if (bot.blindT > 0) return null;
  const foes = game.foesOf(bot);
  // Bots only take a fight inside ~32 m: at longer range they advance on their
  // objective instead of camping the spawn and trading pot-shots down a corridor.
  let best = null, bestD = 32;
  for (const f of foes) {
    if (!f.alive) continue;
    const d = dist(bot.x, bot.z, f.x, f.z);
    if (d > bestD) continue;
    const ang = Math.abs(angDiff(angleTo(bot.x, bot.z, f.x, f.z), bot.yaw));
    if (d > 9 && ang > 1.25) continue; // outside the view cone (close foes are heard)
    if (losBlocked(bot.x, bot.z, f.x, f.z)) continue;
    if (game.smokeBlocks && game.smokeBlocks(bot.x, bot.z, f.x, f.z)) continue;
    best = f; bestD = d;
  }
  return best ? { foe: best, d: bestD } : null;
}

function setPath(bot, tx, tz) {
  const path = findPath(bot.x, bot.z, tx, tz);
  if (path.length) { bot.path = path; bot.pathIdx = 0; bot.state = 'move'; }
}

// True when the bot has no path left to follow (none set, or all nodes visited).
// NOTE: an empty path alone is not the test — a finished path is non-empty.
function pathDone(bot) { return bot.pathIdx >= bot.path.length; }

function followPath(bot, dt) {
  if (bot.pathIdx >= bot.path.length) { bot.moving = false; return true; }
  const node = NODES[bot.path[bot.pathIdx]];
  const dx = node[0] - bot.x, dz = node[1] - bot.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.7) { bot.pathIdx++; return bot.pathIdx >= bot.path.length; }
  const sp = bot.speed * dt;
  const step = Math.min(sp, d);
  const nx = bot.x + (dx / d) * step, nz = bot.z + (dz / d) * step;
  const [cx, cz] = collide(nx, nz, 0.42);
  bot.x = cx; bot.z = cz;
  bot.yaw += angDiff(angleTo(bot.x, bot.z, node[0], node[1]), bot.yaw) * Math.min(1, dt * 6);
  bot.moving = true;
  return false;
}

// One fixed step of bot AI. `game` supplies foesOf, fireBotShot, tryPlant, tryDefuse.
export function updateBot(bot, game, dt) {
  if (!bot.alive) return;
  bot.thinkT -= dt;
  if (bot.blindT > 0) bot.blindT -= dt;

  // Reloading.
  if (bot.reloading > 0) {
    bot.reloading -= dt;
    if (bot.reloading <= 0) {
      const w = WEAPONS[bot.weaponId];
      const need = w.mag - bot.mag;
      const take = Math.min(need, bot.reserve);
      bot.mag += take; bot.reserve -= take;
    }
    return;
  }

  const seen = visibleEnemy(bot, game);
  if (seen) {
    if (bot.target !== seen.foe) {
      bot.target = seen.foe; bot.seenT = 0; bot.aimErr = 0.09; bot.burstLeft = 0;
      bot.reactAt = game.now + range(game.rng, 0.4, 0.85);
    }
    bot.seenT += dt;
    bot.aimErr = Math.max(0.012, bot.aimErr - dt * 0.07);
    // Face the target.
    bot.yaw += angDiff(angleTo(bot.x, bot.z, seen.foe.x, seen.foe.z), bot.yaw) * Math.min(1, dt * 10);
    // Low health: fall back toward spawn instead of strafing.
    if (bot.hp < 30 && bot.state !== 'retreat') {
      bot.state = 'retreat';
      const spawn = game.spawnOf(bot.team);
      setPath(bot, spawn.x, spawn.z);
    }
    if (bot.state === 'retreat') {
      if (followPath(bot, dt)) bot.state = 'move';
    } else if (seen.d > 20 && bot.team === 'atk') {
      // Far fight, attackers only: push toward the enemy (re-path as they move)
      // instead of standing still and trading shots from across the map.
      // Defenders hold their ground and strafe — they must not abandon a site
      // to chase a distant target.
      bot.repathT = (bot.repathT || 0) - dt;
      if (pathDone(bot) || bot.repathT <= 0) {
        setPath(bot, seen.foe.x, seen.foe.z);
        bot.repathT = 0.8;
      }
      followPath(bot, dt);
      bot.aimErr = Math.min(0.09, bot.aimErr + dt * 0.03);
    } else {
      // Close fight (or a defender at range): strafe sideways while shooting.
      bot.strafeT -= dt;
      if (bot.strafeT <= 0) { bot.strafeDir = game.rng() < 0.5 ? -1 : 1; bot.strafeT = range(game.rng, 0.5, 1.2); }
      if (bot.seenT > 0.12) {
        const px = Math.cos(bot.yaw + Math.PI / 2) * bot.strafeDir;
        const pz = -Math.sin(bot.yaw + Math.PI / 2) * bot.strafeDir;
        const [cx, cz] = collide(bot.x + px * 2.4 * dt, bot.z + pz * 2.4 * dt, 0.42);
        bot.x = cx; bot.z = cz;
        bot.moving = true;
      }
    }
    // Fire in bursts once reacted.
    const w = WEAPONS[bot.weaponId];
    if (game.now >= bot.reactAt) {
      if (bot.burstLeft <= 0 && game.now >= bot.nextShot) {
        bot.burstLeft = 3 + Math.floor(game.rng() * 3);
        bot.nextShot = game.now + range(game.rng, 0.25, 0.6);
      }
      if (bot.burstLeft > 0 && game.now >= bot.nextShot) {
        game.fireBotShot(bot, seen.foe, w);
        bot.burstLeft--;
        bot.nextShot = game.now + 60 / w.rpm;
        bot.mag--;
        if (bot.mag <= 0) { bot.reloading = w.reload; bot.mag = 0; }
      }
    }
    return;
  }
  bot.target = null;

  // No enemy in sight: play the objective.
  if (bot.team === 'atk') {
    if (game.devicePlanted) {
      // Planted: push the site and guard it.
      const site = game.plantSitePos();
      if (dist(bot.x, bot.z, site.x, site.z) > 6) {
        if (bot.state !== 'move' || pathDone(bot)) setPath(bot, site.x, site.z);
        followPath(bot, dt);
      } else { bot.state = 'hold'; bot.holdX = site.x; bot.holdZ = site.z; }
      return;
    }
    if (bot.carrier) {
      const site = game.sitePos(bot.siteKey);
      if (siteAt(bot.x, bot.z) === bot.siteKey) {
        game.tryPlant(bot);
        bot.state = 'plant';
        return;
      }
      if (pathDone(bot)) setPath(bot, site.cx, site.cz);
      followPath(bot, dt);
      return;
    }
    // Support: go to the carrier's site, or lurk mid / the other site.
    if (pathDone(bot)) {
      const site = game.sitePos(bot.siteKey);
      setPath(bot, site.cx, site.cz);
    }
    if (bot.state === 'move') {
      if (followPath(bot, dt)) { bot.state = 'hold'; bot.holdX = bot.x; bot.holdZ = bot.z; }
    }
    return;
  }

  // Defenders.
  if (game.devicePlanted) {
    const site = game.plantSitePos();
    const d = dist(bot.x, bot.z, site.x, site.z);
    if (d < 2.6) {
      game.tryDefuse(bot);
      bot.state = 'defuse';
      return;
    }
    if (bot.state !== 'move' || pathDone(bot)) setPath(bot, site.x, site.z);
    followPath(bot, dt);
    return;
  }
  // Hold the assigned spot.
  if (bot.state !== 'hold') {
    if (bot.state !== 'move' || pathDone(bot)) setPath(bot, bot.holdX, bot.holdZ);
    if (followPath(bot, dt)) bot.state = 'hold';
  }
}

export function botEye(bot) { return { x: bot.x, y: EYE, z: bot.z }; }
