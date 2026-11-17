// Three.js drawing only: the scene, the Ironworks meshes, bot bodies, the player's
// viewmodel, tracers, flashes and the planted device. No rules live here; game.js
// owns state and calls update() + raycast() each frame.
import * as THREE from 'three';
import { MAP, SITES, SOLIDS } from './world.js';
import { TEAMS } from './config.js';

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

const WALL_COLORS = [0x565c66, 0x5d636e, 0x525861];
const CRATE_COLORS = [0x7d6c3e, 0x6b7d8c, 0x86743f];

export function createRenderer(canvas, rng) {
  // rng seeds the floor speckle so the same seed renders the same texture.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1420);
  scene.fog = new THREE.Fog(0x0d1420, 35, 100);
  const camera = new THREE.PerspectiveCamera(74, 1, 0.08, 200);
  camera.rotation.order = 'YXZ';

  scene.add(new THREE.HemisphereLight(0x8fa3bf, 0x2a2118, 1.25));
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.6);
  sun.position.set(20, 32, 12);
  scene.add(sun);

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

  // Walls and crates from the map data.
  const shootables = [];
  const wallMats = WALL_COLORS.map((c) => new THREE.MeshLambertMaterial({ color: c }));
  const crateMats = CRATE_COLORS.map((c) => new THREE.MeshLambertMaterial({ color: c }));
  SOLIDS.forEach((s, i) => {
    const w = s.x1 - s.x0, d = s.z1 - s.z0;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, s.h, d),
      s.kind === 'wall' ? wallMats[i % wallMats.length] : crateMats[i % crateMats.length],
    );
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
  const furnaceLight = new THREE.PointLight(0xff6a00, 18, 20, 1.6);
  furnaceLight.position.set(-25, 2.5, -13);
  scene.add(furnaceLight);
  // Crane frame at Site B.
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xc9a227 });
  const craneBase = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 1), craneMat);
  craneBase.position.set(26, 2.5, -14);
  scene.add(craneBase);
  const craneArm = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 0.5), craneMat);
  craneArm.position.set(23, 4.8, -14);
  scene.add(craneArm);
  const craneLight = new THREE.PointLight(0x66aaff, 10, 18, 1.6);
  craneLight.position.set(22, 3, -12);
  scene.add(craneLight);

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

  // Player viewmodel: a simple gun that bobs, kicks and centres when aiming.
  const gun = new THREE.Group();
  const gunMat = new THREE.MeshLambertMaterial({ color: 0x1c1e22 });
  const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.5), gunMat);
  gun.add(gunBody);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.34, 8), gunMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.03, -0.38);
  gun.add(barrel);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.1), gunMat);
  mag.position.set(0, -0.14, -0.02);
  gun.add(mag);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.1), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  sight.position.set(0, 0.1, -0.08);
  gun.add(sight);
  // Knife blade: shown instead of the gun when the knife is out.
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.34), new THREE.MeshLambertMaterial({ color: 0x8a8f96 }));
  blade.position.set(0, -0.02, -0.3);
  blade.visible = false;
  gun.add(blade);
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
    return { group, torso, head };
  }

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
        const m = botMeshes.get(bot.id);
        if (!m) this.addBot(bot);
        else if (m.team !== bot.team) { this.removeBot(bot); this.addBot(bot); }
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
      // Viewmodel: bob while moving, kick on fire, centre when aiming.
      const bob = p.moving ? Math.sin(now * 0.011) * 0.012 : 0;
      const bobY = p.moving ? Math.abs(Math.cos(now * 0.011)) * 0.01 : 0;
      const gx = p.ads ? 0 : 0.26;
      const gy = (p.ads ? -0.185 : -0.24) + bobY;
      gun.position.x += (gx - gun.position.x) * Math.min(1, dt * 14);
      gun.position.y += (gy - gun.position.y) * Math.min(1, dt * 14);
      gun.position.z = -0.5 + p.recoil * 0.09;
      gun.position.y += bob;
      // Knife viewmodel: blade instead of the gun.
      const isKnife = p.weaponId === 'knife';
      blade.visible = isKnife;
      gunBody.visible = !isKnife;
      barrel.visible = !isKnife;
      mag.visible = !isKnife;
      sight.visible = !isKnife;
      barrel.scale.z = p.weaponId === 'sniper' ? 1.5 : p.weaponId === 'shotgun' ? 0.7 : 1;
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
