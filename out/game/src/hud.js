// DOM HUD and screens: health, armor, ammo, credits, timer, score, kill feed,
// crosshair, plant progress, buy menu, radar, scoreboard, scope and flash
// overlays, banners and the title / pause / match screens. Writes only touch
// the DOM when a value actually changes.
import { ARMOR_PRICE, GRENADES, HELMET_PRICE, KIT_PRICE, WEAPONS } from './config.js';
import { TEAMS } from './config.js';
import { calloutAt, losBlocked, MAP, SITES, SOLIDS } from './world.js';

function el(id) { return document.getElementById(id); }

export function createHud(onBuy) {
  const cache = {};
  function setText(id, value) {
    if (cache[id] !== value) { cache[id] = value; el(id).textContent = value; }
  }
  function setWidth(id, pct) {
    const key = id + ':w';
    if (cache[key] !== pct) { cache[key] = pct; el(id).style.width = pct + '%'; }
  }
  function show(id, on) {
    const key = id + ':s';
    if (cache[key] !== on) { cache[key] = on; el(id).classList.toggle('hidden', !on); }
  }

  // ---------- buy menu: categories, the buyer's own rifle, gear, grenades ----------
  const buyList = el('buyList');
  let lastBuyTeam = null;
  function buildBuyMenu(team) {
    buyList.innerHTML = '';
    lastBuyTeam = team;
    const rifleId = team === 'atk' ? 'rifleAtk' : 'rifleDef';
    const sections = [
      ['RIFLES', [rifleId, 'rifleScope']],
      ['SMG', ['smg']],
      ['SNIPER', ['sniper']],
      ['SHOTGUN', ['shotgun']],
      ['PISTOLS', ['heavy']],
      ['GEAR', ['armor', 'helmet', 'kit']],
      ['GRENADES', ['flash', 'smoke', 'he', 'molotov']],
    ];
    for (const [title, ids] of sections) {
      const h = document.createElement('div');
      h.className = 'buyCat';
      h.textContent = title;
      buyList.appendChild(h);
      for (const id of ids) {
        const btn = document.createElement('button');
        btn.className = 'buyItem';
        btn.dataset.weapon = id;
        let name, kind, price;
        if (id === 'armor') { name = 'Vest Plating'; kind = 'Armor +100'; price = ARMOR_PRICE; }
        else if (id === 'helmet') { name = 'Combat Helmet'; kind = 'Headshot x4 → x3'; price = HELMET_PRICE; }
        else if (id === 'kit') { name = 'Defuse Kit'; kind = 'Defuse 10s → 5s'; price = KIT_PRICE; }
        else if (GRENADES[id]) { name = GRENADES[id].name; kind = 'Grenade'; price = GRENADES[id].price; }
        else { const w = WEAPONS[id]; name = w.name; kind = w.kind; price = w.price; }
        btn.innerHTML = `<span class="buyName">${name}</span><span class="buyKind">${kind}</span><span class="buyPrice">$${price}</span>`;
        btn.addEventListener('click', () => onBuy(id));
        buyList.appendChild(btn);
      }
    }
  }
  buildBuyMenu('atk');

  // ---------- radar ----------
  const radar = el('radar');
  const rctx = radar.getContext('2d');
  function drawRadar(game) {
    const W = radar.width, H = radar.height;
    const s = Math.min(W / (MAP.x1 - MAP.x0), H / (MAP.z1 - MAP.z0));
    const ox = (W - (MAP.x1 - MAP.x0) * s) / 2, oy = (H - (MAP.z1 - MAP.z0) * s) / 2;
    const X = (x) => ox + (x - MAP.x0) * s;
    const Z = (z) => oy + (z - MAP.z0) * s;
    rctx.clearRect(0, 0, W, H);
    rctx.fillStyle = 'rgba(8,12,20,0.78)';
    rctx.fillRect(0, 0, W, H);
    for (const key of ['A', 'B']) {
      const site = SITES[key];
      rctx.fillStyle = key === 'A' ? 'rgba(255,140,26,0.25)' : 'rgba(47,157,255,0.25)';
      rctx.fillRect(X(site.x0), Z(site.z0), (site.x1 - site.x0) * s, (site.z1 - site.z0) * s);
      rctx.fillStyle = key === 'A' ? '#ff8c1a' : '#2f9dff';
      rctx.font = 'bold 11px system-ui';
      rctx.textAlign = 'center';
      rctx.fillText(key, X(site.cx), Z(site.cz) + 4);
    }
    for (const sol of SOLIDS) {
      rctx.fillStyle = sol.kind === 'wall' ? '#5a6270' : '#7d6c3e';
      rctx.fillRect(X(sol.x0), Z(sol.z0), Math.max(1, (sol.x1 - sol.x0) * s), Math.max(1, (sol.z1 - sol.z0) * s));
    }
    for (const sm of game.smokes || []) {
      rctx.fillStyle = 'rgba(180,190,200,0.5)';
      rctx.beginPath(); rctx.arc(X(sm.x), Z(sm.z), sm.r * s, 0, Math.PI * 2); rctx.fill();
    }
    if (game.devicePlanted && game.devicePos) {
      rctx.fillStyle = '#ff2222';
      rctx.beginPath(); rctx.arc(X(game.devicePos.x), Z(game.devicePos.z), 3.5, 0, Math.PI * 2); rctx.fill();
    }
    const p = game.player;
    // Enemies the player can actually see (no wall, no smoke between).
    for (const b of game.bots) {
      if (!b.alive || b.team === p.team) continue;
      if (losBlocked(p.x, p.z, b.x, b.z)) continue;
      if (game.smokeBlocks && game.smokeBlocks(p.x, p.z, b.x, b.z)) continue;
      rctx.fillStyle = '#ff5a4e';
      rctx.beginPath(); rctx.arc(X(b.x), Z(b.z), 3, 0, Math.PI * 2); rctx.fill();
    }
    for (const b of game.bots) {
      if (!b.alive || b.team !== p.team) continue;
      rctx.fillStyle = '#7dff8a';
      rctx.beginPath(); rctx.arc(X(b.x), Z(b.z), 3, 0, Math.PI * 2); rctx.fill();
    }
    if (p.alive) {
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
      const px = X(p.x), pz = Z(p.z);
      rctx.fillStyle = '#fff';
      rctx.beginPath();
      rctx.moveTo(px + fx * 7, pz + fz * 7);
      rctx.lineTo(px - fx * 4 - fz * 4, pz - fz * 4 + fx * 4);
      rctx.lineTo(px - fx * 4 + fz * 4, pz - fz * 4 - fx * 4);
      rctx.closePath(); rctx.fill();
    }
  }

  // ---------- scoreboard ----------
  function updateScoreboard(game) {
    const showSb = game.input.scoreboard() && ['live', 'buy', 'roundEnd', 'paused'].includes(game.phase);
    show('scoreboard', showSb);
    if (!showSb) return;
    const rows = (team) => {
      const actors = [game.player, ...game.bots].filter((a) => a.team === team);
      actors.sort((a, b) => b.kills - a.kills);
      return actors.map((a) => {
        const star = game.mvp && game.mvp.name === a.name ? ' ★' : '';
        return `<div class="sbRow"><span class="sbName" style="color:${TEAMS[team].css}">${a.name}${star}</span><span>${a.kills}</span><span>${a.deaths}</span><span>$${a.credits}</span></div>`;
      }).join('');
    };
    el('sbAtk').innerHTML = rows('atk');
    el('sbDef').innerHTML = rows('def');
    setText('sbMvp', game.mvp ? `★ MVP — ${game.mvp.name} · ${game.mvp.kills} eliminations this round` : '');
  }

  let feedTimer = null;
  function killfeed(killer, victim, weaponName, head) {
    const feed = el('killfeed');
    const row = document.createElement('div');
    row.className = 'feedRow';
    row.innerHTML = `<span style="color:${killer.color}">${killer.name}</span> <span class="feedWep">${head ? '◉ ' : ''}${weaponName}</span> <span style="color:${victim.color}">${victim.name}</span>`;
    feed.prepend(row);
    while (feed.children.length > 5) feed.removeChild(feed.lastChild);
    clearTimeout(feedTimer);
    feedTimer = setTimeout(() => { feed.innerHTML = ''; }, 9000);
  }

  let bannerTimer = null;
  function banner(main, sub, color) {
    setText('bannerMain', main);
    setText('bannerSub', sub || '');
    el('banner').style.color = color || '#fff';
    show('banner', true);
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => show('banner', false), 4200);
  }
  function hideBanner() {
    clearTimeout(bannerTimer);
    show('banner', false);
  }

  function hitmarker(head) {
    const hm = el('hitmarker');
    hm.classList.remove('show', 'head');
    void hm.offsetWidth; // restart the animation
    if (head) hm.classList.add('head');
    hm.classList.add('show');
  }

  function screen(name) {
    for (const s of ['startScreen', 'pauseScreen', 'matchScreen']) show(s, s === name);
    show('hud', name === null);
  }

  let lastFlash = -1;
  function update(game) {
    const p = game.player;
    const w = WEAPONS[p.weaponId];
    setText('healthNum', Math.ceil(p.hp));
    setWidth('healthFill', Math.max(0, p.hp));
    setText('armorNum', Math.ceil(p.armor) + (p.helmet ? ' ⛑' : ''));
    setWidth('armorFill', Math.max(0, p.armor));
    setText('ammoMag', w.melee ? '—' : p.mag);
    setText('ammoRes', w.melee ? '' : ' / ' + p.reserve);
    setText('weaponName', w.name);
    setText('credits', '$' + p.credits);
    setText('timer', game.timerText());
    const atkFirst = game.playerTeam === 'atk';
    const left = atkFirst ? game.score.atk : game.score.def;
    const right = atkFirst ? game.score.def : game.score.atk;
    setText('scoreLine', `${TEAMS[game.playerTeam].name} ${left} — ${right} ${TEAMS[game.playerTeam === 'atk' ? 'def' : 'atk'].name}`);
    setText('roundLine', `ROUND ${game.round} / ${game.maxRounds}`);
    // Dynamic crosshair: gap grows with movement, firing bloom and airtime,
    // tightens when crouched or scoped.
    const spread = 6 + p.moveFrac * 8 + p.recoil * 14 + (p.airborne ? 8 : 0) + (p.ads ? -4 : 0) + (p.crouch ? -2 : 0);
    el('crosshair').style.setProperty('--sp', Math.max(3, spread) + 'px');
    el('crosshair').classList.toggle('ads', !!p.ads);
    // Scope overlay replaces the crosshair on scoped weapons; the crosshair
    // is also hidden while dead.
    const scoped = p.ads && w.zoom;
    show('scope', scoped);
    el('crosshair').classList.toggle('hidden', scoped || !p.alive);
    // Flash blindness: white overlay, stronger while fully blind.
    const blind = Math.max(0, p.blindT || 0);
    const flashOp = blind > 0 ? Math.min(0.95, 0.25 + blind * 0.3) : 0;
    if (Math.abs(flashOp - lastFlash) > 0.05) {
      lastFlash = flashOp;
      el('flash').style.opacity = flashOp;
    }
    // Spectate label.
    const spec = !p.alive && p.spectateId !== null
      ? game.bots.find((b) => b.id === p.spectateId) : null;
    show('spectate', !p.alive);
    if (!p.alive) {
      setText('spectateText', spec ? `SPECTATING — ${spec.name} · click for the next teammate` : 'You are down — spectating starts shortly');
    }
    // Grenade counts.
    const g = p.grenades;
    setText('nades', `Flash ×${g.flash} · Smoke ×${g.smoke} · Frag ×${g.he} · Fire ×${g.molotov}`);
    // Plant / defuse progress.
    if (game.channel) {
      show('plantBar', true);
      setText('plantLabel', game.channel.label);
      setWidth('plantFill', Math.round(game.channel.frac * 100));
    } else show('plantBar', false);
    // Context hint.
    let hint = '';
    if (game.phase === 'buy') hint = 'Freeze time — buy with B or the keys, the round starts when the timer ends';
    else if (game.phase === 'live' && game.canPlantHere()) hint = 'Hold E to plant the device';
    else if (game.phase === 'live' && game.canDefuseHere()) hint = 'Hold E to defuse the device';
    else if (game.phase === 'live' && game.playerCarriesDevice) hint = 'You carry the device — plant it at Site A or Site B';
    else if (game.phase === 'live' && (g.flash + g.smoke + g.he + g.molotov) > 0) hint = '7 flash · 8 smoke · 9 frag · 0 fire — throw a grenade';
    setText('hint', hint);
    show('hint', hint !== '');
    // Device tag.
    show('deviceTag', game.playerCarriesDevice && game.phase !== 'menu');
    // Buy menu + affordability.
    const buyOpen = game.phase === 'buy' && game.buyOpen;
    show('buyMenu', buyOpen);
    if (buyOpen) {
      if (game.playerTeam !== lastBuyTeam) buildBuyMenu(game.playerTeam);
      for (const btn of buyList.children) {
        if (!btn.dataset || !btn.dataset.weapon) continue;
        const id = btn.dataset.weapon;
        let price, owned;
        if (id === 'armor') { price = ARMOR_PRICE; owned = p.armor >= 100; }
        else if (id === 'helmet') { price = HELMET_PRICE; owned = p.helmet; }
        else if (id === 'kit') { price = KIT_PRICE; owned = p.hasKit; }
        else if (GRENADES[id]) {
          price = GRENADES[id].price;
          owned = false;
          btn.querySelector('.buyKind').textContent = `Grenade ×${p.grenades[id]}`;
        } else { price = WEAPONS[id].price; owned = p.owned.has(id); }
        btn.classList.toggle('owned', owned);
        btn.classList.toggle('poor', !owned && p.credits < price);
      }
      setText('buyCredits', 'Credits: $' + p.credits);
    }
    // Alive counts.
    const atkAlive = game.bots.filter((b) => b.team === 'atk' && b.alive).length + (game.playerTeam === 'atk' && p.alive ? 1 : 0);
    const defAlive = game.bots.filter((b) => b.team === 'def' && b.alive).length + (game.playerTeam === 'def' && p.alive ? 1 : 0);
    setText('aliveLine', `● ${atkAlive}  EMBER   —   AEGIS  ${defAlive} ●`);
    setText('radarAlive', `EMBER ${'●'.repeat(atkAlive)}${'○'.repeat(5 - atkAlive)}  ·  AEGIS ${'●'.repeat(defAlive)}${'○'.repeat(5 - defAlive)}`);
    setText('callout', calloutAt(p.x, p.z));
    drawRadar(game);
    updateScoreboard(game);
  }

  return { update, killfeed, banner, hideBanner, hitmarker, screen };
}
