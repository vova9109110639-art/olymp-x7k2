/* Пиксельная сцена: закат над Олимпом. Рисуется в маленьком разрешении
   и растягивается без сглаживания. Слои двигаются с параллаксом. */
window.Scene = (function () {
  'use strict';
  const cv = document.getElementById('scene');
  const ctx = cv.getContext('2d', { alpha: false });
  const mixC = (a, b, t) => window.Sprites.mix(a, b, t);
  const hex2rgb = (h) => window.Sprites.hex2rgb(h);

  const SKY = ['#070a24', '#0d1240', '#17185a', '#271c6e', '#3d2480', '#5e2b86', '#8a3585', '#b8437b', '#dd5d6e', '#f0806a', '#f7a869', '#fbcb83', '#fff1c4'];
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const PAD = 10, AMP = 5;

  let w, h, S, hor, k, portrait, L = {}, stars = [], birds = [], flies = [];
  let par = { x: 0 }, tgt = { x: 0 }, raf = 0, running = false, T0 = performance.now();

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeNoise(seed) {
    const r = rng(seed), tab = Array.from({ length: 512 }, () => r());
    return (x) => {
      const i = Math.floor(x), f = x - i, a = tab[i & 511], b = tab[(i + 1) & 511], u = f * f * (3 - 2 * f);
      return a + (b - a) * u;
    };
  }
  const fbm = (n, x) => n(x) * 0.55 + n(x * 2.1 + 17) * 0.3 + n(x * 4.4 + 31) * 0.15;
  const mk = (cw, ch) => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; return c; };

  /* ───── небо ───── */
  function buildSky() {
    const c = mk(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), rgb = SKY.map(hex2rgb);
    const sx = Math.round(w * (portrait ? 0.5 : 0.2)), sy = hor - Math.round(h * (portrait ? 0.1 : 0.15)), r = Math.max(6, Math.round(h * 0.07)), R = h * 0.7;
    const disc = hex2rgb('#fff4cf'), ring = hex2rgb('#ffe08c'), under = hex2rgb('#1b1448');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (y > hor + 1) {
        const o2 = (y * w + x) * 4; img.data[o2] = under[0]; img.data[o2 + 1] = under[1]; img.data[o2 + 2] = under[2]; img.data[o2 + 3] = 255; continue;
      }
      const t = Math.min(1, y / hor);
      const d = Math.hypot(x - sx, (y - sy) * 1.15);
      let glow = Math.max(0, 1 - d / R); glow *= glow;
      let v = t * (SKY.length - 2) + glow * 3.4;
      if (v > SKY.length - 1) v = SKY.length - 1;
      const i = Math.floor(v), f = v - i, thr = (BAYER[y & 3][x & 3] + 0.5) / 16;
      const ci = (i < SKY.length - 1 && f > thr) ? i + 1 : i;
      let col = rgb[ci];
      if (d < r) col = disc; else if (d < r + 1.3) col = ring;
      const o = (y * w + x) * 4;
      img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    L.sky = c;
  }

  /* ───── облака (бесшовные по горизонтали) ───── */
  function buildClouds(seed, n, yMin, yMax, sMin, sMax, pal) {
    const c = mk(w, h), g = c.getContext('2d'), r = rng(seed);
    for (let i = 0; i < n; i++) {
      const cx = r() * w, base = yMin + r() * (yMax - yMin), sc = sMin + r() * (sMax - sMin);
      const bw = Math.round((24 + r() * 34) * sc), mw = bw + Math.round(26 * sc), mh = Math.round(24 * sc) + 6, floor = mh - 4;
      const mask = new Uint8Array(mw * mh), blobs = 5 + ((r() * 3) | 0);
      for (let b = 0; b < blobs; b++) {
        const bx = mw / 2 + (r() - 0.5) * bw * 0.95, edge = Math.abs(bx - mw / 2) / (bw / 2 + 1);
        const rad = (4 + r() * 7) * sc * (1 - edge * 0.45), by = floor - rad * 0.55;
        for (let yy = Math.max(0, Math.floor(by - rad)); yy <= Math.min(floor, Math.ceil(by + rad)); yy++)
          for (let xx = Math.max(0, Math.floor(bx - rad)); xx <= Math.min(mw - 1, Math.ceil(bx + rad)); xx++)
            if ((xx + 0.5 - bx) ** 2 + (yy + 0.5 - by) ** 2 <= rad * rad) mask[yy * mw + xx] = 1;
      }
      const at = (xx, yy) => (yy < 0 || yy >= mh || xx < 0 || xx >= mw) ? 0 : mask[yy * mw + xx];
      for (let yy = 0; yy < mh; yy++) for (let xx = 0; xx < mw; xx++) {
        if (!at(xx, yy)) continue;
        let col = pal.body;
        if (!at(xx, yy - 1)) col = pal.rim;
        else if (!at(xx, yy + 1) || !at(xx, yy + 2)) col = pal.shadow;
        else if (!at(xx, yy - 2)) col = pal.rim2;
        const x0 = Math.round(cx - mw / 2 + xx), y0 = Math.round(base - floor + yy);
        g.fillStyle = col;
        for (const ox of [0, -w, w]) g.fillRect(x0 + ox, y0, 1, 1);
      }
    }
    return c;
  }

  /* ───── горы ───── */
  function buildFar() {
    const W2 = w + PAD * 2, c = mk(W2, h), g = c.getContext('2d'), n = makeNoise(11);
    const base = hor - h * 0.045, amp = h * 0.1;
    const body = hex2rgb('#4d3380'), haze = hex2rgb('#a95a8d'), rim = '#d98aa0';
    const img = g.createImageData(W2, h);
    for (let x = 0; x < W2; x++) {
      const top = Math.round(base - amp * (0.3 + 0.7 * fbm(n, x * 0.018)));
      for (let y = top; y <= hor + 2; y++) {
        const t = (y - top) / (hor + 2 - top), thr = (BAYER[y & 3][x & 3] + 0.5) / 16;
        const col = (Math.pow(t, 1.4) * 1.1 > thr) ? haze : body;
        const o = (y * W2 + x) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    L.far = c;
  }

  function buildOlympus() {
    const W2 = w + PAD * 2, c = mk(W2, h), g = c.getContext('2d'), n = makeNoise(23), n2 = makeNoise(5);
    const ox = Math.round(W2 * (portrait ? 0.64 : 0.8)), peakH = h * (portrait ? 0.27 : 0.42), spread = W2 * (portrait ? 0.62 : 0.3);
    const base = hor + 2;
    const ridge = (x) => {
      const u = Math.abs(x - ox) / spread, shape = Math.max(0, 1 - u);
      const u2 = Math.abs(x - (ox - spread * 0.62)) / (spread * 0.5), s2 = Math.max(0, 1 - u2);
      const m = Math.max(Math.pow(shape, 1.12) * peakH, Math.pow(s2, 1.1) * peakH * 0.5);
      if (m < 0.6) return base + 8;
      return base - m + (fbm(n, x * 0.1) - 0.5) * peakH * 0.15 * Math.min(1, m / (peakH * 0.5));
    };
    const rg = []; let topY = 1e9;
    for (let x = 0; x < W2; x++) { rg[x] = Math.round(ridge(x)); topY = Math.min(topY, rg[x]); }
    const litA = hex2rgb('#8b4690'), litB = hex2rgb('#a95390'), shA = hex2rgb('#2a1d5d'), shB = hex2rgb('#37276c');
    const snowL = hex2rgb('#fff0cf'), snowS = hex2rgb('#b9a2d8'), rimC = hex2rgb('#ffe6b0'), haze = hex2rgb('#a95a8d');
    const img = g.createImageData(W2, h);
    for (let x = 0; x < W2; x++) {
      const top = rg[x]; if (top > base) continue;
      const left = x > 0 ? rg[x - 1] : top, right = x < W2 - 1 ? rg[x + 1] : top;
      const facingSun = left > right;       // склон поднимается вправо → смотрит на солнце слева
      const snowLine = topY + peakH * 0.4 * (0.6 + 0.8 * fbm(n2, x * 0.13 + 5));
      for (let y = top; y <= base; y++) {
        const bay = (BAYER[y & 3][x & 3] + 0.5) / 16;
        const xb = ox + (fbm(n2, y * 0.11) - 0.5) * 16 + (y - topY) * 0.2 + (bay - 0.5) * 9;
        const lit = x < xb;
        const d = y - top;
        let col;
        const sn = y < snowLine + ((BAYER[y & 3][x & 3] > 8) ? 1 : -1) && d < peakH * 0.5;
        if (d < 1 && facingSun) col = rimC;
        else if (sn) col = lit ? snowL : snowS;
        else {
          const stria = n(x * 0.32 + y * 0.16) > 0.64;
          col = lit ? (stria ? litB : litA) : (stria ? shB : shA);
        }
        const fog = (y - (base - h * 0.07)) / (h * 0.07);
        if (fog > 0 && fog * 1.15 > (BAYER[y & 3][x & 3] + 0.5) / 16) col = haze;
        const o = (y * W2 + x) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    L.oly = c;
  }

  function buildHills() {
    const W2 = w + PAD * 2, c = mk(W2, h), g = c.getContext('2d'), n = makeNoise(41);
    const body = hex2rgb('#251a58'), haze = hex2rgb('#60337f'), rim = hex2rgb('#8a4a90');
    const img = g.createImageData(W2, h);
    for (let x = 0; x < W2; x++) {
      const top = Math.round(hor - h * 0.02 - h * 0.075 * fbm(n, x * 0.025 + 3));
      for (let y = top; y <= hor + 6; y++) {
        const t = (y - top) / (hor + 6 - top), thr = (BAYER[y & 3][x & 3] + 0.5) / 16;
        let col = (t < 0.18 && t * 5 < thr) ? haze : body;
        if (y === top) col = rim;
        const o = (y * W2 + x) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    L.hills = c;
  }

  function drawTemple(g, tx, baseY) {
    const col = '#0f0a2e', rim = '#d0745a', n = 6, kk = k * 1.3;
    const cw = Math.max(2, Math.round(2.4 * kk)), gap = Math.max(3, Math.round(3.4 * kk));
    const total = n * cw + (n - 1) * gap, left = Math.round(tx - total / 2);
    const stepH = Math.max(1, Math.round(1.6 * kk)), colH = Math.round(15 * kk), eh = Math.max(2, Math.round(3 * kk)), ph = Math.round(5.5 * kk);
    g.fillStyle = col;
    for (let i = 0; i < 3; i++) {
      const extra = (3 - i) * Math.max(2, Math.round(1.8 * kk));
      g.fillRect(left - extra, baseY - (i + 1) * stepH, total + extra * 2, stepH);
    }
    const yS = baseY - 3 * stepH;
    for (let i = 0; i < n; i++) {
      const x = left + i * (cw + gap);
      g.fillStyle = col; g.fillRect(x, yS - colH, cw, colH);
      g.fillRect(x - 1, yS - colH, cw + 2, 1);
      g.fillStyle = rim; g.fillRect(x, yS - colH + 1, 1, colH - 1);
    }
    const yE = yS - colH - eh;
    g.fillStyle = col; g.fillRect(left - 3, yE, total + 6, eh);
    const cx = left + total / 2;
    for (let r = 0; r < ph; r++) {
      const half = Math.round((total / 2 + 4) * (1 - r / ph));
      g.fillRect(Math.round(cx - half), yE - 1 - r, half * 2, 1);
    }
    g.fillStyle = rim; g.fillRect(left - 3, yE, 1, eh);
    for (let r = 0; r < ph; r++) { const half = Math.round((total / 2 + 4) * (1 - r / ph)); g.fillRect(Math.round(cx - half), yE - 1 - r, 1, 1); }
  }

  function buildGround() {
    const W2 = w + PAD * 2, c = mk(W2, h), g = c.getContext('2d'), n = makeNoise(77);
    const tx = Math.round(W2 * (portrait ? 0.3 : 0.17));
    const hillW = Math.max(46, W2 * 0.2);
    const body = hex2rgb('#150f3a'), deep = hex2rgb('#0a0724'), grass = hex2rgb('#2d2268'), rim = hex2rgb('#6f3a78');
    const img = g.createImageData(W2, h);
    const ridge = (x) => {
      const u = (x - tx) / hillW, bump = Math.max(0, 1 - u * u);
      return Math.round(hor + h * 0.045 - h * 0.075 * bump * bump - h * 0.015 * fbm(n, x * 0.03) - (x > W2 * 0.74 ? (x - W2 * 0.74) * 0.07 : 0));
    };
    let tBase = 0;
    for (let x = 0; x < W2; x++) {
      const top = ridge(x); if (Math.abs(x - tx) < 1) tBase = top;
      for (let y = top; y < h; y++) {
        const t = (y - top) / (h - top), thr = (BAYER[y & 3][x & 3] + 0.5) / 16;
        let col = t > 0.35 + thr * 0.6 ? deep : body;
        if (y === top) col = rim;
        else if (y - top < 3 && ((x * 7 + y * 13) % 9 === 0)) col = grass;
        const o = (y * W2 + x) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    drawTemple(g, tx, tBase + 1);
    L.ground = c; L.groundY = tBase;
  }

  function buildTrees() {
    const W2 = w + PAD * 2, c = mk(W2, h), g = c.getContext('2d'), r = rng(9);
    const baseY = Math.round(h * 1.0);
    const trees = portrait
      ? [[0.02, 0.36], [0.1, 0.27], [0.97, 0.33], [0.9, 0.24]]
      : [[0.025, 0.46], [0.07, 0.34], [0.115, 0.25], [0.975, 0.42], [0.93, 0.3]];
    trees.forEach(([fx, fh]) => {
      const cx = Math.round(PAD + w * fx), th = Math.round(h * fh), maxHW = Math.max(3, Math.round(th * 0.12));
      for (let y = 0; y < th; y++) {
        const t = y / th, prof = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.8);
        const hw = Math.max(0, Math.round(maxHW * prof * (0.85 + 0.15 * r())));
        for (let x = -hw; x <= hw; x++) {
          const edge = x === -hw;
          g.fillStyle = edge && r() < 0.6 ? '#5d2f6a' : (x > hw - 2 && r() < 0.5 ? '#07051a' : '#0b0825');
          g.fillRect(cx + x, baseY - th + y, 1, 1);
        }
      }
      g.fillStyle = '#0b0825'; g.fillRect(cx - 1, baseY - 3, 2, 3);
    });
    L.trees = c;
  }

  /* ───── сборка ───── */
  function build() {
    const vw = innerWidth, vh = innerHeight;
    S = Math.max(2, Math.round(vw / 300));
    w = Math.ceil(vw / S); h = Math.ceil(vh / S);
    portrait = h > w * 1.1;
    hor = Math.round(h * (portrait ? 0.7 : 0.66));
    k = Math.max(1, Math.min(2.4, h / 170));
    cv.width = w; cv.height = h;
    cv.style.width = w * S + 'px'; cv.style.height = h * S + 'px';
    buildSky();
    L.cFar = buildClouds(3, Math.max(5, Math.round(w / 38)), hor * 0.3, hor * 0.82, 0.55 * k, 0.9 * k,
      { rim: '#e29aa8', rim2: '#b46fa0', body: '#9a5c9c', shadow: '#6d4a96' });
    L.cMid = buildClouds(8, Math.max(4, Math.round(w / 55)), hor * 0.22, hor * 0.78, 0.8 * k, 1.25 * k,
      { rim: '#ffd0a0', rim2: '#f7a59a', body: '#e57f95', shadow: '#a14f93' });
    L.cNear = buildClouds(13, Math.max(3, Math.round(w / 90)), hor * 0.55, hor * 0.97, 1.1 * k, 1.7 * k,
      { rim: '#ffe4b8', rim2: '#ffbfa3', body: '#f29fa0', shadow: '#b95b8d' });
    buildFar(); buildOlympus(); buildHills(); buildGround(); buildTrees();

    const r = rng(101);
    stars = [];
    const ns = Math.round((w * hor) / 240);
    for (let i = 0; i < ns; i++) stars.push({ x: (r() * w) | 0, y: (r() * hor * 0.58) | 0, ph: r() * 6.28, sp: 0.6 + r() * 2.2, big: r() < 0.12 });
    birds = Array.from({ length: 3 }, (_, i) => ({ x: r() * w, y: hor * (0.5 + r() * 0.2), sp: 5 + r() * 6, ph: r() * 6 }));
    flies = Array.from({ length: Math.round(w / 12) }, () => ({ x: r() * w, y: hor + h * 0.05 + r() * h * 0.26, ph: r() * 6.28, sp: 0.8 + r() * 1.4, vx: (r() - 0.5) * 2, vy: (r() - 0.5) * 1.2 }));
    draw(performance.now());
  }

  function wrapDraw(c, off) {
    const o = ((Math.round(off) % w) + w) % w;
    ctx.drawImage(c, o, 0); ctx.drawImage(c, o - w, 0);
  }

  function draw(t) {
    const sec = (t - T0) / 1000;
    par.x += (tgt.x - par.x) * 0.06;
    const px = (f) => Math.round(par.x * AMP * f);
    ctx.drawImage(L.sky, 0, 0);
    /* звёзды */
    for (const s of stars) {
      const v = Math.sin(sec * s.sp + s.ph);
      if (v < -0.2) continue;
      ctx.fillStyle = v > 0.55 ? '#ffffff' : '#9fb0ff';
      const sx = s.x + px(0.1);
      ctx.fillRect(sx, s.y, 1, 1);
      if (s.big && v > 0.3) { ctx.fillRect(sx - 1, s.y, 3, 1); ctx.fillRect(sx, s.y - 1, 1, 3); }
    }
    wrapDraw(L.cFar, sec * 1.2 + px(0.2));
    /* птицы — тёмные силуэты на светлом небе у горизонта */
    ctx.fillStyle = '#2a1348';
    for (const b of birds) {
      const x = Math.round(((b.x + sec * b.sp) % (w + 20)) - 10) + px(0.4), y = Math.round(b.y + Math.sin(sec * 0.7 + b.ph) * 2);
      if (Math.sin(sec * 7 + b.ph) > 0) { ctx.fillRect(x - 2, y, 1, 1); ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + 1, y - 1, 1, 1); ctx.fillRect(x + 2, y, 1, 1); }
      else { ctx.fillRect(x - 2, y - 1, 1, 1); ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x + 2, y - 1, 1, 1); }
    }
    ctx.drawImage(L.far, -PAD + px(0.3), 0);
    wrapDraw(L.cMid, sec * 2.6 + px(0.45));
    ctx.drawImage(L.oly, -PAD + px(0.55), 0);
    wrapDraw(L.cNear, sec * 4.4 + px(0.65));
    ctx.drawImage(L.hills, -PAD + px(0.75), 0);
    ctx.drawImage(L.ground, -PAD + px(1), 0);
    ctx.drawImage(L.trees, -PAD + px(1.6), 0);
    /* светлячки */
    for (const f of flies) {
      f.x += f.vx * 0.02 * f.sp; f.y += f.vy * 0.02 * f.sp;
      if (f.x < 0) f.x = w; if (f.x > w) f.x = 0;
      if (f.y < hor + h * 0.04 || f.y > h * 0.98) f.vy = -f.vy;
      const v = Math.sin(sec * f.sp * 1.7 + f.ph);
      if (v < 0.1) continue;
      const x = Math.round(f.x) + px(1.2), y = Math.round(f.y);
      ctx.fillStyle = v > 0.7 ? '#f3ff9a' : '#a8c95a';
      ctx.fillRect(x, y, 1, 1);
      if (v > 0.75) { ctx.fillStyle = 'rgba(243,255,154,0.35)'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
    }
  }

  function loop(t) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    draw(t);
  }
  function resume() { if (running) return; running = true; cv.style.display = 'block'; raf = requestAnimationFrame(loop); }
  function pause() { running = false; cancelAnimationFrame(raf); cv.style.display = 'none'; }

  /* параллакс: мышь + наклон телефона */
  addEventListener('mousemove', (e) => { tgt.x = (e.clientX / innerWidth - 0.5) * -2; });
  addEventListener('deviceorientation', (e) => {
    if (e.gamma == null) return;
    tgt.x = Math.max(-1, Math.min(1, e.gamma / 25)) * -1;
  });
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { build(); }, 180); });

  build();
  return { resume, pause, rebuild: build, get running() { return running; } };
})();
