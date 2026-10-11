/* Эффекты: частицы (свои у каждого бога), пиксельный «растворяющийся» переход,
   молния Зевса, салют из конфетти. Всё рисуется на canvas пикселями. */
window.FX = (function () {
  'use strict';
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PX = 3; // размер «пикселя» частиц в CSS-пикселях
  let W = innerWidth, H = innerHeight;

  /* ───────────────────────── частицы ───────────────────────── */
  const pc = document.getElementById('particles');
  const pctx = pc.getContext('2d');
  let list = [], mode = 'gold', colors = ['#ffe28a', '#f3c24f', '#fff6cf'], acc = 0, tPrev = 0, rays = 0;
  const bursts = [];

  const NOTE = ['..11.', '..1.1', '..1..', '..1..', '11.1.', '111..'];
  const FEATHER = [[[0, 0], [0, 1], [1, 1], [1, 2], [1, 3]], [[1, 0], [1, 1], [0, 1], [0, 2], [0, 3]]];
  const PETAL = [[[0, 0], [1, 0], [1, 1]], [[0, 1], [1, 1], [1, 0]]];

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  const SPEC = {
    gold:     { rate: 5,  make: () => ({ x: rnd(0, W), y: H + 10, vx: rnd(-6, 6), vy: rnd(-22, -48), life: rnd(5, 9), s: 1, shape: 'sq', sway: 8, a: 0.8 }) },
    feathers: { rate: 2.6, make: () => ({ x: rnd(0, W), y: -20, vx: rnd(-10, 10), vy: rnd(28, 50), life: rnd(9, 15), s: 1, shape: 'feather', sway: 36, a: 0.9 }) },
    petals:   { rate: 3.4, make: () => ({ x: rnd(0, W), y: -20, vx: rnd(-14, 6), vy: rnd(24, 44), life: rnd(10, 16), s: 1, shape: 'petal', sway: 30, a: 0.9 }) },
    mist:     { rate: 2.2, make: () => ({ x: rnd(-40, W), y: rnd(H * 0.45, H), vx: rnd(10, 26), vy: rnd(-8, -2), life: rnd(8, 13), s: rnd(5, 9), shape: 'sq', sway: 6, a: 0.16, fade: 1 }) },
    embers:   { rate: 14, make: () => ({ x: rnd(0, W), y: H + 8, vx: rnd(-14, 14), vy: rnd(-60, -130), life: rnd(2.2, 4.5), s: 1, shape: 'sq', sway: 14, a: 1, flick: 1 }) },
    flame:    { rate: 18, make: () => ({ x: W / 2 + rnd(-W * 0.38, W * 0.38), y: H + 8, vx: rnd(-10, 10), vy: rnd(-70, -150), life: rnd(1.8, 3.8), s: 1, shape: 'sq', sway: 10, a: 1, flick: 1 }) },
    wisps:    { rate: 5, make: () => ({ x: rnd(W * 0.1, W * 0.9), y: H + 10, vx: 0, vy: rnd(-26, -52), life: rnd(6, 10), s: rnd(1, 2), shape: 'sq', sway: 46, a: 0.7, fade: 1 }) },
    rays:     { rate: 4.2, make: () => Math.random() < 0.38
                ? { x: rnd(0, W), y: H + 10, vx: rnd(-10, 10), vy: rnd(-28, -52), life: rnd(5, 8), s: 1, shape: 'note', sway: 18, a: 0.9 }
                : { x: rnd(0, W), y: rnd(0, H), vx: 0, vy: rnd(-8, -2), life: rnd(3, 6), s: 1, shape: 'plus', sway: 4, a: 0.9, twinkle: 1 } },
    grain:    { rate: 8, make: () => ({ x: rnd(-20, W), y: -10, vx: rnd(14, 36), vy: rnd(26, 52), life: rnd(8, 13), s: 1, shape: 'grain', sway: 20, a: 0.9 }) },
    confetti: { rate: 11, make: () => ({ x: rnd(0, W), y: -10, vx: rnd(-18, 18), vy: rnd(50, 100), life: rnd(5, 9), s: rnd(1, 2), shape: 'sq', sway: 24, a: 1 }) },
    stars:    { rate: 9, make: () => ({ x: rnd(0, W), y: rnd(0, H), vx: 0, vy: 0, life: rnd(2.5, 5.5), s: 1, shape: Math.random() < 0.25 ? 'plus' : 'sq', sway: 0, a: 1, twinkle: 1 }) }
  };

  function setMode(m, cols) {
    mode = SPEC[m] ? m : 'gold';
    colors = cols && cols.length ? cols : ['#ffe28a', '#f3c24f', '#fff6cf'];
    list.length = 0;
    const spec = SPEC[mode];
    if (!reduce) for (let i = 0; i < spec.rate * 3; i++) {   // сразу «насыпать» немного
      const p = spec.make(); p.age = rnd(0, p.life * 0.8); p.ph = Math.random() * 6.28; p.col = pick(colors); p.y = rnd(0, H);
      list.push(p);
    }
    acc = 0;
  }

  function snap(v) { return Math.round(v / PX) * PX; }
  function drawParticle(p, ctx) {
    const t = p.age / p.life;
    let a = p.a;
    if (p.twinkle) a *= Math.sin(Math.PI * t);
    else if (p.fade) a *= Math.sin(Math.PI * t);
    else a *= 1 - t * t;
    if (p.flick) a *= 0.65 + 0.35 * Math.sin(p.age * 30 + p.ph);
    if (a <= 0.02) return;
    ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = p.col;
    const x = snap(p.x + Math.sin(p.age * 1.6 + p.ph) * p.sway), y = snap(p.y);
    const s = Math.max(1, Math.round(p.s * (p.flick ? (1 - t * 0.6) : 1))) * PX;
    switch (p.shape) {
      case 'plus':
        ctx.fillRect(x, y - PX, PX, PX * 3); ctx.fillRect(x - PX, y, PX * 3, PX); break;
      case 'note':
        for (let r = 0; r < NOTE.length; r++) for (let c = 0; c < 5; c++) if (NOTE[r][c] === '1') ctx.fillRect(x + c * 2, y + r * 2, 2, 2);
        break;
      case 'feather': {
        const v = FEATHER[((p.age * 2.2 + p.ph) | 0) % 2];
        v.forEach(([cx, cy]) => ctx.fillRect(x + cx * PX, y + cy * PX, PX, PX)); break;
      }
      case 'petal': {
        const v = PETAL[((p.age * 2.6 + p.ph) | 0) % 2];
        v.forEach(([cx, cy]) => ctx.fillRect(x + cx * PX, y + cy * PX, PX, PX)); break;
      }
      case 'grain':
        if (((p.age * 3 + p.ph) | 0) % 2) { ctx.fillRect(x, y, PX, PX * 2); } else { ctx.fillRect(x, y, PX * 2, PX); }
        break;
      default:
        ctx.fillRect(x, y, s, s);
    }
  }

  function drawRays(ctx, dt) {
    rays += dt * 0.12;
    const cx = W / 2, cy = H * 0.1, R = Math.hypot(W, H);
    ctx.save();
    ctx.globalAlpha = 0.06; ctx.fillStyle = colors[0];
    for (let i = 0; i < 9; i++) {
      const a = rays + (i / 9) * Math.PI * 2, w = 0.11;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a - w) * R, cy + Math.sin(a - w) * R);
      ctx.lineTo(cx + Math.cos(a + w) * R, cy + Math.sin(a + w) * R);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function drawGlow(ctx, col) {
    const g = ctx.createLinearGradient(0, H, 0, H * 0.55);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = g; ctx.fillRect(0, H * 0.55, W, H * 0.45); ctx.restore();
  }

  function frame(t) {
    requestAnimationFrame(frame);
    if (document.hidden) { tPrev = t; return; }
    const dt = Math.min(0.05, (t - (tPrev || t)) / 1000); tPrev = t;
    pctx.clearRect(0, 0, W, H);

    if (!reduce) {
      if (mode === 'rays') drawRays(pctx, dt);
      if (mode === 'flame' || mode === 'embers') drawGlow(pctx, colors[2] || '#ff5a2a');
      const spec = SPEC[mode];
      acc += dt * spec.rate;
      while (acc >= 1 && list.length < 220) {
        acc -= 1;
        const p = spec.make(); p.age = 0; p.ph = Math.random() * 6.28; p.col = pick(colors);
        list.push(p);
      }
      if (acc > 5) acc = 0;
    }
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.age += dt;
      if (p.age >= p.life) { list.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      drawParticle(p, pctx);
    }
    /* салют / искры при нажатиях (с гравитацией) */
    for (let i = bursts.length - 1; i >= 0; i--) {
      const p = bursts[i];
      p.age += dt;
      if (p.age >= p.life || p.y > H + 20) { bursts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.sway = 0; p.a = 1; p.twinkle = 0; p.fade = 0;
      drawParticle(p, pctx);
    }
    pctx.globalAlpha = 1;
  }

  /* искры из точки (клик, печать, открытие кнопки) */
  function burst(x, y, cols, n, power) {
    if (reduce) n = Math.min(n || 18, 6);
    cols = cols || colors; n = n || 18; power = power || 1;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = rnd(60, 220) * power;
      bursts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 260, age: 0, life: rnd(0.7, 1.5), s: Math.random() < 0.3 ? 2 : 1, shape: Math.random() < 0.2 ? 'plus' : 'sq', sway: 0, a: 1, ph: 0, col: pick(cols) });
    }
  }
  /* дождь из конфетти и золота — праздник */
  function rain(cols, n) {
    cols = cols || ['#ffe28a', '#f3c24f', '#ffffff', '#7de0db', '#e65b8e', '#8fcf6a'];
    n = reduce ? 40 : (n || 220);
    for (let i = 0; i < n; i++) {
      bursts.push({ x: rnd(0, W), y: rnd(-H * 0.6, -10), vx: rnd(-30, 30), vy: rnd(40, 120), g: 40, age: 0, life: rnd(3.5, 7), s: Math.random() < 0.25 ? 2 : 1, shape: 'sq', sway: 0, a: 1, ph: 0, col: pick(cols) });
    }
  }

  /* ───────────────────────── молния ───────────────────────── */
  const bolt = document.getElementById('bolt');
  const bctx = bolt.getContext('2d');
  const flashEl = document.getElementById('flash');
  let boltT = 0;
  function lightning(x) {
    const sx = x != null ? x : rnd(W * 0.15, W * 0.85);
    const pts = [[sx, 0]];
    let cx = sx, cy = 0;
    while (cy < H * rnd(0.45, 0.7)) {
      cy += rnd(24, 52); cx += rnd(-34, 34);
      pts.push([cx, cy]);
    }
    boltT = 1;
    flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go');
    const step = () => {
      bctx.clearRect(0, 0, W, H);
      if (boltT <= 0) return;
      const flick = boltT > 0.55 ? 1 : (Math.random() < 0.5 ? 1 : 0.35);
      bctx.globalAlpha = boltT * flick;
      bctx.lineJoin = 'miter';
      [[9, 'rgba(120,170,255,0.55)'], [4, '#cfe3ff'], [2, '#ffffff']].forEach(([w, c]) => {
        bctx.strokeStyle = c; bctx.lineWidth = w; bctx.beginPath();
        pts.forEach(([x, y], i) => (i ? bctx.lineTo(Math.round(x / 3) * 3, Math.round(y / 3) * 3) : bctx.moveTo(Math.round(x / 3) * 3, y)));
        bctx.stroke();
      });
      boltT -= 0.045;
      requestAnimationFrame(step);
    };
    step();
  }

  /* ───────────────────────── пиксельный переход ───────────────────────── */
  const tcv = document.getElementById('transition');
  const tctx = tcv.getContext('2d');
  const veil = document.getElementById('veil');
  const CELL = 22;
  let cols = 0, rows = 0, thr = [], tColor = '#1a1536', tProg = 0, tAnim = null, tHold = false;

  function buildThr() {
    cols = Math.ceil(W / CELL); rows = Math.ceil(H / CELL);
    thr = new Float32Array(cols * rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
      thr[r * cols + c] = Math.min(0.999, 0.55 * Math.random() + 0.45 * ((c / cols) * 0.7 + (r / rows) * 0.3));
  }
  function drawT() {
    tctx.clearRect(0, 0, W, H);
    if (tProg <= 0) return;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const th = thr[r * cols + c];
      if (th > tProg) continue;
      const edge = tProg - th < 0.1 && tProg < 1;
      tctx.fillStyle = edge ? window.Sprites.mix(tColor, '#ffffff', 0.35) : tColor;
      tctx.fillRect(c * CELL, r * CELL, CELL + 0.5, CELL + 0.5);
    }
  }
  function animateT(to, ms) {
    return new Promise((resolve) => {
      cancelAnimationFrame(tAnim);
      const from = tProg, t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / ms);
        tProg = from + (to - from) * (k * k * (3 - 2 * k));
        drawT();
        if (k < 1) tAnim = requestAnimationFrame(step); else resolve();
      };
      tAnim = requestAnimationFrame(step);
    });
  }
  /* opts: color, sprite(canvas), greek, label */
  function cover(opts) {
    opts = opts || {};
    tColor = opts.color || '#1a1536';
    veil.innerHTML = '';
    if (opts.sprite) veil.appendChild(opts.sprite);
    if (opts.greek) { const g = document.createElement('div'); g.className = 'veil-greek'; g.textContent = opts.greek; veil.appendChild(g); }
    if (opts.label) { const l = document.createElement('div'); l.className = 'veil-label'; l.textContent = opts.label; veil.appendChild(l); }
    veil.classList.remove('show');
    tcv.classList.add('on');
    if (reduce) { tProg = 1; drawT(); veil.classList.add('show'); return Promise.resolve(); }
    return animateT(1, 620).then(() => { veil.classList.add('show'); });
  }
  function uncover(delay) {
    return new Promise((resolve) => {
      setTimeout(() => {
        veil.classList.remove('show');
        if (reduce) { tProg = 0; drawT(); tcv.classList.remove('on'); resolve(); return; }
        animateT(0, 640).then(() => { tcv.classList.remove('on'); resolve(); });
      }, delay == null ? 650 : delay);
    });
  }
  function isCovered() { return tcv.classList.contains('on'); }

  /* ───────────────────────── размеры ───────────────────────── */
  function resize() {
    W = innerWidth; H = innerHeight;
    [pc, bolt, tcv].forEach((c) => { c.width = W; c.height = H; });
    buildThr();
    if (tProg > 0) drawT();
  }
  addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);

  return { setMode, burst, rain, lightning, cover, uncover, isCovered, reduce, get W() { return W; }, get H() { return H; } };
})();
