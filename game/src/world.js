// Ironworks map: pure data and geometry. x east, z south, y up. All colliders are
// axis-aligned boxes {x0,z0,x1,z1,h}; walls are tall, crates are low cover.
// No three.js here: render.js turns this data into meshes.
export const MAP = { x0: -31, z0: -25, x1: 31, z1: 25 };

// kind: 'wall' (tall, blocks sight) or 'crate' (low cover, blocks movement only unless tall).
export const SOLIDS = [
  // Outer bounds.
  { x0: -31, z0: 24, x1: 31, z1: 25, h: 4, kind: 'wall' },
  { x0: -31, z0: -25, x1: 31, z1: -24, h: 4, kind: 'wall' },
  { x0: -31, z0: -25, x1: -30, z1: 25, h: 4, kind: 'wall' },
  { x0: 30, z0: -25, x1: 31, z1: 25, h: 4, kind: 'wall' },
  // Attacker-side wall with the mid entrance gap (x -4.5..4.5).
  { x0: -13, z0: 15, x1: -4.5, z1: 16, h: 3.4, kind: 'wall' },
  { x0: 4.5, z0: 15, x1: 13, z1: 16, h: 3.4, kind: 'wall' },
  // Mid corridor side walls, with the connector gaps at z 2..6.
  { x0: -5, z0: -6, x1: -4, z1: 2, h: 3.4, kind: 'wall' },
  { x0: -5, z0: 6, x1: -4, z1: 16, h: 3.4, kind: 'wall' },
  { x0: 4, z0: -6, x1: 5, z1: 2, h: 3.4, kind: 'wall' },
  { x0: 4, z0: 6, x1: 5, z1: 16, h: 3.4, kind: 'wall' },
  // Mid-north wall with the 4 m double-doors gap (x -2..2) and a jump window:
  // the x 6..8 stretch is only a 1.0 m sill — shoot over it, jump through it.
  { x0: -17, z0: -14, x1: -2, z1: -13, h: 3.4, kind: 'wall' },
  { x0: 2, z0: -14, x1: 6, z1: -13, h: 3.4, kind: 'wall' },
  { x0: 6, z0: -14, x1: 8, z1: -13, h: 1.0, kind: 'wall' },
  { x0: 8, z0: -14, x1: 17, z1: -13, h: 3.4, kind: 'wall' },
  // West lane east wall, connector gap z 2..6.
  { x0: -19, z0: -6, x1: -18, z1: 2, h: 3.4, kind: 'wall' },
  { x0: -19, z0: 6, x1: -18, z1: 16, h: 3.4, kind: 'wall' },
  // East lane west wall, connector gap z 2..6.
  { x0: 18, z0: -6, x1: 19, z1: 2, h: 3.4, kind: 'wall' },
  { x0: 18, z0: 6, x1: 19, z1: 16, h: 3.4, kind: 'wall' },
  // Site A (Furnace Hall) south + east walls, gaps at x -24..-21 and z -11..-8.
  { x0: -27, z0: -6, x1: -24, z1: -5, h: 3.4, kind: 'wall' },
  { x0: -21, z0: -6, x1: -17, z1: -5, h: 3.4, kind: 'wall' },
  { x0: -18, z0: -15, x1: -17, z1: -11, h: 3.4, kind: 'wall' },
  { x0: -18, z0: -8, x1: -17, z1: -5, h: 3.4, kind: 'wall' },
  // Site B (Crane Yard) south + west walls, gaps at x 21..24 and z -11..-8.
  { x0: 17, z0: -6, x1: 21, z1: -5, h: 3.4, kind: 'wall' },
  { x0: 24, z0: -6, x1: 27, z1: -5, h: 3.4, kind: 'wall' },
  { x0: 17, z0: -15, x1: 18, z1: -11, h: 3.4, kind: 'wall' },
  { x0: 17, z0: -8, x1: 18, z1: -5, h: 3.4, kind: 'wall' },
  // Crates and blocks (cover). Tall ones (h 2.4) block sight lines too.
  // Mid crate sits east of the corridor's centre line: the waypoint line down
  // mid (x=0) must never run through the middle of a crate, or a bot steering
  // straight at it presses against the face forever with no lateral slide.
  { x0: 2, z0: 9, x1: 4, z1: 11, h: 1.2, kind: 'crate' },
  { x0: -3, z0: -1, x1: -1, z1: 1, h: 1.2, kind: 'crate' },
  { x0: 1, z0: -9, x1: 3, z1: -7, h: 2.4, kind: 'crate' },
  { x0: -13, z0: 3, x1: -11, z1: 5, h: 1.2, kind: 'crate' },
  { x0: 11, z0: 3, x1: 13, z1: 5, h: 1.2, kind: 'crate' },
  { x0: -24, z0: 9, x1: -22, z1: 11, h: 1.2, kind: 'crate' },
  { x0: -24, z0: -3, x1: -22.5, z1: -1.5, h: 1.2, kind: 'crate' },
  { x0: 22, z0: 9, x1: 24, z1: 11, h: 1.2, kind: 'crate' },
  { x0: 22.5, z0: -3, x1: 24, z1: -1.5, h: 1.2, kind: 'crate' },
  { x0: -25, z0: -12.8, x1: -23, z1: -11.2, h: 1.2, kind: 'crate' },
  { x0: -20.8, z0: -8.2, x1: -19.2, z1: -6.8, h: 2.4, kind: 'crate' },
  { x0: 23, z0: -12.8, x1: 25, z1: -11.2, h: 1.2, kind: 'crate' },
  { x0: 19.2, z0: -8.2, x1: 20.8, z1: -6.8, h: 2.4, kind: 'crate' },
  { x0: -11, z0: -10, x1: -9, z1: -8, h: 1.2, kind: 'crate' },
  { x0: 9, z0: -10, x1: 11, z1: -8, h: 1.2, kind: 'crate' },
  { x0: -1.5, z0: -6.5, x1: 1.5, z1: -5.5, h: 1.2, kind: 'crate' },
  { x0: -16, z0: 18, x1: -14, z1: 20, h: 1.2, kind: 'crate' },
  { x0: 14, z0: 18, x1: 16, z1: 20, h: 1.2, kind: 'crate' },
  { x0: -9, z0: -12, x1: -7, z1: -10, h: 2.4, kind: 'crate' },
  { x0: 7, z0: -12, x1: 9, z1: -10, h: 2.4, kind: 'crate' },
  // Lane hold corners: low cover mid-lane on each side.
  { x0: -26, z0: 2, x1: -24, z1: 4, h: 1.2, kind: 'crate' },
  { x0: 24, z0: 2, x1: 26, z1: 4, h: 1.2, kind: 'crate' },
  // Boost stack in mid: jump the 1.0 m step, then the 2.0 m block, to see
  // over the low crates. (Needs height-aware collision — see collide/groundAt.)
  { x0: -3, z0: 6, x1: -1, z1: 7.5, h: 1.0, kind: 'crate' },
  { x0: -3, z0: 8, x1: -1, z1: 10, h: 2.0, kind: 'crate' },
  // Barrels (cylinders), sandbags and site containers: visual cover with real
  // collision. All sit off the bot waypoint lines (checked vs NODES/EDGES).
  { x0: -30.2, z0: 17.4, x1: -29.3, z1: 18.3, h: 1.05, kind: 'crate', shape: 'cyl' },
  { x0: 29.3, z0: 17.4, x1: 30.2, z1: 18.3, h: 1.05, kind: 'crate', shape: 'cyl' },
  { x0: -30.2, z0: -20.6, x1: -29.3, z1: -19.7, h: 1.05, kind: 'crate', shape: 'cyl' },
  { x0: 29.3, z0: -20.6, x1: 30.2, z1: -19.7, h: 1.05, kind: 'crate', shape: 'cyl' },
  { x0: -17.2, z0: -12.6, x1: -16.3, z1: -11.7, h: 1.05, kind: 'crate', shape: 'cyl' },
  { x0: 16.3, z0: -12.6, x1: 17.2, z1: -11.7, h: 1.05, kind: 'crate', shape: 'cyl' },
  { x0: -26.3, z0: -7.4, x1: -24.7, z1: -6.6, h: 0.8, kind: 'crate', tex: 'sand' },
  { x0: 24.7, z0: -7.4, x1: 26.3, z1: -6.6, h: 0.8, kind: 'crate', tex: 'sand' },
  { x0: 20, z0: -24.6, x1: 24, z1: -22.8, h: 2.4, kind: 'crate', tex: 'contB' },
  { x0: -24, z0: -24.6, x1: -20, z1: -22.8, h: 2.4, kind: 'crate', tex: 'contA' },
];

