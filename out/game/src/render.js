// Three.js drawing only: the scene, the Ironworks meshes, bot bodies, the player's
// viewmodel, tracers, flashes and the planted device. No rules live here; game.js
// owns state and calls update() + raycast() each frame.
import * as THREE from 'three';
import { MAP, SITES, SOLIDS, calloutAt } from './world.js';
import { TEAMS, WEAPONS } from './config.js';

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function floorTexture(rng) {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#363c46'; g.fillRect(0, 0, s, s);
    g.strokeStyle = '#414954'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, s); g.stroke();
      g.beginPath(); g.moveTo(0, i * 64); g.lineTo(s, i * 64); g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 300; i++) g.fillRect(rng() * s, rng() * s, 2, 2);
  });
}

function letterTexture(letter, color) {
  return canvasTexture(256, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.fillStyle = color;
    g.font = 'bold 190px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(letter, s / 2, s / 2 + 8);
  });
}

// Panelled metal wall: base + seams + rivets + stains. One canvas per zone;
// the SOLIDS loop clones it and repeats by wall size so panels stay ~2 m.
function wallTexture(rng, base, seam, grime) {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    g.strokeStyle = seam; g.lineWidth = 3;
    for (let i = 0; i <= 2; i++) {
      g.beginPath(); g.moveTo(0, i * 128); g.lineTo(s, i * 128); g.stroke();
      g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, s); g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      g.beginPath(); g.arc(x * 128 + 10, y * 128 + 10, 3, 0, 7); g.fill();
      g.beginPath(); g.arc(x * 128 + 118, y * 128 + 118, 3, 0, 7); g.fill();
    }
    g.fillStyle = grime;
    for (let i = 0; i < 26; i++) {
      const w = 6 + rng() * 30, h = 4 + rng() * 14;
      g.fillRect(rng() * s, rng() * s, w, h);
    }
    g.fillStyle = 'rgba(255,255,255,0.04)';
    for (let i = 0; i < 120; i++) g.fillRect(rng() * s, rng() * s, 2, 2);
  });
}

// Crate face: wood planks or ribbed metal with a frame and a stencil label.
function crateTexture(rng, kind, label) {
  return canvasTexture(256, (g, s) => {
    if (kind === 'wood') {
      g.fillStyle = '#8a6f3e'; g.fillRect(0, 0, s, s);
      g.strokeStyle = '#4a3a20'; g.lineWidth = 5;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * 64); g.lineTo(s, i * 64); g.stroke(); }
      g.beginPath(); g.moveTo(s / 2, 0); g.lineTo(s / 2, s); g.stroke();
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = 0; i < 40; i++) g.fillRect(rng() * s, rng() * s, 8, 2);
    } else {
      g.fillStyle = '#5d6a72'; g.fillRect(0, 0, s, s);
      g.fillStyle = '#4a545c';
      for (let i = 0; i < 8; i++) g.fillRect(i * 32 + 4, 0, 14, s);
      g.fillStyle = 'rgba(0,0,0,0.2)';
      for (let i = 0; i < 20; i++) g.fillRect(rng() * s, rng() * s, 10, 4);
    }
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 10; g.strokeRect(5, 5, s - 10, s - 10);
    if (label) {
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.font = 'bold 34px system-ui, sans-serif'; g.textAlign = 'center';
      g.fillText(label, s / 2, s / 2 + 12);
    }
  });
}

function sandTexture(rng) {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#a08c5e'; g.fillRect(0, 0, s, s);
    g.strokeStyle = '#7d6c44'; g.lineWidth = 4;
    for (let i = 0; i <= 3; i++) { g.beginPath(); g.moveTo(0, i * 64 + 32); g.lineTo(s, i * 64 + 32); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i < 160; i++) g.fillRect(rng() * s, rng() * s, 3, 2);
  });
}

function ventTexture() {
  return canvasTexture(128, (g, s) => {
    g.fillStyle = '#22252a'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#0c0e11';
    for (let i = 0; i < 5; i++) g.fillRect(10, 14 + i * 22, s - 20, 10);
    g.strokeStyle = '#3a3f47'; g.lineWidth = 4; g.strokeRect(2, 2, s - 4, s - 4);
  });
}

function signTexture(text, color) {
  return canvasTexture(512, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.fillStyle = 'rgba(10,12,16,0.85)'; g.fillRect(0, s * 0.28, s, s * 0.44);
    g.fillStyle = color; g.font = 'bold 64px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, s / 2, s / 2);
  });
}

