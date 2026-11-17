// Steel Strike rules: rounds, buy economy, plant/defuse, hitscan combat, match flow.
// No drawing here except through renderer + hud; no three.js math except plain vectors.
import * as THREE from 'three';
import {
  ARMOR_MAX, ARMOR_PRICE, ECON, GRENADES, HEADSHOT_MUL, HEADSHOT_MUL_HELMET,
  HELMET_PRICE, KIT_PRICE, PLAYER, STEP, TEAMS, TIMING, WEAPONS,
} from './config.js';
import { collide, groundAt, losBlocked, siteAt, SITES, SOLIDS, SPAWNS } from './world.js';
import { BOT_NAMES, makeBot, updateBot } from './bots.js';
import { ensureAudio, sfx } from './audio.js';
import { pick, range } from './random.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

function angleTo(bx, bz, tx, tz) { return Math.atan2(-(tx - bx), -(tz - bz)); }
function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function rayBox(ox, oy, oz, dx, dy, dz, b, maxT) {
  let tmin = 0, tmax = maxT;
  const mins = [b.x0, 0, b.z0], maxs = [b.x1, b.h, b.z1];
  const o = [ox, oy, oz], d = [dx, dy, dz];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < mins[i] || o[i] > maxs[i]) return Infinity; }
    else {
      let t1 = (mins[i] - o[i]) / d[i], t2 = (maxs[i] - o[i]) / d[i];
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const ocx = ox - cx, ocy = oy - cy, ocz = oz - cz;
  const b = ocx * dx + ocy * dy + ocz * dz;
  const c = ocx * ocx + ocy * ocy + ocz * ocz - r * r;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const s = Math.sqrt(disc);
  let t = -b - s;
  if (t < 0) t = -b + s;
  return t < 0 ? Infinity : t;
}