export const SITES = {
  A: { key: 'A', name: 'Furnace Hall', cx: -22, cz: -10, x0: -27, z0: -15, x1: -17, z1: -5 },
  B: { key: 'B', name: 'Crane Yard', cx: 22, cz: -10, x0: 17, z0: -15, x1: 27, z1: -5 },
};

// Callouts: original names for the classic-structure routes (A Long / A Short /
// Mid / B Tunnels / sites), shown on the radar and under it. First match wins,
// so sites and the doors are listed before the big zones that contain them.
export const CALLOUTS = [
  { name: 'Furnace Hall', x0: -27, z0: -15, x1: -17, z1: -4 },
  { name: 'Crane Yard', x0: 17, z0: -15, x1: 27, z1: -4 },
  { name: 'Iron Doors', x0: -4, z0: -14.5, x1: 4, z1: -12.5 },
  { name: 'Furnace Long', x0: -29, z0: 5, x1: -18, z1: 20 },
  { name: 'Crane Tunnel', x0: 18, z0: 5, x1: 29, z1: 20 },
  { name: 'Furnace Short', x0: -19, z0: 1, x1: -4, z1: 7 },
  { name: 'Crane Short', x0: 4, z0: 1, x1: 19, z1: 7 },
  { name: 'Foundry Mid', x0: -5, z0: -13, x1: 5, z1: 15 },
  { name: 'Iron Plaza', x0: -17, z0: -21, x1: 17, z1: -13 },
  { name: 'Ember Yard', x0: -13, z0: 16, x1: 13, z1: 24 },
  { name: 'Aegis Yard', x0: -17, z0: -24, x1: 17, z1: -21 },
];

