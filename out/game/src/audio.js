// Procedural sound only: every effect is synthesized with WebAudio, no audio files.
// All calls are safe before the context exists (headless runs) — they just no-op.
let ctx = null;
let master = null;

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return true;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
    return true;
  } catch { return false; }
}

function noiseBuffer(seconds) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function burst({ dur = 0.08, freq = 1800, type = 'square', vol = 0.5, slideTo = 0, noise = 0 }) {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  gain.connect(master);
  if (noise > 0) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = freq * 2;
    src.connect(filt); filt.connect(gain);
    src.start(t); src.stop(t + dur);
  } else {
    const osc = ctx.createOscillator();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    osc.connect(gain);
    osc.start(t); osc.stop(t + dur);
  }
}

function toneSeq(notes, stepDur = 0.09, type = 'triangle', vol = 0.4) {
  if (!ctx || !master) return;
  notes.forEach((freq, i) => {
    const t = ctx.currentTime + i * stepDur;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 1.4);
    osc.connect(gain); gain.connect(master);
    osc.start(t); osc.stop(t + stepDur * 1.5);
  });
}

export const sfx = {
  shot(kind) {
    if (kind === 'sniper') burst({ dur: 0.22, freq: 900, vol: 0.9, slideTo: 120, noise: 1 });
    else if (kind === 'shotgun') burst({ dur: 0.18, freq: 700, vol: 0.85, slideTo: 90, noise: 1 });
    else if (kind === 'rifle') burst({ dur: 0.09, freq: 1500, vol: 0.55, slideTo: 300, noise: 0.8 });
    else if (kind === 'smg') burst({ dur: 0.06, freq: 1900, vol: 0.4, slideTo: 500, noise: 0.7 });
    else burst({ dur: 0.07, freq: 1300, vol: 0.5, slideTo: 350, noise: 0.7 });
  },
  enemyShot(dist) {
    const vol = Math.max(0.08, 0.4 - dist * 0.008);
    burst({ dur: 0.07, freq: 1100, vol, slideTo: 300, noise: 0.8 });
  },
  hit(head) {
    burst({ dur: 0.05, freq: head ? 2400 : 1500, type: 'sine', vol: 0.5 });
  },
  kill() { toneSeq([880, 1320], 0.06, 'sine', 0.45); },
  dry() { burst({ dur: 0.03, freq: 2500, type: 'square', vol: 0.25 }); },
  reload() {
    burst({ dur: 0.04, freq: 900, type: 'square', vol: 0.3 });
    setTimeout(() => burst({ dur: 0.04, freq: 700, type: 'square', vol: 0.3 }), 180);
  },
  beep(final) { burst({ dur: final ? 0.16 : 0.07, freq: final ? 1560 : 1180, type: 'sine', vol: 0.4 }); },
  plant() { toneSeq([660, 880, 990], 0.08, 'sine', 0.4); },
  defuse() { toneSeq([990, 880, 660], 0.08, 'sine', 0.4); },
  explode() {
    burst({ dur: 1.1, freq: 420, vol: 1.0, slideTo: 40, noise: 1 });
    burst({ dur: 0.5, freq: 90, type: 'sine', vol: 0.9, slideTo: 28 });
  },
  roundWin() { toneSeq([523, 659, 784, 1047], 0.11, 'triangle', 0.45); },
  roundLose() { toneSeq([392, 330, 262], 0.14, 'triangle', 0.4); },
  click() { burst({ dur: 0.03, freq: 2000, type: 'sine', vol: 0.3 }); },
  step(quiet) { burst({ dur: 0.04, freq: 300, vol: quiet ? 0.04 : 0.12, noise: 1 }); },
  // Flash pop.
  pop() { burst({ dur: 0.12, freq: 900, vol: 0.7, slideTo: 150, noise: 1 }); },
  // Flashbang ringing in the ears.
  ring() { burst({ dur: 1.4, freq: 3200, type: 'sine', vol: 0.35, slideTo: 2600 }); },
  // Molotov crackle.
  fire() { burst({ dur: 0.6, freq: 700, vol: 0.4, noise: 1 }); },
  // Knife swing and hit.
  swing() { burst({ dur: 0.12, freq: 1200, vol: 0.22, noise: 1 }); },
  stab() { burst({ dur: 0.09, freq: 220, vol: 0.6, slideTo: 90, noise: 0.6 }); },
  // Soft tick while a plant/defuse channel runs.
  tick() { burst({ dur: 0.03, freq: 1800, type: 'sine', vol: 0.18 }); },
};
