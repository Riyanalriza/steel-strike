// Steel Strike tuning: weapons, economy, timings. All names are original.
// Roles follow the classic tactical-FPS shape (fast SMG, heavy rifle, scoped
// sniper, heavy pistol, knife) without copying any existing game's arsenal.
export const STEP = 1 / 60;

export const WEAPONS = {
  knife: {
    id: 'knife', name: 'K-9 Fang', kind: 'Knife', price: 0,
    dmg: 40, rpm: 120, mag: 0, reserve: 0, pellets: 1, melee: true,
    spread: 0, auto: false, reload: 0, range: 2.1, kick: 0, zoom: false,
    speed: 5.9, armorPen: 1, killReward: 300,
  },
  pistol: {
    id: 'pistol', name: 'P-10 Falcon', kind: 'Pistol', price: 300,
    dmg: 26, rpm: 320, mag: 12, reserve: 36, pellets: 1,
    spread: 0.011, auto: false, reload: 1.1, range: 42, kick: 0.22, zoom: false,
    speed: 5.2, armorPen: 0.4, killReward: 300,
  },
  heavy: {
    id: 'heavy', name: 'H-50 Mammoth', kind: 'Heavy Pistol', price: 700,
    dmg: 53, rpm: 150, mag: 7, reserve: 21, pellets: 1,
    spread: 0.008, auto: false, reload: 1.7, range: 48, kick: 0.7, zoom: false,
    speed: 5.0, armorPen: 0.55, killReward: 300,
  },
  smg: {
    id: 'smg', name: 'SM-44 Dingo', kind: 'SMG', price: 1500,
    dmg: 22, rpm: 750, mag: 28, reserve: 84, pellets: 1,
    spread: 0.019, auto: true, reload: 1.6, range: 30, kick: 0.16, zoom: false,
    speed: 5.0, armorPen: 0.5, killReward: 600,
  },
  shotgun: {
    id: 'shotgun', name: 'SG-7 Thunderhead', kind: 'Shotgun', price: 1200,
    dmg: 9, rpm: 68, mag: 6, reserve: 24, pellets: 8,
    spread: 0.048, auto: false, reload: 2.4, range: 17, kick: 0.8, zoom: false,
    speed: 4.8, armorPen: 0.5, killReward: 900,
  },
  // Attacker rifle: heavy hits, one-tap headshot. Defender rifle: accurate,
  // medium damage. Each side buys only its own rifle.
  rifleAtk: {
    id: 'rifleAtk', name: 'AR-77 Mauler', kind: 'Rifle', price: 2700,
    dmg: 36, rpm: 600, mag: 30, reserve: 90, pellets: 1, team: 'atk',
    spread: 0.012, auto: true, reload: 2.2, range: 62, kick: 0.35, zoom: false,
    speed: 4.4, armorPen: 0.6, killReward: 300,
  },
  rifleDef: {
    id: 'rifleDef', name: 'CR-21 Warden', kind: 'Rifle', price: 2900,
    dmg: 30, rpm: 650, mag: 30, reserve: 90, pellets: 1, team: 'def',
    spread: 0.008, auto: true, reload: 2.0, range: 62, kick: 0.28, zoom: false,
    speed: 4.5, armorPen: 0.55, killReward: 300,
  },
  // Scoped marksman rifle: only scoped weapons may zoom (right-click).
  rifleScope: {
    id: 'rifleScope', name: 'DMR-9 Longbow', kind: 'Scoped Rifle', price: 4000,
    dmg: 85, rpm: 90, mag: 10, reserve: 20, pellets: 1,
    spread: 0.002, auto: false, reload: 2.8, range: 110, kick: 0.6, zoom: true,
    speed: 4.1, armorPen: 0.9, killReward: 300,
  },
  sniper: {
    id: 'sniper', name: 'SR-88 Deadeye', kind: 'Sniper', price: 4750,
    dmg: 110, rpm: 45, mag: 5, reserve: 15, pellets: 1,
    spread: 0.002, auto: false, reload: 2.9, range: 110, kick: 1.0, zoom: true,
    speed: 3.8, armorPen: 0.95, killReward: 100,
  },
};

// Headshot multiplier: x4 bare, x2 when the target wears a helmet.
export const HEADSHOT_MUL = 4;
export const HEADSHOT_MUL_HELMET = 3;

export const ARMOR_PRICE = 650;
export const ARMOR_MAX = 100;
export const HELMET_PRICE = 350;
export const KIT_PRICE = 400;

export const GRENADES = {
  flash: { id: 'flash', name: 'Flash Charge', price: 200 },
  smoke: { id: 'smoke', name: 'Smoke Canister', price: 300 },
  he: { id: 'he', name: 'Frag Charge', price: 300 },
  molotov: { id: 'molotov', name: 'Fire Flask', price: 400 },
};

export const ECON = {
  start: 800, win: 3250, plant: 300,
  // Loss bonus grows with consecutive lost rounds, capped at the 5th step.
  lossStreak: [1400, 1900, 2400, 2900, 3400],
};

export const TIMING = {
  buy: 5, round: 100, fuse: 40, plant: 3.2, defuse: 10, defuseKit: 5,
  halftimeRound: 12, winRounds: 13, maxRounds: 24, roundEnd: 5,
  // Overtime: 12-12 goes to first-to-16, max 30 rounds, then a draw.
  otWinRounds: 16, otMaxRounds: 30,
};

export const TEAMS = {
  atk: { key: 'atk', name: 'EMBER', color: 0xff8c1a, css: '#ff8c1a' },
  def: { key: 'def', name: 'AEGIS', color: 0x2f9dff, css: '#2f9dff' },
};

export const PLAYER = {
  hp: 100, eye: 1.62, eyeCrouch: 1.15, radius: 0.42,
  jump: 6.5, gravity: 13.5, fov: 74, adsFov: 52,
};