export function calloutAt(x, z) {
  for (const c of CALLOUTS) {
    if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1) return c.name;
  }
  return 'Ironworks';
}

export const SPAWNS = {
  atk: [
    { x: -6, z: 21, yaw: 0 }, { x: -3, z: 21, yaw: 0 }, { x: 0, z: 21, yaw: 0 },
    { x: 3, z: 21, yaw: 0 }, { x: 6, z: 21, yaw: 0 },
  ],
  def: [
    { x: -12, z: -20, yaw: Math.PI }, { x: -6, z: -20, yaw: Math.PI },
    { x: 0, z: -20, yaw: Math.PI }, { x: 6, z: -20, yaw: Math.PI },
    { x: 12, z: -20, yaw: Math.PI },
  ],
};

// Waypoint graph for bot pathfinding (BFS). Nodes: [x, z].
export const NODES = [
  [0, 20], [0, 12], [0, 4], [0, -10], [-23, 12], [-23, 4], [-23, -3], [-22, -10],
  [23, 12], [23, 4], [23, -3], [22, -10], [-11, 4], [11, 4], [-11, -9], [11, -9],
  [0, -8], [-10, -20], [10, -20], [0, -20], [-19.5, -9.5], [19.5, -9.5],
  [-11, -2], [11, -2],
  // Lane mouths south of the attacker-side wall, so no edge ever crosses a wall:
  // spawn -> yard node -> lane mouth -> lane, instead of straight across the wall.
  [15, 18], [-15, 18], [23, 17], [-23, 17],
];
export const EDGES = [
  [1, 2], [2, 12], [2, 13], [2, 3], [3, 16], [3, 14],
  [3, 15], [4, 5], [5, 6], [6, 7], [5, 12], [8, 9], [9, 10], [10, 11], [9, 13],
  [12, 22], [13, 23], [22, 14], [23, 15], [14, 16], [15, 16], [14, 20], [15, 21],
  [20, 7], [21, 11], [16, 19], [17, 19], [18, 19],
  [22, 3], [23, 3],
  [0, 1], [0, 24], [0, 25], [24, 26], [25, 27], [26, 8], [27, 4],
];
const ADJ = NODES.map(() => []);
for (const [a, b] of EDGES) { ADJ[a].push(b); ADJ[b].push(a); }