function flashTexture() {
  return canvasTexture(128, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,230,1)');
    r.addColorStop(0.35, 'rgba(255,190,80,0.9)');
    r.addColorStop(1, 'rgba(255,120,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  });
}


export function createRenderer(canvas, rng) {
  // rng seeds the floor speckle so the same seed renders the same texture.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1420);
  scene.fog = new THREE.Fog(0x0d1420, 35, 100);
  const camera = new THREE.PerspectiveCamera(74, 1, 0.08, 200);
  camera.rotation.order = 'YXZ';

  scene.add(new THREE.HemisphereLight(0xa8bdd6, 0x3a3226, 1.7));
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.9);
  sun.position.set(20, 32, 12);
  scene.add(sun);
  // Area fill lights: warm at the furnace, cool at the crane yard, neutral
  // over mid — so no corner of the map reads as a black hole.
  const midLight = new THREE.PointLight(0xffe0b3, 14, 24, 1.6);
  midLight.position.set(0, 3.5, 4);
  scene.add(midLight);
  const plazaLight = new THREE.PointLight(0x9db8d6, 9, 20, 1.6);
  plazaLight.position.set(0, 3, -18);
  scene.add(plazaLight);

  // Floor.
  const floorTex = floorTexture(rng || Math.random);
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(16, 13);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP.x1 - MAP.x0, MAP.z1 - MAP.z0),
    new THREE.MeshLambertMaterial({ map: floorTex }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0);
  scene.add(floor);

  // Walls and crates from the map data. Walls get a panelled texture by zone
  // (warm at the furnace, cool at the crane yard, neutral mid); crates get
  // wood or ribbed metal with a stencil label; barrels are cylinders.
  const shootables = [];
  const wallTexA = wallTexture(rng || Math.random, '#6a5f52', '#453d33', 'rgba(255,90,0,0.06)');
  const wallTexB = wallTexture(rng || Math.random, '#4d5a66', '#333d45', 'rgba(40,90,140,0.12)');
  const wallTexN = wallTexture(rng || Math.random, '#565c66', '#3a3f47', 'rgba(0,0,0,0.18)');
  const crateTexWood = crateTexture(rng || Math.random, 'wood', 'IW-7');
  const crateTexMetal = crateTexture(rng || Math.random, 'metal', 'FE-3');
  const crateTexContA = crateTexture(rng || Math.random, 'metal', 'A-22');
  const crateTexContB = crateTexture(rng || Math.random, 'metal', 'B-22');
  const sandTex = sandTexture(rng || Math.random);
  function texFor(s, w, d) {
    let t;
    if (s.tex === 'sand') t = sandTex;
    else if (s.tex === 'contA') t = crateTexContA;
    else if (s.tex === 'contB') t = crateTexContB;
    else if (s.shape === 'cyl') t = crateTexMetal;
    else if (s.kind === 'crate') t = s.h >= 2.4 ? crateTexMetal : crateTexWood;
    else {
      const zone = calloutAt((s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2);
      t = zone === 'Furnace Hall' ? wallTexA : zone === 'Crane Yard' ? wallTexB : wallTexN;
    }
    t = t.clone();
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(Math.max(1, Math.round(Math.max(w, d) / 3)), Math.max(1, Math.round(s.h / (s.kind === 'crate' ? 1.5 : 2.5))));
    return t;
  }
  SOLIDS.forEach((s) => {
    const w = s.x1 - s.x0, d = s.z1 - s.z0;
    const mat = new THREE.MeshLambertMaterial({ map: texFor(s, w, d) });
    let mesh;
    if (s.shape === 'cyl') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) / 2, Math.min(w, d) / 2, s.h, 14), mat);
      // Hazard band around the barrel's middle.
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(Math.min(w, d) / 2 + 0.005, Math.min(w, d) / 2 + 0.005, 0.14, 14),
        new THREE.MeshLambertMaterial({ color: 0xc9a227 }),
      );
      band.position.set((s.x0 + s.x1) / 2, s.h * 0.62, (s.z0 + s.z1) / 2);
      scene.add(band);
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(w, s.h, d), mat);
    }
    mesh.position.set((s.x0 + s.x1) / 2, s.h / 2, (s.z0 + s.z1) / 2);
    mesh.userData.wall = true;
    scene.add(mesh);
    shootables.push(mesh);
  });

  // Site markers: floating letter + floor tint + a light each.
  for (const key of ['A', 'B']) {
    const site = SITES[key];
    const color = key === 'A' ? '#ff8c1a' : '#2f9dff';
    const letter = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 4.4),
      new THREE.MeshBasicMaterial({ map: letterTexture(key, color), transparent: true, side: THREE.DoubleSide }),
    );
    letter.position.set(site.cx, 4.2, site.cz);
    scene.add(letter);
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(site.x1 - site.x0, site.z1 - site.z0),
      new THREE.MeshBasicMaterial({ color: key === 'A' ? 0xff8c1a : 0x2f9dff, transparent: true, opacity: 0.14 }),
    );
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(site.cx, 0.02, site.cz);
    scene.add(decal);
  }
  // Furnace glow at Site A, crane frame at Site B.
  const furnace = new THREE.Mesh(
    new THREE.BoxGeometry(3, 2.2, 1.2),
    new THREE.MeshLambertMaterial({ color: 0x3a3a3a, emissive: 0xff5a00, emissiveIntensity: 0.9 }),
  );
  furnace.position.set(-26.4, 1.1, -14.4);
  scene.add(furnace);
  // Ember strip + glowing coals at the furnace mouth, chimney pipe above.
  const ember = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.18, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a, emissive: 0xff6a00, emissiveIntensity: 1.6 }),
  );
  ember.position.set(-26.4, 0.25, -13.6);
  scene.add(ember);
  const coalMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a, emissive: 0xff4400, emissiveIntensity: 1.2 });
  for (const [cx, cz] of [[-27.1, -13.4], [-26.4, -13.3], [-25.7, -13.5]]) {
    const coal = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), coalMat);
    coal.position.set(cx, 0.12, cz);
    scene.add(coal);
  }
  const chimney = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 2.2, 10),
    new THREE.MeshLambertMaterial({ color: 0x4a4038 }),
  );
  chimney.position.set(-26.4, 3.2, -14.4);
  scene.add(chimney);
  const furnaceLight = new THREE.PointLight(0xff6a00, 26, 22, 1.6);
  furnaceLight.position.set(-25, 2.5, -13);
  scene.add(furnaceLight);
  // Crane frame at Site B, with a hook, cable and a suspended container.
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xc9a227 });
  const craneBase = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 1), craneMat);
  craneBase.position.set(26, 2.5, -14);
  scene.add(craneBase);
  const craneArm = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 0.5), craneMat);
  craneArm.position.set(23, 4.8, -14);
  scene.add(craneArm);
  const craneCable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  craneCable.position.set(20.5, 3.8, -14);
  scene.add(craneCable);
  const hangBox = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.2, 1.2),
    new THREE.MeshLambertMaterial({ map: crateTexMetal }),
  );
  hangBox.position.set(20.5, 2.4, -14);
  scene.add(hangBox);
  const craneLight = new THREE.PointLight(0x66aaff, 16, 18, 1.6);
  craneLight.position.set(22, 3, -12);
  scene.add(craneLight);

  // Wall pipes (above head height), vents, lamps and area signs.
  const pipeMat = new THREE.MeshLambertMaterial({ color: 0x5a5f66 });
  const hotPipeMat = new THREE.MeshLambertMaterial({ color: 0x6b4a30, emissive: 0xff5a00, emissiveIntensity: 0.35 });
  function pipe(x, y, z, len, alongX, mat) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, len, 8), mat || pipeMat);
    if (alongX) m.rotation.z = Math.PI / 2; else m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  }
  pipe(0, 3.0, -13.1, 30, true);            // along the mid-north wall
  pipe(-26.5, 2.9, -6.5, 9, false, hotPipeMat); // hot pipe down Furnace Hall
  pipe(23.5, 2.9, -6.5, 9, false);          // pipe down Crane Yard
  pipe(0, 3.0, 15.2, 24, true);             // along the attacker-side wall
  const ventMat = new THREE.MeshLambertMaterial({ map: ventTexture() });
  for (const [vx, vy, vz, ry] of [[-4.5, 2.3, -5.9, 0], [17.5, 2.3, -5.9, 0], [-17.5, 2.3, -5.9, 0], [0, 2.3, 14.9, Math.PI]]) {
    const vent = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), ventMat);
    vent.position.set(vx, vy, vz);
    vent.rotation.y = ry;
    scene.add(vent);
  }
  // Warm wall lamps with light pools at the doors and lane mouths.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x333333, emissive: 0xffd27a, emissiveIntensity: 1.4 });
  for (const [lx, lz] of [[-2.6, -13.2], [2.6, -13.2], [-18.4, 0.6], [18.4, 0.6]]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.1), lampMat);
    lamp.position.set(lx, 2.6, lz);
    scene.add(lamp);
    const pool = new THREE.PointLight(0xffd27a, 5, 9, 1.8);
    pool.position.set(lx, 2.4, lz + (lz < 0 ? 0.6 : -0.6));
    scene.add(pool);
  }
  // Area signs over the site entrances.
  function sign(x, y, z, text, color) {
    const s = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 3),
      new THREE.MeshBasicMaterial({ map: signTexture(text, color), transparent: true }),
    );
    s.position.set(x, y, z);
    scene.add(s);
  }
  sign(-22.5, 3.1, -5.3, 'A · FURNACE HALL', '#ff8c1a');
  sign(22.5, 3.1, -5.3, 'B · CRANE YARD', '#2f9dff');

  // Iron Doors frame (visual only) and roof beams over Crane Tunnel.
  const propMat = new THREE.MeshLambertMaterial({ color: 0x3a3f47 });
  for (const x of [-2.15, 2.15]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, 0.5), propMat);
    post.position.set(x, 1.7, -13.5);
    scene.add(post);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.6, 0.5), propMat);
  lintel.position.set(0, 3.1, -13.5);
  scene.add(lintel);
  const beamMat = new THREE.MeshLambertMaterial({ color: 0x4a4030 });
  for (const z of [8, 12, 16]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(9, 0.3, 0.6), beamMat);
    beam.position.set(23.5, 3.0, z);
    scene.add(beam);
  }

  // Player viewmodel: one distinct shape per weapon, built from part specs
  // [w,h,d, x,y,z, color, rotX, cyl?]; plus two gloved hands and a flash quad.
  const gun = new THREE.Group();
  function vmPart(a) {
    const [w, h, d, x, y, z, c, rx, cyl] = a;
    let m;
    if (cyl) {
      m = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, d, 8), new THREE.MeshLambertMaterial({ color: c }));
      m.rotation.x = Math.PI / 2;
    } else {
      m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c }));
    }
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    return m;
  }
  function vmHand(x, y, z) {
    const g = new THREE.Group();
    const glove = new THREE.MeshLambertMaterial({ color: 0x9a8a6a });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.07), glove));
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.08, 0.055), glove);
    fin.position.set(0, -0.015, -0.05);
    g.add(fin);
    g.position.set(x, y, z);
    return g;
  }
  const VM_SPECS = {
    pistol: { tip: -0.24, gripZ: 0.02, parts: [
      [0.07, 0.08, 0.26, 0, 0.03, -0.08, 0x3a4048], [0.06, 0.15, 0.08, 0, -0.08, 0.04, 0x2c2f34, 0.28],
      [0.02, 0.03, 0.03, 0, 0.085, -0.18, 0x1a1c20]] },
    heavy: { tip: -0.36, gripZ: 0.02, parts: [
      [0.08, 0.09, 0.32, 0, 0.03, -0.1, 0x4a4f57], [0.03, 0.03, 0.1, 0, 0.03, -0.3, 0x8a8f96, 0, 1],
      [0.07, 0.16, 0.09, 0, -0.09, 0.04, 0x2c2f34, 0.28]] },
    smg: { tip: -0.4, gripZ: -0.24, parts: [
      [0.08, 0.12, 0.32, 0, 0.02, -0.06, 0x3a4048], [0.05, 0.17, 0.07, 0, -0.13, -0.04, 0x2c2f34],
      [0.06, 0.08, 0.12, 0, 0.01, 0.2, 0x2c2f34], [0.035, 0.035, 0.16, 0, 0.03, -0.3, 0x22252a, 0, 1],
      [0.02, 0.03, 0.03, 0, 0.085, -0.16, 0x1a1c20]] },
    shotgun: { tip: -0.5, gripZ: -0.28, parts: [
      [0.09, 0.13, 0.38, 0, 0.02, -0.04, 0x3a4048], [0.035, 0.035, 0.42, 0, 0.05, -0.28, 0x2c2f34, 0, 1],
      [0.028, 0.028, 0.4, 0, -0.03, -0.27, 0x4a4f57, 0, 1], [0.09, 0.07, 0.14, 0, -0.06, -0.28, 0x6b4a2a],
      [0.07, 0.11, 0.16, 0, 0.0, 0.24, 0x6b4a2a]] },
    rifleAtk: { tip: -0.64, gripZ: -0.3, parts: [
      [0.09, 0.13, 0.46, 0, 0.02, -0.06, 0x3a4048], [0.02, 0.02, 0.38, 0, 0.03, -0.44, 0x2c2f34, 0, 1],
      [0.06, 0.15, 0.09, 0, -0.12, 0.0, 0x2c2f34, 0.35], [0.06, 0.1, 0.08, 0, -0.19, 0.06, 0x2c2f34, 0.55],
      [0.07, 0.11, 0.18, 0, 0.01, 0.28, 0x6b4a2a], [0.06, 0.12, 0.07, 0, -0.09, 0.1, 0x6b4a2a, 0.3],
      [0.08, 0.1, 0.2, 0, 0.01, -0.3, 0x4a4030], [0.02, 0.06, 0.02, 0, 0.1, -0.42, 0x1a1c20]] },
    rifleDef: { tip: -0.6, gripZ: -0.28, parts: [
      [0.09, 0.12, 0.44, 0, 0.02, -0.06, 0x3a4048], [0.02, 0.02, 0.34, 0, 0.03, -0.42, 0x2c2f34, 0, 1],
      [0.06, 0.16, 0.08, 0, -0.13, -0.02, 0x2c2f34], [0.07, 0.1, 0.16, 0, 0.01, 0.26, 0x2c2f34],
      [0.06, 0.11, 0.07, 0, -0.09, 0.09, 0x2c2f34, 0.3], [0.092, 0.025, 0.3, 0, 0.075, -0.1, 0x2f6fb2],
      [0.05, 0.04, 0.2, 0, 0.09, -0.08, 0x2c2f34]] },
    rifleScope: { tip: -0.7, gripZ: -0.3, parts: [
      [0.09, 0.12, 0.42, 0, 0.02, -0.06, 0x3a4048], [0.02, 0.02, 0.46, 0, 0.03, -0.46, 0x2c2f34, 0, 1],
      [0.04, 0.04, 0.24, 0, 0.1, -0.1, 0x1a1c20, 0, 1], [0.045, 0.045, 0.01, 0, 0.1, -0.22, 0x66aaff, 0, 1],
      [0.06, 0.14, 0.08, 0, -0.12, -0.02, 0x2c2f34], [0.07, 0.1, 0.16, 0, 0.01, 0.26, 0x2c2f34]] },
    sniper: { tip: -0.88, gripZ: -0.32, parts: [
      [0.09, 0.13, 0.44, 0, 0.02, -0.06, 0x3a4048], [0.018, 0.018, 0.62, 0, 0.03, -0.55, 0x2c2f34, 0, 1],
      [0.05, 0.05, 0.28, 0, 0.11, -0.08, 0x1a1c20, 0, 1], [0.055, 0.055, 0.01, 0, 0.11, -0.22, 0x66aaff, 0, 1],
      [0.02, 0.02, 0.09, 0.07, 0.02, 0.02, 0x8a8f96], [0.06, 0.12, 0.08, 0, -0.11, -0.02, 0x2c2f34],
      [0.07, 0.11, 0.18, 0, 0.01, 0.28, 0x6b4a2a]] },
    knife: { tip: -0.44, gripZ: null, parts: [
      [0.05, 0.06, 0.16, 0, -0.01, 0.02, 0x2c2f34], [0.015, 0.05, 0.34, 0, 0.0, -0.26, 0x9aa0a8]] },
  };
  let curWeapon = null;
  let flashQuad = null;
  let flashQuadUntil = 0;
  function buildViewmodel(id) {
    while (gun.children.length) gun.remove(gun.children[0]);
    const spec = VM_SPECS[id] || VM_SPECS.pistol;
    for (const a of spec.parts) gun.add(vmPart(a));
    gun.add(vmHand(0.02, -0.08, 0.06));
    if (spec.gripZ !== null) gun.add(vmHand(-0.01, -0.055, spec.gripZ));
    flashQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.36),
      new THREE.MeshBasicMaterial({ map: flashTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    flashQuad.position.set(0, 0.03, spec.tip - 0.04);
    flashQuad.visible = false;
    gun.add(flashQuad);
    curWeapon = id;
  }
  buildViewmodel('pistol');
  gun.position.set(0.26, -0.24, -0.5);
  camera.add(gun);
  scene.add(camera);

  // Muzzle flash light + quad.
  const flashLight = new THREE.PointLight(0xffc36b, 0, 9, 1.8);
  scene.add(flashLight);
  let flashUntil = 0;

  // Tracer pool: thin stretched boxes.
  const tracers = [];
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 1), tracerMat.clone());
    m.visible = false;
    scene.add(m);
    tracers.push({ mesh: m, until: 0 });
  }
  let tracerIdx = 0;

  // Planted device: small box with a blinking light.
  const device = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.16, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x222222, emissive: 0xff2222, emissiveIntensity: 0.7 }),
  );
  device.visible = false;
  scene.add(device);
  const deviceLight = new THREE.PointLight(0xff2222, 0, 10, 1.8);
  scene.add(deviceLight);

  // Explosion: expanding sphere + light, fades in ~1 s.
  const boom = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0 }),
  );
  scene.add(boom);
  const boomLight = new THREE.PointLight(0xff7a1a, 0, 30, 1.4);
  scene.add(boomLight);

  // Grenade projectiles in flight (small dark spheres).
  const nadePool = [];
  const nadeMat = new THREE.MeshLambertMaterial({ color: 0x1a1c20 });
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), nadeMat);
    m.visible = false;
    scene.add(m);
    nadePool.push(m);
  }
  // Smoke clouds (grey spheres) and molotov fire zones (orange discs).
  const smokePool = [];
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0x9aa3ad, transparent: true, opacity: 0.4 });
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), smokeMat.clone());
    m.visible = false;
    scene.add(m);
    smokePool.push(m);
  }
  const firePool = [];
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xff6a00, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.5, 14), fireMat.clone());
    m.visible = false;
    scene.add(m);
    firePool.push(m);
  }

  // Bot bodies, keyed by bot id.
  const botMeshes = new Map();
  // Two squads, clearly different silhouettes, all procedural: defenders wear
  // blue-grey tactical kit with helmets/caps and vests; attackers wear
  // tan-olive kit with hoods/balaclavas and vests. Three variants per side
  // (shade + headgear) so a squad reads as individuals.
  function makeBotMesh(teamKey, variant) {
    const teamColor = TEAMS[teamKey].color;
    const group = new THREE.Group();
    const shades = teamKey === 'def'
      ? [0x35608a, 0x2e5478, 0x3f6a94]
      : [0x8a7a4a, 0x7d7040, 0x94855a];
    const v = variant % 3;
    const pants = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.24), new THREE.MeshLambertMaterial({ color: 0x23262b }));
    pants.position.y = 0.25;
    group.add(pants);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), new THREE.MeshLambertMaterial({ color: shades[v] }));
    torso.position.y = 0.82;
    group.add(torso);
    if (v !== 2) {
      const vest = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.08), new THREE.MeshLambertMaterial({ color: 0x2e3138 }));
      vest.position.set(0, 0.85, 0.18);
      group.add(vest);
      // Chest pouches on the vest + shoulder pads.
      for (const px of [-0.11, 0.11]) {
        const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.05), new THREE.MeshLambertMaterial({ color: 0x23262b }));
        pouch.position.set(px, 0.82, 0.23);
        group.add(pouch);
      }
    }
    for (const px of [-0.27, 0.27]) {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.32), new THREE.MeshLambertMaterial({ color: shades[v] }));
      pad.position.set(px, 1.1, 0);
      group.add(pad);
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.3), new THREE.MeshLambertMaterial({ color: 0x2c2f36 }));
    head.position.y = 1.32;
    group.add(head);
    if (teamKey === 'def') {
      // Helmet (variants 0, 2) or cap (variant 1).
      const helm = new THREE.Mesh(
        new THREE.BoxGeometry(v === 1 ? 0.32 : 0.38, 0.12, 0.36),
        new THREE.MeshLambertMaterial({ color: 0x3d4c5e }),
      );
      helm.position.y = v === 1 ? 1.44 : 1.48;
      group.add(helm);
    } else {
      // Hood (variants 0, 2) or balaclava band (variant 1).
      const hood = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, v === 1 ? 0.1 : 0.34, 0.34),
        new THREE.MeshLambertMaterial({ color: 0x5a4f33 }),
      );
      hood.position.y = v === 1 ? 1.3 : 1.34;
      group.add(hood);
    }
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.05), new THREE.MeshBasicMaterial({ color: teamColor }));
    visor.position.set(0, 1.34, 0.16);
    group.add(visor);
    const gunMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.72), new THREE.MeshLambertMaterial({ color: 0x14161a }));
    gunMesh.position.set(0.14, 0.95, 0.28);
    group.add(gunMesh);
    return { group, torso, head, gun: gunMesh };
  }

  // Bot gun length/thickness by the weapon the bot actually carries.
  const BOT_GUN = {
    pistol: [0.5, 0.6, 0.45], heavy: [0.6, 0.6, 0.55], smg: [0.7, 0.7, 0.65],
    shotgun: [1.3, 1.3, 0.9], rifleAtk: [1, 1, 1], rifleDef: [1, 1, 1],
    rifleScope: [0.9, 0.9, 1.15], sniper: [0.8, 0.8, 1.35],
  };

  const raycaster = new THREE.Raycaster();
  raycaster.far = 120;

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  return {
    scene, camera, shootables,
    raycast(origin, dir, maxDist) {
      raycaster.set(origin, dir);
      raycaster.far = maxDist;
      const hits = raycaster.intersectObjects(shootables, false);
      if (!hits.length) return null;
      const hit = hits[0];
      const ud = hit.object.userData;
      return {
        point: hit.point, dist: hit.distance,
        bot: ud.bot || null, part: ud.part || null, wall: !!ud.wall,
      };
    },
    addBot(bot) {
      const m = makeBotMesh(bot.team, bot.id);
      m.team = bot.team;
      m.torso.userData = { bot, part: 'body' };
      m.head.userData = { bot, part: 'head' };
      m.group.userData = { bot };
      scene.add(m.group);
      shootables.push(m.torso, m.head);
      botMeshes.set(bot.id, m);
      return m;
    },
    // (Re)create one mesh per bot; a bot whose team changed since its mesh
    // was built (half-time side swap) gets a fresh mesh in the new colour.
    syncBots(bots) {
      for (const bot of bots) {
        let m = botMeshes.get(bot.id);
        if (!m) m = this.addBot(bot);
        else if (m.team !== bot.team) { this.removeBot(bot); m = this.addBot(bot); }
        const gs = BOT_GUN[bot.weaponId] || BOT_GUN.pistol;
        if (m.gun) m.gun.scale.set(gs[0], gs[1], gs[2]);
      }
    },
    removeBot(bot) {
      const m = botMeshes.get(bot.id);
      if (!m) return;
      scene.remove(m.group);
      for (const part of [m.torso, m.head]) {
        const i = shootables.indexOf(part);
        if (i >= 0) shootables.splice(i, 1);
      }
      botMeshes.delete(bot.id);
    },
    fireTracer(from, to) {
      const t = tracers[tracerIdx];
      tracerIdx = (tracerIdx + 1) % tracers.length;
      const mid = from.clone().add(to).multiplyScalar(0.5);
      t.mesh.position.copy(mid);
      t.mesh.lookAt(to);
      t.mesh.scale.set(1, 1, from.distanceTo(to));
      t.mesh.visible = true;
      t.until = performance.now() + 60;
    },
    // Staging (and round resets) must not leave stale beams on screen: the
    // sim runs many steps in one wall-clock instant, so every tracer's expiry
    // would otherwise still be in the future at the next paint.
    clearTracers() {
      for (const t of tracers) t.mesh.visible = false;
    },
    // Same staleness for the muzzle flash: the sim's last shot leaves the
    // flash light at full intensity with a 45 ms expiry that has not passed
    // when the staged frame is painted — it would blast the nearest bot and
    // wall white-yellow in the screenshot.
    clearFlash() {
      flashLight.intensity = 0;
      if (flashQuad) flashQuad.visible = false;
    },
    flashVM() {
      if (flashQuad) { flashQuad.visible = true; flashQuadUntil = performance.now() + 45; }
    },
    muzzleAt(pos) {
      flashLight.position.copy(pos);
      flashLight.intensity = 26;
      flashUntil = performance.now() + 45;
    },
    setDevice(x, z, planted) {
      device.visible = planted;
      deviceLight.intensity = planted ? 4 : 0;
      if (planted) {
        device.position.set(x, 0.08, z);
        deviceLight.position.set(x, 0.8, z);
      }
    },
    explodeAt(x, z, t) {
      const s = 1 + t * 14;
      boom.position.set(x, 1, z);
      boom.scale.setScalar(s);
      boom.material.opacity = Math.max(0, 0.85 - t * 0.8);
      boomLight.position.set(x, 2, z);
      boomLight.intensity = Math.max(0, 60 - t * 55);
    },
    update(game, dt, now) {
      const p = game.player;
      if (game.phase === 'menu') {
        // Slow orbit over the map behind the title screen.
        gun.visible = false;
        const a = now * 0.00006;
        camera.position.set(Math.sin(a) * 24, 13, Math.cos(a) * 24 - 2);
        camera.lookAt(0, 0.5, -6);
        camera.fov = 60;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        return;
      }
      // Camera: the player's eyes, or — after death — a short deathcam at the
      // death spot, then the view of a living teammate (spectate).
      const spec = !p.alive && p.spectateId !== null
        ? game.bots.find((b) => b.id === p.spectateId && b.alive) : null;
      if (spec) {
        camera.position.set(spec.x, 1.62, spec.z);
        camera.rotation.y = spec.yaw;
        camera.rotation.x = 0;
        gun.visible = false;
      } else {
        camera.position.set(p.x, p.eyeY, p.z);
        camera.rotation.y = p.yaw;
        camera.rotation.x = p.pitch;
        gun.visible = p.alive;
      }
      const targetFov = p.ads ? 52 : 74;
      if (Math.abs(camera.fov - targetFov) > 0.1) {
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 12);
        camera.updateProjectionMatrix();
      }
      // Viewmodel: rebuild when the weapon changes, bob while moving, kick
      // on fire, centre when aiming, dip + tilt while reloading.
      if (p.weaponId !== curWeapon) buildViewmodel(p.weaponId);
      const bob = p.moving ? Math.sin(now * 0.011) * 0.012 : 0;
      const bobY = p.moving ? Math.abs(Math.cos(now * 0.011)) * 0.01 : 0;
      const gx = p.ads ? 0 : 0.26;
      const gy = (p.ads ? -0.185 : -0.24) + bobY;
      gun.position.x += (gx - gun.position.x) * Math.min(1, dt * 14);
      gun.position.y += (gy - gun.position.y) * Math.min(1, dt * 14);
      gun.position.z = -0.5 + p.recoil * 0.09;
      gun.position.y += bob;
      const w = WEAPONS[p.weaponId];
      const rl = p.reloading > 0 && w.reload > 0 ? 1 - p.reloading / w.reload : 0;
      const dip = rl > 0 ? Math.sin(rl * Math.PI) * 0.13 : 0;
      gun.position.y -= dip;
      gun.rotation.x = dip * 0.7;
      if (flashQuad && flashQuad.visible && now > flashQuadUntil) flashQuad.visible = false;
      // Bots. Meshes face their yaw: local +z (visor, gun) must map to the
      // game's forward (-sin yaw, -cos yaw), so the group turns yaw + PI.
      for (const bot of game.bots) {
        const m = botMeshes.get(bot.id);
        if (!m) continue;
        m.group.visible = !(spec && bot.id === spec.id);
        m.group.position.set(bot.x, bot.dead ? 0.05 : 0, bot.z);
        m.group.rotation.y = bot.yaw + Math.PI;
        if (bot.dead) {
          m.group.rotation.z = Math.PI / 2 * 0.9;
          m.group.position.y = 0.15;
        } else {
          m.group.rotation.z = 0;
          // Walk bob.
          m.group.position.y = bot.moving ? Math.abs(Math.sin(now * 0.012 + bot.id)) * 0.04 : 0;
        }
      }
      // Tracers + flash fade.
      for (const t of tracers) if (t.mesh.visible && now > t.until) t.mesh.visible = false;
      if (flashLight.intensity > 0 && now > flashUntil) flashLight.intensity = 0;
      // Device blink: the light pulses, the box itself stays visibly red.
      if (game.devicePlanted) {
        const on = Math.floor(now / (game.deviceFuseLeft < 10 ? 200 : 450)) % 2 === 0;
        device.material.emissiveIntensity = 1.2;
        deviceLight.intensity = on ? 6 : 1;
      }
      // Grenades in flight, smoke clouds, molotov fire zones.
      const nades = game.grenades || [];
      nadePool.forEach((m, i) => {
        const g = nades[i];
        m.visible = !!g;
        if (g) m.position.set(g.x, g.y, g.z);
      });
      const smokes = game.smokes || [];
      smokePool.forEach((m, i) => {
        const s = smokes[i];
        m.visible = !!s;
        if (s) {
          m.position.set(s.x, 1.4, s.z);
          m.scale.set(s.r, s.r * 0.75, s.r);
          m.material.opacity = Math.min(0.45, 0.15 + s.t * 0.05);
        }
      });
      const fires = game.fires || [];
      firePool.forEach((m, i) => {
        const f = fires[i];
        m.visible = !!f;
        if (f) {
          m.position.set(f.x, 0.25, f.z);
          m.scale.set(f.r, 1 + Math.sin(now * 0.02 + i) * 0.2, f.r);
          m.material.opacity = 0.4 + Math.min(0.2, f.t * 0.05);
        }
      });
      // Explosion animation (device, then a smaller HE blast).
      if (game.heBoom) {
        const t = (now - game.heBoom.at) / 1000;
        if (t < 0.7) this.explodeAt(game.heBoom.x, game.heBoom.z, t * 1.6);
      }
      if (game.explosion) {
        const t = (now - game.explosion.at) / 1000;
        if (t < 1.2) this.explodeAt(game.explosion.x, game.explosion.z, t);
        else { boom.material.opacity = 0; boomLight.intensity = 0; }
      }
      renderer.render(scene, camera);
    },
  };
}
