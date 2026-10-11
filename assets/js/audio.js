/* Звук, синтезированный на лету (WebAudio): лира, гром, ветер, пад.
   Никаких аудиофайлов. Запускается только после первого касания/клика. */
window.Sound = (function () {
  'use strict';
  let ctx = null, master, bus, ambGain, wetGain, conv;
  let ready = false, enabled = true, holdCount = 0, mood = 'hub', lyreTimer = null, padNodes = [], chordTimer = null;
  const bufCache = {};
  const walk = { i: 7 };

  try { enabled = localStorage.getItem('quest.sound') !== '0'; } catch (e) { /* без хранилища — по умолчанию звук включён */ }

  /* ре-дорийский лад, D3 … D5 */
  const SCALE = [146.83, 164.81, 174.61, 196.00, 220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33];
  const CHORDS = [
    [73.42, 110.00, 146.83, 174.61],   // Dm
    [98.00, 146.83, 196.00, 246.94],   // G
    [73.42, 110.00, 146.83, 220.00],   // Dm (A наверху)
    [65.41, 98.00, 164.81, 196.00]     // C
  ];

  function makeIR(seconds, decay) {
    const sr = ctx.sampleRate, len = Math.floor(sr * seconds);
    const buf = ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  function noiseBuffer(seconds, brown) {
    const sr = ctx.sampleRate, len = Math.floor(sr * seconds);
    const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }
  /* Карплюс–Стронг: щипок струны */
  function ksBuffer(freq) {
    const key = Math.round(freq * 100);
    if (bufCache[key]) return bufCache[key];
    const sr = ctx.sampleRate, len = Math.floor(sr * 2.4);
    const period = Math.max(2, Math.round(sr / freq - 0.5));
    const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    let prev = 0;
    for (let i = 0; i < period; i++) { prev = prev * 0.45 + (Math.random() * 2 - 1) * 0.55; d[i] = prev; }
    for (let i = period; i < len; i++) d[i] = 0.9966 * 0.5 * (d[i - period] + d[i - period + 1]);
    const fade = Math.floor(sr * 0.25);
    for (let i = 0; i < fade; i++) d[len - 1 - i] *= i / fade;
    bufCache[key] = buf;
    return buf;
  }

  function init() {
    if (ready) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = enabled ? 0.85 : 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);

    bus = ctx.createGain();
    const dry = ctx.createGain(); dry.gain.value = 0.8;
    conv = ctx.createConvolver(); conv.buffer = makeIR(3.4, 2.6);
    wetGain = ctx.createGain(); wetGain.gain.value = 0.42;
    bus.connect(dry); dry.connect(master);
    bus.connect(conv); conv.connect(wetGain); wetGain.connect(master);

    ambGain = ctx.createGain(); ambGain.gain.value = 0;
    ambGain.connect(bus);
    ready = true;
    if (ctx.state === 'suspended') ctx.resume();
    startPad(); startWind();
    ambGain.gain.setTargetAtTime(holdCount ? 0 : 1, ctx.currentTime, 2.5);
    scheduleLyre();
  }

  /* ───── фон ───── */
  function startPad() {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; lp.Q.value = 0.6;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 0.07; lfoG.gain.value = 260;
    lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
    const out = ctx.createGain(); out.gain.value = 0.05;
    lp.connect(out); out.connect(ambGain);
    CHORDS[0].forEach((f) => {
      [-6, 6].forEach((det) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
        o.connect(lp); o.start(); padNodes.push(o);
      });
    });
    let ci = 0;
    chordTimer = setInterval(() => {
      ci = (ci + 1) % CHORDS.length;
      padNodes.forEach((o, i) => o.frequency.setTargetAtTime(CHORDS[ci][i >> 1], ctx.currentTime, 1.6));
    }, 9000);
  }
  function startWind() {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(4, true); src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.7;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 0.11; lfoG.gain.value = 180; lfo.connect(lfoG); lfoG.connect(bp.frequency); lfo.start();
    const g = ctx.createGain(); g.gain.value = 0.12;
    src.connect(bp); bp.connect(g); g.connect(ambGain); src.start();
  }

  /* лира сама по себе — редкие щипки */
  function scheduleLyre() {
    clearTimeout(lyreTimer);
    if (!ready) return;
    const gap = mood === 'hub' ? 1800 + Math.random() * 3200 : mood === 'god' ? 4500 + Math.random() * 5000 : 7000 + Math.random() * 6000;
    lyreTimer = setTimeout(() => {
      if (enabled && !holdCount && ctx.state === 'running') {
        walk.i = Math.max(0, Math.min(SCALE.length - 1, walk.i + Math.round((Math.random() - 0.5) * 4)));
        const v = mood === 'hub' ? 0.3 : 0.2;
        pluck(SCALE[walk.i], v, 0, ambGain);
        if (Math.random() < 0.35) pluck(SCALE[Math.min(SCALE.length - 1, walk.i + 2)], v * 0.8, 0.28, ambGain);
        if (Math.random() < 0.18) pluck(SCALE[Math.min(SCALE.length - 1, walk.i + 4)], v * 0.7, 0.55, ambGain);
      }
      scheduleLyre();
    }, gap);
  }

  /* ───── примитивы ───── */
  function pluck(freq, vel, when, dest) {
    if (!ready || !enabled) return;
    const src = ctx.createBufferSource(); src.buffer = ksBuffer(freq);
    const g = ctx.createGain(); g.gain.value = vel == null ? 0.6 : vel;
    src.connect(g); g.connect(dest || bus);
    src.start(ctx.currentTime + (when || 0));
  }
  function noiseHit(dur, f0, f1, vel, type) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(Math.max(dur, 0.1) + 0.1, false);
    const f = ctx.createBiquadFilter(); f.type = type || 'bandpass';
    f.frequency.setValueAtTime(f0, ctx.currentTime); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0005, ctx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(bus); src.start();
  }
  function tone(type, f0, f1, dur, vel, delay) {
    const t0 = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vel, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + dur + 0.05);
  }

  /* ───── эффекты ───── */
  function note(idx, vel) { if (!ready) return; pluck(SCALE[Math.max(0, Math.min(SCALE.length - 1, idx))], vel == null ? 0.5 : vel); }
  function click() {
    if (!ready || !enabled) return;
    noiseHit(0.09, 1400, 300, 0.5); tone('sine', 150, 60, 0.14, 0.5);
  }
  function thunder(power) {
    if (!ready || !enabled) return;
    power = power || 1;
    const dur = 4.2;
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(dur, true);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1400, ctx.currentTime); lp.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + dur);
    const g = ctx.createGain(); const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.3 * power, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.35 * power, t + 0.5);
    g.gain.linearRampToValueAtTime(0.75 * power, t + 0.75);
    g.gain.exponentialRampToValueAtTime(0.2 * power, t + 1.6);
    g.gain.linearRampToValueAtTime(0.4 * power, t + 1.9);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.connect(lp); lp.connect(g); g.connect(bus); src.start();
    tone('sine', 62, 30, 2.4, 0.5 * power);
  }
  function rumble(sec) {
    if (!ready || !enabled) return;
    sec = sec || 2.4;
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(sec + 0.5, true);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
    const g = ctx.createGain(); const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9, t + 0.4);
    g.gain.setValueAtTime(0.9, t + sec * 0.6); g.gain.exponentialRampToValueAtTime(0.0005, t + sec);
    src.connect(lp); lp.connect(g); g.connect(bus); src.start();
  }
  function fail() {
    if (!ready || !enabled) return;
    tone('sawtooth', 110, 62, 0.5, 0.18); tone('sawtooth', 116, 66, 0.5, 0.15);
    rumble(0.9);
  }
  function locked() {
    if (!ready || !enabled) return;
    noiseHit(0.12, 500, 120, 0.7); tone('square', 90, 70, 0.12, 0.12);
  }
  function success() {
    if (!ready || !enabled) return;
    [0, 2, 4, 7, 9, 11, 13].forEach((s, i) => pluck(SCALE[s], 0.55, i * 0.09));
    [4, 7, 11].forEach((s, i) => pluck(SCALE[s] * 2, 0.4, 0.75 + i * 0.07));
    chordSwell();
  }
  function chordSwell() {
    const t0 = ctx.currentTime + 0.5;
    [146.83, 220, 293.66, 369.99].forEach((f) => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.07, t0 + 0.7);
      g.gain.exponentialRampToValueAtTime(0.0005, t0 + 3.6);
      o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + 3.7);
    });
  }
  function unlock() {
    if (!ready || !enabled) return;
    [13, 11, 9, 7, 11, 14].forEach((s, i) => pluck(SCALE[Math.min(14, s)], 0.45, i * 0.11));
    tone('sine', 880, 1320, 0.5, 0.06, 0.2);
  }
  function doorOpen() {
    if (!ready || !enabled) return;
    rumble(3.2);
    for (let i = 0; i < 8; i++) pluck(SCALE[6 + i % 8], 0.35, 1.2 + i * 0.12);
    chordSwell();
  }
  function whoosh() {
    if (!ready || !enabled) return;
    noiseHit(0.5, 300, 3000, 0.25);
  }
  function type() { if (ready && enabled) noiseHit(0.03, 2200, 1800, 0.12); }
  /* мелкие звуки для испытаний */
  function tick() { if (ready && enabled) { tone('square', 1500, 1300, 0.04, 0.05); } }
  function pop() { if (ready && enabled) { noiseHit(0.08, 900, 2600, 0.3); tone('sine', 400, 900, 0.1, 0.18); } }
  function gong() { if (ready && enabled) { tone('sine', 110, 98, 2.2, 0.35); tone('sine', 221, 196, 1.6, 0.16); noiseHit(0.25, 800, 200, 0.4); } }
  function blip(freq, dur, vel) { if (ready && enabled) tone('triangle', freq, freq, dur || 0.12, vel || 0.2); }
  function wind(sec) {
    if (!ready || !enabled) return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer((sec || 0.8) + 0.2, true);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.8;
    const g = ctx.createGain(); const t = ctx.currentTime, d = sec || 0.8;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + d * 0.4); g.gain.exponentialRampToValueAtTime(0.0005, t + d);
    src.connect(bp); bp.connect(g); g.connect(bus); src.start();
  }

  /* ───── управление ───── */
  function setEnabled(v) {
    enabled = !!v;
    try { localStorage.setItem('quest.sound', enabled ? '1' : '0'); } catch (e) { /* ok */ }
    if (ready) master.gain.setTargetAtTime(enabled ? 0.85 : 0, ctx.currentTime, 0.15);
    if (enabled) init();
  }
  /* «Придержать» фон на время видео или игры с микрофоном */
  function hold(v) {
    holdCount = Math.max(0, holdCount + (v ? 1 : -1));
    if (ready) ambGain.gain.setTargetAtTime(holdCount ? 0 : 1, ctx.currentTime, holdCount ? 0.3 : 1.2);
  }
  function setMood(m) { mood = m; if (ready) scheduleLyre(); }
  /* струна на произвольную частоту (подсказка-мелодия Аполлона) — идёт мимо «придержанного» фона */
  function pluckFreq(freq, vel, when) { pluck(freq, vel, when, null); }
  function now() { return ready ? ctx.currentTime : 0; }

  return {
    init, setEnabled, hold, setMood, note, click, thunder, rumble, fail, locked, success, unlock, doorOpen, whoosh, type, pluckFreq, now,
    tick, pop, gong, blip, wind,
    get enabled() { return enabled; },
    get ready() { return ready; },
    get ctx() { return ctx; },
    get scale() { return SCALE; }
  };
})();