export function nearestNode(x, z) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < NODES.length; i++) {
    const dx = NODES[i][0] - x, dz = NODES[i][1] - z, d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// BFS path of node indices from (x,z) to (tx,tz); empty when already there.
export function findPath(x, z, tx, tz) {
  const start = nearestNode(x, z), goal = nearestNode(tx, tz);
  if (start === goal) return [];
  const prev = new Array(NODES.length).fill(-1);
  const queue = [start];
  prev[start] = start;
  while (queue.length) {
    const cur = queue.shift();
    if (cur === goal) break;
    for (const nb of ADJ[cur]) {
      if (prev[nb] === -1) { prev[nb] = cur; queue.push(nb); }
    }
  }
  if (prev[goal] === -1) return [];
  const path = [];
  let cur = goal;
  while (cur !== start) { path.unshift(cur); cur = prev[cur]; }
  return path;
}

// Circle (x,z,r) vs every solid: push out, axis by axis, so movement slides along walls.
// Height-aware: a solid no taller than the mover's feet (plus a small step-up
// margin) does not block at all — that is what makes crates jumpable and the
// window sill crossable mid-jump. Bots never jump, so they pass feetY 0.
export function collide(x, z, r, feetY = 0) {
  for (let pass = 0; pass < 2; pass++) {
    for (const s of SOLIDS) {
      if (s.h <= feetY + 0.05) continue;
      if (x + r > s.x0 && x - r < s.x1 && z + r > s.z0 && z - r < s.z1) {
        const pushL = (x + r) - s.x0, pushR = s.x1 - (x - r);
        const pushU = (z + r) - s.z0, pushD = s.z1 - (z - r);
        const m = Math.min(pushL, pushR, pushU, pushD);
        if (m === pushL) x = s.x0 - r;
        else if (m === pushR) x = s.x1 + r;
        else if (m === pushU) z = s.z0 - r;
        else z = s.z1 + r;
      }
    }
  }
  x = Math.min(MAP.x1 - r, Math.max(MAP.x0 + r, x));
  z = Math.min(MAP.z1 - r, Math.max(MAP.z0 + r, z));
  return [x, z];
}

// Highest solid top at or below `below` whose XZ contains (x,z) — the floor a
// falling player would land on. Returns 0 for the map floor.
export function groundAt(x, z, below) {
  let best = 0;
  for (const s of SOLIDS) {
    if (s.h <= below + 0.02 && s.h > best && x > s.x0 - 0.1 && x < s.x1 + 0.1 && z > s.z0 - 0.1 && z < s.z1 + 0.1) {
      best = s.h;
    }
  }
  return best;
}

// 2D segment vs a solid's XZ rectangle (slab test).
function segHitsBox(x0, z0, x1, z1, b) {
  const dx = x1 - x0, dz = z1 - z0;
  let tmin = 0, tmax = 1;
  if (Math.abs(dx) < 1e-9) { if (x0 < b.x0 || x0 > b.x1) return false; }
  else {
    let t1 = (b.x0 - x0) / dx, t2 = (b.x1 - x0) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dz) < 1e-9) { if (z0 < b.z0 || z0 > b.z1) return false; }
  else {
    let t1 = (b.z0 - z0) / dz, t2 = (b.z1 - z0) / dz;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

// True when a tall solid (wall or tall crate) stands between the two points.
export function losBlocked(x0, z0, x1, z1) {
  for (const s of SOLIDS) {
    if (s.h < 2.0) continue;
    if (segHitsBox(x0, z0, x1, z1, s)) return true;
  }
  return false;
}

export function siteAt(x, z) {
  for (const key of ['A', 'B']) {
    const s = SITES[key];
    if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) return key;
  }
  return null;
}