export function createGame(renderer, hud, input, rng) {
  const game = {
    rng, renderer, hud, input,
    phase: 'menu', prevPhase: 'live', paused: false,
    round: 1, maxRounds: TIMING.maxRounds, winThreshold: TIMING.winRounds, ot: false,
    score: { atk: 0, def: 0 },
    lossStreak: { atk: 0, def: 0 },
    playerTeam: 'atk',
    phaseT: 0, roundT: 0, now: 0,
    bots: [], player: null,
    devicePlanted: false, deviceFuseLeft: 0, deviceSite: null, devicePos: null,
    channel: null, explosion: null, heBoom: null, buyOpen: false,
    playerCarriesDevice: false, matchWinner: null, roundBanner: '',
    mvp: null, smokes: [], fires: [], grenades: [],
  };

  function makePlayer() {
    return {
      isPlayer: true, name: 'You', team: game.playerTeam,
      x: 0, z: 0, yaw: 0, pitch: 0, yOff: 0, vy: 0, grounded: true,
      eyeY: PLAYER.eye, hp: PLAYER.hp, armor: 0, helmet: false, hasKit: false, alive: true,
      weaponId: 'pistol', mag: WEAPONS.pistol.mag, reserve: WEAPONS.pistol.reserve,
      owned: new Set(['pistol', 'knife']), credits: ECON.start,
      kills: 0, deaths: 0, roundKills: 0,
      grenades: { flash: 0, smoke: 0, he: 0, molotov: 0 },
      recoil: 0, moving: false, moveFrac: 0, airborne: false, ads: false,
      crouch: false, blindT: 0, deathT: 0, spectateId: null,
      reloading: 0, lastShot: -9, stepT: 0,
    };
  }

  game.player = makePlayer();

  function teamColor(actor) { return TEAMS[actor.team].css; }

  game.spawnOf = (team) => pick(rng, SPAWNS[team]);
  game.sitePos = (key) => SITES[key];
  game.plantSitePos = () => (game.deviceSite ? SITES[game.deviceSite] : { x: 0, z: 0, cx: 0, cz: 0 });

  game.foesOf = (actor) => {
    const foes = [];
    const enemyTeam = actor.team === 'atk' ? 'def' : 'atk';
    if (actor.isPlayer) {
      for (const b of game.bots) if (b.team === enemyTeam) foes.push(b);
    } else {
      if (game.player.team === enemyTeam && game.player.alive) foes.push(game.player);
      for (const b of game.bots) if (b.team === enemyTeam && b !== actor) foes.push(b);
    }
    return foes;
  };

  game.timerText = () => {
    if (game.phase === 'buy') return 'BUY ' + fmtTime(game.phaseT);
    if (game.phase === 'live') return fmtTime(game.roundT);
    if (game.phase === 'roundEnd') return '—';
    return 'STEEL STRIKE';
  };
  function fmtTime(t) {
    const s = Math.max(0, Math.ceil(t));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  // ---------- match / round flow ----------
  function buildBots() {
    game.bots = [];
    const names = BOT_NAMES.slice();
    // 4 allies on the player's team, 5 enemies on the other.
    for (let i = 0; i < 9; i++) {
      const team = i < 4 ? game.playerTeam : game.playerTeam === 'atk' ? 'def' : 'atk';
      const b = makeBot(i, team, names[i], rng);
      b.credits = ECON.start;
      game.bots.push(b);
    }
  }

  function botBuy(b) {
    const teamHasSniper = game.bots.some((o) => o.team === b.team && o.weaponId === 'sniper' && o !== b);
    const rifleId = b.team === 'atk' ? 'rifleAtk' : 'rifleDef';
    if (b.credits >= WEAPONS.sniper.price && !teamHasSniper && rng() < 0.3) b.weaponId = 'sniper';
    else if (b.credits >= WEAPONS[rifleId].price) b.weaponId = rifleId;
    else if (b.credits >= WEAPONS.smg.price) b.weaponId = 'smg';
    else b.weaponId = 'pistol';
    const w = WEAPONS[b.weaponId];
    b.credits -= w.price;
    if (b.credits >= ARMOR_PRICE) { b.armor = ARMOR_MAX; b.credits -= ARMOR_PRICE; }
    else b.armor = 0;
    b.helmet = b.credits >= HELMET_PRICE && rng() < 0.5;
    if (b.helmet) b.credits -= HELMET_PRICE;
    // Defenders sometimes carry a defuse kit (5 s defuse instead of 10).
    b.hasKit = b.team === 'def' && b.credits >= KIT_PRICE && rng() < 0.3;
    if (b.hasKit) b.credits -= KIT_PRICE;
    b.mag = w.mag; b.reserve = w.reserve;
  }

  function assignRound() {
    const atkBots = game.bots.filter((b) => b.team === 'atk');
    const defBots = game.bots.filter((b) => b.team === 'def');
    // Carrier: the player when attacking, else a random attacker bot.
    game.playerCarriesDevice = game.playerTeam === 'atk';
    for (const b of atkBots) b.carrier = false;
    const siteKey = rng() < 0.5 ? 'A' : 'B';
    const otherSite = siteKey === 'A' ? 'B' : 'A';
    if (!game.playerCarriesDevice) pick(rng, atkBots).carrier = true;
    atkBots.forEach((b, i) => {
      b.siteKey = i === 0 ? siteKey : i === 1 ? siteKey : i === 2 ? otherSite : siteKey;
      if (b.carrier) b.siteKey = siteKey;
    });
    defBots.forEach((b, i) => {
      if (i < 2) { b.siteKey = 'A'; const s = SITES.A; b.holdX = s.cx + range(rng, -3, 3); b.holdZ = s.cz + range(rng, -3, 3); }
      else if (i < 4) { b.siteKey = 'B'; const s = SITES.B; b.holdX = s.cx + range(rng, -3, 3); b.holdZ = s.cz + range(rng, -3, 3); }
      else { b.siteKey = 'A'; b.holdX = 0; b.holdZ = -8; }
      b.state = 'move'; b.path = []; b.pathIdx = 0;
    });
    for (const b of atkBots) { b.state = 'move'; b.path = []; b.pathIdx = 0; }
  }

  function placeActors() {
    const p = game.player;
    const ps = SPAWNS[game.playerTeam][2];
    p.x = ps.x; p.z = ps.z; p.yaw = ps.yaw; p.pitch = 0;
    p.yOff = 0; p.vy = 0; p.hp = PLAYER.hp; p.alive = true;
    p.recoil = 0; p.reloading = 0; p.ads = false; p.crouch = false; p.blindT = 0;
    p.spectateId = null;
    if (!p.owned.has(p.weaponId)) p.weaponId = 'pistol';
    const w = WEAPONS[p.weaponId];
    p.mag = w.mag; p.reserve = w.reserve;
    game.bots.forEach((b, i) => {
      const spawns = SPAWNS[b.team];
      const s = spawns[i % spawns.length];
      b.x = s.x + range(rng, -1, 1); b.z = s.z + range(rng, -1, 1);
      b.yaw = s.yaw; b.hp = PLAYER.hp; b.alive = true; b.dead = false;
      b.state = 'move'; b.path = []; b.pathIdx = 0; b.target = null;
      b.burstLeft = 0; b.reloading = 0; b.moving = false; b.blindT = 0;
      botBuy(b);
    });
  }

  game.startMatch = () => {
    game.score = { atk: 0, def: 0 };
    game.lossStreak = { atk: 0, def: 0 };
    game.round = 1;
    game.winThreshold = TIMING.winRounds;
    game.maxRounds = TIMING.maxRounds;
    game.ot = false;
    game.mvp = null;
    game.playerTeam = 'atk';
    game.player.team = 'atk';
    game.player.credits = ECON.start;
    game.player.owned = new Set(['pistol', 'knife']);
    game.player.weaponId = 'pistol';
    game.player.armor = 0;
    game.player.helmet = false;
    game.player.hasKit = false;
    game.player.grenades = { flash: 0, smoke: 0, he: 0, molotov: 0 };
    game.player.kills = 0; game.player.deaths = 0;
    game.matchWinner = null;
    buildBots();
    startRound();
  };

  function startRound() {
    game.devicePlanted = false;
    game.deviceSite = null;
    game.devicePos = null;
    game.deviceFuseLeft = 0;
    game.channel = null;
    game.explosion = null;
    game.heBoom = null;
    game.smokes = [];
    game.fires = [];
    game.grenades = [];
    game.mvp = null;
    game.player.roundKills = 0;
    for (const b of game.bots) b.roundKills = 0;
    // Pistol rounds (1 and 13): fresh $800 and pistols only, like a new half.
    if (game.round === 13) {
      const p = game.player;
      p.credits = ECON.start;
      p.owned = new Set(['pistol', 'knife']);
      p.weaponId = 'pistol';
      p.armor = 0; p.helmet = false; p.hasKit = false;
      p.grenades = { flash: 0, smoke: 0, he: 0, molotov: 0 };
      for (const b of game.bots) {
        b.credits = ECON.start; b.armor = 0; b.helmet = false; b.hasKit = false;
      }
    }
    assignRound();
    placeActors();
    renderer.syncBots(game.bots);
    game.phase = 'buy';
    game.phaseT = TIMING.buy;
    game.buyOpen = true;
    hud.screen(null);
    const pistolRound = game.round === 1 || game.round === 13;
    hud.banner(
      pistolRound ? `ROUND ${game.round} — PISTOL ROUND` : `ROUND ${game.round}`,
      game.playerTeam === 'atk' ? 'Attack — plant the device at Site A or B' : 'Defend — hold the sites, defuse the device',
      '#ffd27a',
    );
  }

  function endRound(winner, reason) {
    if (game.phase !== 'live' && game.phase !== 'buy') return;
    game.phase = 'roundEnd';
    game.phaseT = TIMING.roundEnd;
    game.channel = null;
    game.score[winner]++;
    const loser = winner === 'atk' ? 'def' : 'atk';
    // Loss bonus grows with the loser's consecutive lost rounds.
    game.lossStreak[winner] = 0;
    game.lossStreak[loser] = Math.min(5, game.lossStreak[loser] + 1);
    const lossBonus = ECON.lossStreak[game.lossStreak[loser] - 1];
    const playerWon = winner === game.playerTeam;
    for (const b of game.bots) b.credits += b.team === winner ? ECON.win : lossBonus;
    game.player.credits += playerWon ? ECON.win : lossBonus;
    if (!game.player.alive) {
      game.player.owned = new Set(['pistol', 'knife']);
      game.player.weaponId = 'pistol';
      game.player.grenades = { flash: 0, smoke: 0, he: 0, molotov: 0 };
    }
    // Round MVP: most eliminations this round (ties go to the first).
    let mvp = null;
    for (const a of [game.player, ...game.bots]) {
      if (a.roundKills > 0 && (!mvp || a.roundKills > mvp.kills)) mvp = { name: a.name, team: a.team, kills: a.roundKills };
    }
    game.mvp = mvp;
    // 12-12 opens overtime: first to 16, max 30 rounds.
    if (!game.ot && game.score.atk === 12 && game.score.def === 12) {
      game.ot = true;
      game.winThreshold = TIMING.otWinRounds;
      game.maxRounds = TIMING.otMaxRounds;
    }
    if (playerWon) sfx.roundWin(); else sfx.roundLose();
    hud.banner(
      playerWon ? 'ROUND WON' : 'ROUND LOST',
      `${reason}  ·  ${TEAMS.atk.name} ${game.score.atk} — ${game.score.def} ${TEAMS.def.name}` +
        (mvp ? `  ·  ★ MVP ${mvp.name} (${mvp.kills})` : ''),
      playerWon ? '#7dff8a' : '#ff6b5e',
    );
    game.roundBanner = reason;
  }

  function endMatch(winner) {
    game.phase = 'matchEnd';
    game.matchWinner = winner;
    input.unlock();
    const playerWon = winner === game.playerTeam;
    const ms = document.getElementById('matchTitle');
    if (ms) {
      ms.textContent = winner === null ? 'DRAW' : playerWon ? 'VICTORY' : 'DEFEAT';
      ms.classList.toggle('lose', !playerWon && winner !== null);
    }
    const sub = document.getElementById('matchSub');
    if (sub) sub.textContent = `${TEAMS.atk.name} ${game.score.atk} — ${game.score.def} ${TEAMS.def.name}  ·  ${game.player.kills} eliminations`;
    hud.screen('matchScreen');
    if (playerWon) sfx.roundWin(); else sfx.roundLose();
  }

  function nextRound() {
    if (game.score.atk >= game.winThreshold || game.score.def >= game.winThreshold) {
      endMatch(game.score.atk > game.score.def ? 'atk' : 'def');
      return;
    }
    if (game.round >= game.maxRounds) {
      endMatch(game.score.atk === game.score.def ? null : game.score.atk > game.score.def ? 'atk' : 'def');
      return;
    }
    game.round++;
    if (game.round === TIMING.halftimeRound + 1) {
      // Half-time: swap sides, keep the score, reset the loss streak.
      game.playerTeam = game.playerTeam === 'atk' ? 'def' : 'atk';
      game.player.team = game.playerTeam;
      for (const b of game.bots) b.team = b.team === 'atk' ? 'def' : 'atk';
      game.lossStreak = { atk: 0, def: 0 };
      hud.banner('HALF-TIME — SIDES SWAPPED', `You are now ${TEAMS[game.playerTeam].name}`, '#7db8ff');
    }
    startRound();
  }

  // ---------- buy ----------
  // 'rifle' means the buyer's own side rifle (Mauler for attackers, Warden
  // for defenders); the other side's rifle is never offered.
  game.buy = (id) => {
    if (game.phase !== 'buy') return;
    const p = game.player;
    if (id === 'armor') {
      if (p.armor >= ARMOR_MAX || p.credits < ARMOR_PRICE) return;
      p.credits -= ARMOR_PRICE; p.armor = ARMOR_MAX; sfx.click();
      return;
    }
    if (id === 'helmet') {
      if (p.helmet || p.credits < HELMET_PRICE) return;
      p.credits -= HELMET_PRICE; p.helmet = true; sfx.click();
      return;
    }
    if (id === 'kit') {
      if (p.hasKit || p.credits < KIT_PRICE) return;
      p.credits -= KIT_PRICE; p.hasKit = true; sfx.click();
      return;
    }
    if (GRENADES[id]) {
      if (p.credits < GRENADES[id].price) return;
      p.credits -= GRENADES[id].price;
      p.grenades[id]++;
      sfx.click();
      return;
    }
    if (id === 'rifle') id = p.team === 'atk' ? 'rifleAtk' : 'rifleDef';
    const w = WEAPONS[id];
    if (!w || p.owned.has(id) || p.credits < w.price) return;
    p.credits -= w.price;
    p.owned.add(id);
    p.weaponId = id;
    p.mag = w.mag; p.reserve = w.reserve;
    sfx.click();
  };

  game.selectWeapon = (id) => {
    const p = game.player;
    if (id === 'rifle') id = p.team === 'atk' ? 'rifleAtk' : 'rifleDef';
    if (!p.owned.has(id) || p.weaponId === id) return;
    p.weaponId = id;
    const w = WEAPONS[id];
    p.mag = Math.min(p.mag, w.mag);
    sfx.click();
  };

  // Mouse wheel: cycle through owned weapons in a fixed order.
  const WEAPON_ORDER = ['knife', 'pistol', 'heavy', 'smg', 'shotgun', 'rifleAtk', 'rifleDef', 'rifleScope', 'sniper'];
  game.cycleWeapon = (dir) => {
    const p = game.player;
    const owned = WEAPON_ORDER.filter((id) => p.owned.has(id));
    if (owned.length < 2) return;
    let i = owned.indexOf(p.weaponId);
    i = (i + dir + owned.length) % owned.length;
    game.selectWeapon(owned[i]);
  };

  // ---------- plant / defuse ----------
  game.canPlantHere = () => {
    if (game.phase !== 'live' || game.playerTeam !== 'atk' || !game.playerCarriesDevice) return false;
    return game.player.alive && siteAt(game.player.x, game.player.z) !== null && !game.devicePlanted;
  };
  game.canDefuseHere = () => {
    if (game.phase !== 'live' || game.playerTeam !== 'def' || !game.devicePlanted) return false;
    const d = Math.hypot(game.player.x - game.devicePos.x, game.player.z - game.devicePos.z);
    return game.player.alive && d < 2.6;
  };

  game.tryPlant = (actor) => {
    if (game.channel || game.devicePlanted || game.phase !== 'live') return;
    if (actor.team !== 'atk') return;
    const site = siteAt(actor.x, actor.z);
    if (site === null) return;
    game.channel = { actor, type: 'plant', label: 'PLANTING DEVICE', dur: TIMING.plant, t: 0, frac: 0, site };
    sfx.beep(false);
  };
  game.tryDefuse = (actor) => {
    if (game.channel || !game.devicePlanted || game.phase !== 'live') return;
    if (actor.team !== 'def') return;
    const d = Math.hypot(actor.x - game.devicePos.x, actor.z - game.devicePos.z);
    if (d > 2.6) return;
    // A defuse kit cuts the defuse from 10 s to 5 s.
    game.channel = { actor, type: 'defuse', label: 'DEFUSING DEVICE', dur: actor.hasKit ? TIMING.defuseKit : TIMING.defuse, t: 0, frac: 0, tickT: 0 };
    sfx.beep(false);
  };

  function completeChannel() {
    const ch = game.channel;
    if (!ch) return;
    if (ch.type === 'plant') {
      game.devicePlanted = true;
      game.deviceSite = siteAt(ch.actor.x, ch.actor.z);
      game.devicePos = { x: ch.actor.x, z: ch.actor.z };
      game.deviceFuseLeft = TIMING.fuse;
      game.playerCarriesDevice = false;
      ch.actor.credits += ECON.plant;
      renderer.setDevice(game.devicePos.x, game.devicePos.z, true);
      sfx.plant();
      hud.banner('DEVICE PLANTED', `Site ${game.deviceSite} — ${TIMING.fuse}s to detonation`, '#ff8c1a');
    } else {
      renderer.setDevice(0, 0, false);
      sfx.defuse();
      endRound('def', 'Device defused');
    }
    game.channel = null;
  }

  function updateChannel(dt) {
    const ch = game.channel;
    if (!ch) return;
    const a = ch.actor;
    if (!a.alive || game.phase !== 'live') { game.channel = null; return; }
    if (ch.type === 'plant') {
      const ok = a.team === 'atk' && siteAt(a.x, a.z) === ch.site && !game.devicePlanted;
      const holding = a.isPlayer ? input.move().use : true;
      if (!ok || !holding) { game.channel = null; return; }
    } else {
      const d = Math.hypot(a.x - game.devicePos.x, a.z - game.devicePos.z);
      const holding = a.isPlayer ? input.move().use : true;
      if (d > 2.6 || !holding) { game.channel = null; return; }
    }
    ch.t += dt;
    ch.frac = Math.min(1, ch.t / ch.dur);
    ch.tickT = (ch.tickT || 0) - dt;
    if (ch.tickT <= 0) { sfx.tick(); ch.tickT = 0.5; }
    if (ch.t >= ch.dur) completeChannel();
  }

  // ---------- combat ----------
  function hitscan(ox, oy, oz, dx, dy, dz, maxDist, shooter) {
    let wallT = maxDist;
    for (const s of SOLIDS) {
      const t = rayBox(ox, oy, oz, dx, dy, dz, s, maxDist);
      if (t < wallT) wallT = t;
    }
    let best = null, bestT = wallT;
    const targets = [];
    if (shooter.isPlayer) {
      for (const b of game.bots) if (b.alive && b.team !== game.playerTeam) targets.push(b);
    } else {
      if (game.player.alive && game.player.team !== shooter.team) targets.push(game.player);
      for (const b of game.bots) if (b.alive && b !== shooter && b.team !== shooter.team) targets.push(b);
    }
    for (const t of targets) {
      // Head/body spheres follow the target's actual height: a crouched
      // player is a smaller target than a standing one.
      const headY = t.isPlayer ? t.eyeY - 0.12 : 1.5;
      const bodyY = t.isPlayer ? t.eyeY - 0.62 : 1.0;
      const th = raySphere(ox, oy, oz, dx, dy, dz, t.x, headY, t.z, 0.24);
      if (th < bestT) { bestT = th; best = { actor: t, part: 'head' }; }
      const tb = raySphere(ox, oy, oz, dx, dy, dz, t.x, bodyY, t.z, 0.5);
      if (tb < bestT) { bestT = tb; best = { actor: t, part: 'body' }; }
    }
    const px = ox + dx * bestT, py = oy + dy * bestT, pz = oz + dz * bestT;
    if (best) return { ...best, dist: bestT, point: V3(px, py, pz) };
    if (wallT < maxDist) return { wall: true, dist: wallT, point: V3(px, py, pz) };
    return { miss: true, dist: maxDist, point: V3(ox + dx * maxDist, oy + dy * maxDist, oz + dz * maxDist) };
  }

  // Headshot x4 bare, x3 with a helmet; armor absorbs half of what the
  // weapon's penetration lets through, and the armor itself wears down.
  function applyDamage(target, baseDmg, attacker, weapon, head) {
    if (!target.alive) return;
    const mul = head ? (target.helmet ? HEADSHOT_MUL_HELMET : HEADSHOT_MUL) : 1;
    const dmg = baseDmg * mul;
    const pen = weapon ? weapon.armorPen || 0 : 0.5;
    let hpDmg = dmg;
    if (target.armor > 0) {
      const absorbed = Math.min(target.armor, dmg * 0.5 * (1 - pen));
      target.armor -= absorbed;
      hpDmg = dmg - absorbed;
    }
    target.hp -= hpDmg;
    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
      target.deaths++;
      if (target.isPlayer) {
        target.deathT = game.now;
        target.spectateId = null;
        target.ads = false;
        input.unlock();
      } else {
        target.dead = true;
        target.deadT = game.now;
      }
      if (attacker && attacker !== target) {
        attacker.credits += weapon && weapon.killReward ? weapon.killReward : 300;
        attacker.kills++;
        attacker.roundKills++;
        if (attacker.isPlayer) sfx.kill();
      }
      hud.killfeed(
        { name: attacker ? attacker.name : '—', color: attacker ? teamColor(attacker) : '#888' },
        { name: target.name, color: teamColor(target) },
        weapon ? weapon.name : '—', head,
      );
      // Device drops to the nearest living attacker.
      if (target.carrier) {
        target.carrier = false;
        const atkAlive = game.bots.filter((b) => b.team === 'atk' && b.alive);
        if (atkAlive.length) pick(rng, atkAlive).carrier = true;
      }
      if (target.isPlayer && game.playerCarriesDevice) {
        game.playerCarriesDevice = false;
        const atkAlive = game.bots.filter((b) => b.team === 'atk' && b.alive);
        if (atkAlive.length) pick(rng, atkAlive).carrier = true;
      }
      checkElimination();
    }
  }

  function checkElimination() {
    if (game.phase !== 'live') return;
    const atkAlive = game.bots.filter((b) => b.team === 'atk' && b.alive).length + (game.playerTeam === 'atk' && game.player.alive ? 1 : 0);
    const defAlive = game.bots.filter((b) => b.team === 'def' && b.alive).length + (game.playerTeam === 'def' && game.player.alive ? 1 : 0);
    if (game.devicePlanted) {
      if (defAlive === 0) endRound('atk', 'Defenders eliminated — device detonates');
      else if (atkAlive === 0) { /* defenders still must defuse; fuse decides */ }
    } else {
      if (atkAlive === 0) endRound('def', 'Attackers eliminated');
      else if (defAlive === 0) endRound('atk', 'Defenders eliminated');
    }
  }

  function muzzleOf(shooter) {
    if (shooter.isPlayer) {
      const p = game.player;
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
      const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      return V3(p.x + fx * 0.55 + rx * 0.18, p.eyeY - 0.12, p.z + fz * 0.55 + rz * 0.18);
    }
    const fx = -Math.sin(shooter.yaw), fz = -Math.cos(shooter.yaw);
    return V3(shooter.x + fx * 0.5, 1.35, shooter.z + fz * 0.5);
  }

  function fireWeapon(shooter, origin, dir, weapon, spread) {
    for (let p = 0; p < weapon.pellets; p++) {
      const d = dir.clone();
      const a = (rng() - 0.5) * 2 * spread, b = (rng() - 0.5) * 2 * spread;
      // Small random cone around the aim direction.
      const yaw = Math.atan2(-d.x, -d.z) + a;
      const pitch = Math.asin(Math.max(-1, Math.min(1, d.y))) + b;
      const dd = V3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      const hit = hitscan(origin.x, origin.y, origin.z, dd.x, dd.y, dd.z, weapon.range, shooter);
      renderer.fireTracer(muzzleOf(shooter), hit.point);
      if (hit.actor) {
        const head = hit.part === 'head';
        const wasAlive = hit.actor.alive;
        applyDamage(hit.actor, weapon.dmg, shooter, weapon, head);
        if (shooter.isPlayer && wasAlive) { hud.hitmarker(head); sfx.hit(head); }
      }
    }
    renderer.muzzleAt(muzzleOf(shooter));
    if (shooter.isPlayer) sfx.shot(weapon.kind.toLowerCase());
    else {
      const d = Math.hypot(shooter.x - game.player.x, shooter.z - game.player.z);
      if (d < 34) sfx.enemyShot(d);
    }
  }

  game.fireBotShot = (bot, target, weapon) => {
    const eye = { x: bot.x, y: 1.45, z: bot.z };
    const aimY = rng() < 0.12 ? 1.5 : 1.05;
    const dx = target.x - bot.x, dy = aimY - 1.45, dz = target.z - bot.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    const err = bot.aimErr + len * 0.0004;
    const yaw = Math.atan2(-dx, -dz) + (rng() - 0.5) * 2 * err;
    const pitch = Math.asin(Math.max(-1, Math.min(1, dy / len))) + (rng() - 0.5) * 2 * err;
    const dir = V3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    fireWeapon(bot, eye, dir, weapon, 0);
  };

  function firePlayer() {
    const p = game.player;
    const w = WEAPONS[p.weaponId];
    const nowS = game.now;
    if (nowS - p.lastShot < 60 / w.rpm) return;
    if (p.reloading > 0) return;
    p.lastShot = nowS;
    // Knife: a short melee swing in a cone ahead — no ammo, no recoil.
    if (w.melee) {
      sfx.swing();
      let best = null, bestD = w.range;
      for (const t of game.foesOf(p)) {
        if (!t.alive) continue;
        const d = Math.hypot(t.x - p.x, t.z - p.z);
        if (d > w.range) continue;
        if (Math.abs(angDiff(angleTo(p.x, p.z, t.x, t.z), p.yaw)) > 1.0) continue;
        if (d < bestD) { bestD = d; best = t; }
      }
      if (best) {
        applyDamage(best, w.dmg, p, w, false);
        sfx.stab();
        hud.hitmarker(false);
      }
      return;
    }
    if (p.mag <= 0) {
      sfx.dry();
      startReload(p);
      return;
    }
    p.mag--;
    p.recoil = Math.min(1, p.recoil + w.kick * 0.35);
    // View kick: the aim itself climbs with each shot (the spray to control),
    // and the player pulls it back down.
    p.pitch += w.kick * 0.02;
    p.yaw += (rng() - 0.5) * w.kick * 0.014;
    // Spread: base, then movement (counter-strafe: stopping restores accuracy
    // at once, because moveFrac is the live speed fraction), crouch tightens,
    // airborne ruins it, firing blooms it, scope narrows it.
    const spread = (w.spread * (1 + p.moveFrac * 1.6) * (p.crouch ? 0.6 : 1)
      + (p.airborne ? 0.045 : 0) + p.recoil * 0.012) * (p.ads ? 0.35 : 1);
    const dir = V3(-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch));
    fireWeapon(p, { x: p.x, y: p.eyeY, z: p.z }, dir, w, spread);
    if (p.mag <= 0) startReload(p);
  }

  function startReload(p) {
    if (p.reloading > 0 || p.reserve <= 0) return;
    const w = WEAPONS[p.weaponId];
    p.reloading = w.reload;
    sfx.reload();
  }
  game.debugFire = () => { if (game.phase === 'live') firePlayer(); };

  function finishReload(p) {
    const w = WEAPONS[p.weaponId];
    const need = w.mag - p.mag;
    const take = Math.min(need, p.reserve);
    p.mag += take;
    p.reserve -= take;
  }

  // ---------- per-frame player update ----------
  function updatePlayer(dt) {
    const p = game.player;
    if (!p.alive) return;
    const mouse = input.takeMouse();
    p.yaw -= mouse.dx * 0.0022;
    p.pitch -= mouse.dy * 0.0022;
    p.pitch = Math.max(-1.5, Math.min(1.5, p.pitch));
    const mv = input.move();
    const w = WEAPONS[p.weaponId];
    // No sprint: Shift is a slow silent walk, Ctrl/C is a crouch (slower,
    // steadier, lower eye). Only scoped weapons zoom with right-click;
    // ordinary rifles are hipfire only.
    p.crouch = !!mv.crouch;
    p.ads = input.ads && !!w.zoom && game.phase === 'live';
    let speed = w.speed;
    if (p.crouch) speed *= 0.5;
    else if (mv.slow) speed *= 0.55;
    if (p.ads) speed *= 0.6;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    let mx = fx * mv.f + rx * mv.s;
    let mz = fz * mv.f + rz * mv.s;
    const ml = Math.hypot(mx, mz);
    if (ml > 0) { mx /= ml; mz /= ml; }
    // Freeze time: look around, but do not leave the spawn.
    const frozen = game.phase === 'buy';
    p.moving = ml > 0 && game.phase === 'live';
    p.moveFrac = frozen || ml === 0 ? 0 : p.crouch ? 0.5 : mv.slow ? 0.55 : 1;
    if (game.phase === 'live') {
      const [nx, nz] = collide(p.x + mx * speed * dt, p.z + mz * speed * dt, PLAYER.radius, p.yOff);
      p.x = nx; p.z = nz;
      if (mv.jump && p.grounded) { p.vy = PLAYER.jump; p.grounded = false; }
    }
    // Vertical: gravity, landing on the floor or on a crate top, and walking
    // off an edge starts a fall.
    const prevY = p.yOff;
    if (!p.grounded || p.yOff > 0) {
      p.vy -= PLAYER.gravity * dt;
      p.yOff += p.vy * dt;
      if (p.vy <= 0) {
        const g = groundAt(p.x, p.z, prevY + 0.02);
        if (g > 0 && p.yOff <= g) { p.yOff = g; p.vy = 0; p.grounded = true; }
      }
      if (p.yOff <= 0) { p.yOff = 0; p.vy = 0; p.grounded = true; }
    } else {
      const g = groundAt(p.x, p.z, p.yOff + 0.02);
      if (g < p.yOff - 0.05) { p.grounded = false; p.vy = 0; }
    }
    p.airborne = !p.grounded;
    p.eyeY = (p.crouch ? PLAYER.eyeCrouch : PLAYER.eye) + p.yOff;
    // Recoil bloom decays fast once the trigger is released.
    p.recoil = Math.max(0, p.recoil - dt * 3.5);
    // Flash blindness wears off.
    if (p.blindT > 0) p.blindT -= dt;
    // Reload.
    if (p.reloading > 0) {
      p.reloading -= dt;
      if (p.reloading <= 0) finishReload(p);
    }
    // Footsteps: loud on a normal walk, quiet crouched, silent slow-walking.
    if (p.moving && p.grounded && !mv.slow) {
      p.stepT -= dt;
      if (p.stepT <= 0) { sfx.step(p.crouch); p.stepT = 0.42; }
    }
    // Fire (pointer lock gates live fire for real players; debugNoLock lets
    // headless self-tests drive the trigger without a lock).
    if (game.phase === 'live' && (input.locked || game.debugNoLock)) {
      const fire = input.takeFire();
      if ((w.auto && fire.held) || fire.pressed) firePlayer();
    } else input.takeFire();
    // Plant / defuse hold.
    if (game.phase === 'live' && mv.use) {
      if (!game.channel) {
        if (game.canPlantHere()) game.tryPlant(p);
        else if (game.canDefuseHere()) game.tryDefuse(p);
      }
    }
  }

  // ---------- device / fuse ----------
  function updateDevice(dt) {
    if (!game.devicePlanted) return;
    game.deviceFuseLeft -= dt;
    // Accelerating beeps.
    game.beepT = (game.beepT || 0) - dt;
    if (game.beepT <= 0) {
      sfx.beep(game.deviceFuseLeft < 10);
      game.beepT = game.deviceFuseLeft > 20 ? 1.0 : game.deviceFuseLeft > 10 ? 0.6 : game.deviceFuseLeft > 5 ? 0.35 : 0.2;
    }
    if (game.deviceFuseLeft <= 0) {
      game.devicePlanted = false;
      renderer.setDevice(0, 0, false);
      game.explosion = { x: game.devicePos.x, z: game.devicePos.z, at: performance.now() };
      sfx.explode();
      // Blast hurts everyone near the site.
      const all = [game.player, ...game.bots];
      const blastW = { name: 'Device', armorPen: 1 };
      for (const a of all) {
        if (!a.alive) continue;
        const d = Math.hypot(a.x - game.devicePos.x, a.z - game.devicePos.z);
        if (d < 9) applyDamage(a, 120 - d * 8, null, blastW, false);
      }
      endRound('atk', 'Device detonated');
    }
  }

  // ---------- grenades ----------
  game.throwGrenade = (type) => {
    const p = game.player;
    if (game.phase !== 'live' || !p.alive || (p.grenades[type] || 0) <= 0) return;
    p.grenades[type]--;
    const dir = V3(-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch));
    game.grenades.push({
      type, x: p.x, y: p.eyeY - 0.1, z: p.z,
      vx: dir.x * 14, vy: dir.y * 14 + 3.5, vz: dir.z * 14,
      t: 0, fuse: type === 'flash' ? 1.4 : 1.2,
    });
    sfx.swing();
  };

  function segHitsCircle(x0, z0, x1, z1, cx, cz, r) {
    const dx = x1 - x0, dz = z1 - z0;
    const len2 = dx * dx + dz * dz || 1;
    let t = ((cx - x0) * dx + (cz - z0) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = x0 + dx * t, pz = z0 + dz * t;
    return Math.hypot(px - cx, pz - cz) < r;
  }

  // True when a live smoke cloud stands between the two points.
  game.smokeBlocks = (x0, z0, x1, z1) => {
    for (const s of game.smokes) if (segHitsCircle(x0, z0, x1, z1, s.x, s.z, s.r)) return true;
    return false;
  };

  function facingFactor(actor, gx, gz) {
    // 1 when the actor looks straight at the point, 0 when looking away.
    const a = angleTo(actor.x, actor.z, gx, gz);
    return Math.max(0, Math.cos(Math.abs(angDiff(a, actor.yaw))));
  }

  function detonateFlash(g) {
    sfx.pop();
    const all = [game.player, ...game.bots];
    for (const a of all) {
      if (!a.alive) continue;
      const d = Math.hypot(a.x - g.x, a.z - g.z);
      if (d > 20) continue;
      if (losBlocked(a.x, a.z, g.x, g.z)) continue;
      const face = facingFactor(a, g.x, g.z);
      const dur = Math.max(0.4, 2.8 * (1 - d / 20) * (0.35 + 0.65 * face));
      a.blindT = Math.max(a.blindT || 0, dur);
      if (a.isPlayer) sfx.ring();
    }
  }

  function detonateHE(g) {
    game.heBoom = { x: g.x, z: g.z, at: performance.now() };
    sfx.explode();
    const w = { name: 'Frag Charge', armorPen: 0.8, killReward: 300 };
    for (const a of [game.player, ...game.bots]) {
      if (!a.alive) continue;
      const d = Math.hypot(a.x - g.x, a.z - g.z);
      if (d < 6) applyDamage(a, 90 * (1 - d / 6), game.player, w, false);
    }
  }

  function updateGrenades(dt) {
    for (const g of game.grenades) {
      if (g.done) continue;
      g.t += dt;
      g.vy -= 13.5 * dt;
      let nx = g.x + g.vx * dt, ny = g.y + g.vy * dt, nz = g.z + g.vz * dt;
      if (ny < 0.08) {
        ny = 0.08;
        if (g.type === 'smoke') {
          game.smokes.push({ x: g.x, z: g.z, r: 3.5, t: 15 });
          g.done = true;
          continue;
        }
        if (g.type === 'molotov') {
          game.fires.push({ x: g.x, z: g.z, r: 2.6, t: 7, owner: game.player });
          sfx.fire();
          g.done = true;
          continue;
        }
        g.vy = Math.abs(g.vy) > 1.5 ? -g.vy * 0.35 : 0;
        g.vx *= 0.6; g.vz *= 0.6;
      }
      const [cx, cz] = collide(nx, nz, 0.1);
      if (cx !== nx) g.vx *= -0.4;
      if (cz !== nz) g.vz *= -0.4;
      g.x = cx; g.y = ny; g.z = cz;
      if (g.type === 'flash' && g.t >= g.fuse) { detonateFlash(g); g.done = true; }
      else if (g.type === 'he' && g.t >= g.fuse) { detonateHE(g); g.done = true; }
      else if (g.t > 3) g.done = true;
    }
    game.grenades = game.grenades.filter((g) => !g.done);
  }

  function updateHazards(dt) {
    for (const s of game.smokes) s.t -= dt;
    game.smokes = game.smokes.filter((s) => s.t > 0);
    const fireW = { name: 'Fire Flask', armorPen: 1, killReward: 300 };
    for (const f of game.fires) {
      f.t -= dt;
      for (const a of [game.player, ...game.bots]) {
        if (!a.alive) continue;
        if (Math.hypot(a.x - f.x, a.z - f.z) < f.r) applyDamage(a, 25 * dt, f.owner, fireW, false);
      }
    }
    game.fires = game.fires.filter((f) => f.t > 0);
    if (game.heBoom && performance.now() - game.heBoom.at > 700) game.heBoom = null;
  }

  // ---------- main step ----------
  game.step = (dt) => {
    game.now += dt;
    // Mouse wheel cycles owned weapons.
    const wd = input.takeWheel();
    if (wd && (game.phase === 'live' || game.phase === 'buy')) game.cycleWeapon(wd);
    // One-shot actions.
    const actions = input.takeActions();
    if (actions & 2) { // pause
      if (game.phase === 'live' || game.phase === 'buy') pauseGame();
      else if (game.phase === 'paused') resumeGame();
    }
    if (actions & 4) { // B: toggle buy menu
      if (game.phase === 'buy') { game.buyOpen = !game.buyOpen; sfx.click(); }
    }
    if (actions & 1) { // R: reload
      if (game.phase === 'live') startReload(game.player);
    }
    if (actions & 8) { // Enter: restart on match end
      if (game.phase === 'matchEnd') game.startMatch();
    }

    if (game.phase === 'menu' || game.phase === 'matchEnd') return;
    if (game.phase === 'paused') return;

    if (game.phase === 'buy') {
      game.phaseT -= dt;
      updatePlayer(dt);
      if (game.phaseT <= 0) {
        game.phase = 'live';
        game.roundT = TIMING.round;
        game.buyOpen = false;
        hud.banner('GO', game.playerTeam === 'atk' ? 'Plant the device' : 'Hold the sites', '#fff');
      }
      return;
    }
    if (game.phase === 'roundEnd') {
      game.phaseT -= dt;
      for (const b of game.bots) if (b.alive) updateBot(b, game, dt);
      if (game.phaseT <= 0) nextRound();
      return;
    }
    if (game.phase !== 'live') return;

    game.roundT -= dt;
    updatePlayer(dt);
    for (const b of game.bots) updateBot(b, game, dt);
    updateChannel(dt);
    updateDevice(dt);
    updateGrenades(dt);
    updateHazards(dt);

    // Spectate after death: a short deathcam, then follow a living teammate;
    // a click switches to the next living teammate.
    if (!game.player.alive) {
      if (game.now - game.player.deathT > 2.5 && game.player.spectateId === null) {
        const mate = game.bots.find((b) => b.team === game.playerTeam && b.alive);
        if (mate) game.player.spectateId = mate.id;
      }
      if (game.player.spectateId !== null) {
        const fire = input.takeFire();
        if (fire.pressed) {
          const mates = game.bots.filter((b) => b.team === game.playerTeam && b.alive);
          if (mates.length) {
            const i = mates.findIndex((b) => b.id === game.player.spectateId);
            game.player.spectateId = mates[(i + 1) % mates.length].id;
          }
        }
        const cur = game.bots.find((b) => b.id === game.player.spectateId);
        if (cur && !cur.alive) {
          const mate = game.bots.find((b) => b.team === game.playerTeam && b.alive);
          game.player.spectateId = mate ? mate.id : null;
        }
      }
    }

    // Dead bots fade out of the shootable set after 4 s (visual only; they stay dead).
    for (const b of game.bots) {
      if (b.dead && game.now - b.deadT > 4 && !b.cleared) { b.cleared = true; }
    }

    if (game.roundT <= 0 && !game.devicePlanted && game.phase === 'live') {
      endRound('def', 'Time expired — device never planted');
    }
  };

  function pauseGame() {
    if (game.phase === 'paused') return;
    game.prevPhase = game.phase;
    game.phase = 'paused';
    input.unlock();
    hud.screen('pauseScreen');
  }
  game.pause = pauseGame;
  function resumeGame() {
    game.phase = game.prevPhase;
    hud.screen(null);
    input.lock();
  }
  game.resume = resumeGame;

  // Digit keys: 1-5 buy / select weapons, 6 armor (buy) or knife (live),
  // 7 helmet / flash, 8 kit / smoke, 9 flash / HE, 0 smoke / molotov.
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const map = { Digit1: 'pistol', Digit2: 'smg', Digit3: 'rifle', Digit4: 'shotgun', Digit5: 'sniper' };
    if (map[event.code]) {
      if (game.phase === 'buy') game.buy(map[event.code]);
      else game.selectWeapon(map[event.code]);
    } else if (event.code === 'Digit6') {
      if (game.phase === 'buy') game.buy('armor');
      else game.selectWeapon('knife');
    } else if (event.code === 'Digit7') {
      if (game.phase === 'buy') game.buy('helmet');
      else game.throwGrenade('flash');
    } else if (event.code === 'Digit8') {
      if (game.phase === 'buy') game.buy('kit');
      else game.throwGrenade('smoke');
    } else if (event.code === 'Digit9') {
      if (game.phase === 'buy') game.buy('flash');
      else game.throwGrenade('he');
    } else if (event.code === 'Digit0') {
      if (game.phase === 'buy') game.buy('smoke');
      else game.throwGrenade('molotov');
    }
  });

  // Start screen wiring.
  document.getElementById('playBtn').addEventListener('click', () => {
    ensureAudio();
    sfx.click();
    game.startMatch();
    input.lock();
  });
  document.getElementById('resumeBtn').addEventListener('click', () => { sfx.click(); resumeGame(); });
  document.getElementById('restartBtn').addEventListener('click', () => { sfx.click(); game.startMatch(); input.lock(); });
  input.lock && document.getElementById('game').addEventListener('click', () => {
    if ((game.phase === 'live' || game.phase === 'buy') && !input.locked) input.lock();
  });

  return game;
}
