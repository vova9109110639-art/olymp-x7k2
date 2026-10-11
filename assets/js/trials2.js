/* Дары Олимпа — испытания на canvas: паутина Стикса, похищение огня, веяние зерна, удержи небо. */
(function () {
  'use strict';
  const T = window.Trials;
  const rnd = T.rnd, clamp = T.clamp;

  /* пиксельная линия пером w×w */
  function pline(ctx, x0, y0, x1, y1, w, col) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy; ctx.fillStyle = col;
    for (let n = 0; n < 600; n++) {
      ctx.fillRect(x0, y0, w, w);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function disc(ctx, cx, cy, r, col) {
    ctx.fillStyle = col;
    for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y + 0.25)); ctx.fillRect(Math.round(cx) - w, Math.round(cy) + y, w * 2 + 1, 1); }
  }
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  /* ───────────── ХАРОН · Переправа через Стикс ───────────── */
  T.register('styx', {
    greek: 'ΣΤΥΞ', title: 'Переправа через Стикс',
    lead: 'Река — это нити. Коснёшься нити — коснёшься воды, и она вернёт тебя на берег. Проведи руку между нитей и забери тот мешочек, что тяжелее: в нём монета.',
    make(api) {
      const W = 120, H = 160, cv = api.canvas(W, H, 'styx-cv'), ctx = cv.getContext('2d');
      api.stage.appendChild(cv);
      const STR = [[0, 132, 88, 126], [120, 110, 32, 104], [0, 88, 88, 82], [120, 66, 32, 60], [0, 44, 84, 40]]
        .map((s, i) => ({ x0: s[0], y0: s[1], x1: s[2], y1: s[3], phase: i * 1.7, pl: 0 }));
      const heavyLeft = Math.random() < 0.5;
      const pouches = [{ x: 30, y: heavyLeft ? 24 : 17, heavy: heavyLeft }, { x: 90, y: heavyLeft ? 17 : 24, heavy: !heavyLeft }];
      const START = { x: 60, y: 152 }, R = 3.5;
      const coin = { x: START.x, y: START.y };
      const pouchImg = Sprites.sprite('pouch', '#8a5a34');
      let target = null, t = 0, flash = 0, nextPluck = 3.5, fails = 0, msgT = 0;
      function pts(s) {
        const out = [], off = 2.5 + Math.sin(t * 1.6 + s.phase) * 1 + s.pl * Math.sin(t * 19);
        for (let i = 0; i <= 8; i++) { const k = i / 8; out.push([s.x0 + (s.x1 - s.x0) * k, s.y0 + (s.y1 - s.y0) * k + Math.sin(Math.PI * k) * off]); }
        return out;
      }
      function touches(x, y) {
        for (const s of STR) { const p = pts(s); for (let i = 0; i < 8; i++) if (segDist(x, y, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]) < R + 0.6) return true; }
        return false;
      }
      function fail() {
        flash = 1; fails++; coin.x = START.x; coin.y = START.y; target = null; Sound.fail();
        api.status(fails < 3 ? 'Река коснулась тебя — назад, к берегу!' : 'Река коснулась тебя. Не спеши: нити качаются, но в такт.', 'bad'); msgT = 2.5;
      }
      function grab(p) {
        if (p.heavy) { api.win('Тяжёлый мешочек — в твоих руках!'); return; }
        coin.x = START.x; coin.y = START.y; target = null; Sound.locked();
        api.status('Пусто! Этот мешочек слишком лёгкий. Ищи тяжёлый.', 'bad'); msgT = 2.5;
      }
      const down = (e) => { e.preventDefault(); Sound.init(); try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } target = api.pos(cv, e); };
      cv.addEventListener('pointerdown', down);
      cv.addEventListener('pointermove', (e) => { if (target) target = api.pos(cv, e); });
      const up = () => { target = null; };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('lostpointercapture', up);
      api.status('Веди палец по экрану — рука идёт за ним. Тяжёлый мешочек — настоящий.');
      api.raf((dt) => {
        t += dt; flash = Math.max(0, flash - dt * 3); if (msgT > 0) { msgT -= dt; if (msgT <= 0) api.status('Тяжёлый мешочек — настоящий.'); }
        nextPluck -= dt;
        if (nextPluck <= 0) { STR[(Math.random() * STR.length) | 0].pl = 4.2; nextPluck = rnd(4, 6.5); api.status('Гермес дёрнул нить — течение!'); msgT = 1.6; Sound.wind(0.5); }
        STR.forEach((s) => { s.pl *= Math.exp(-dt * 1.6); });
        if (target) {
          let d = Math.hypot(target.x - coin.x, target.y - coin.y), left = Math.min(d, 75 * dt);
          while (left > 0 && d > 0.05) {
            const st = Math.min(0.6, left), k = st / d;
            coin.x += (target.x - coin.x) * k; coin.y += (target.y - coin.y) * k; left -= st;
            d = Math.hypot(target.x - coin.x, target.y - coin.y);
            if (touches(coin.x, coin.y)) { fail(); break; }
          }
          coin.x = clamp(coin.x, R, W - R); coin.y = clamp(coin.y, 8, H - R);
          for (const p of pouches) if (Math.hypot(coin.x - p.x, coin.y - (p.y + 3)) < 9) { grab(p); break; }
        }
        draw();
      });
      function draw() {
        /* вода */
        for (let y = 0; y < H; y += 2) { const k = y / H; ctx.fillStyle = k < 0.5 ? '#14243a' : '#0f1c2f'; ctx.fillRect(0, y, W, 2); }
        ctx.fillStyle = 'rgba(120,170,190,.28)';
        for (let i = 0; i < 16; i++) { const y = 14 + i * 9, x = ((i * 37 + t * (8 + (i % 3) * 3)) % (W + 20)) - 10; ctx.fillRect(x, y, 10, 1); }
        /* берега */
        ctx.fillStyle = '#3d3326'; ctx.fillRect(0, 0, W, 8); ctx.fillStyle = '#5a4a36'; ctx.fillRect(0, 7, W, 1);
        ctx.fillStyle = '#3d3326'; ctx.fillRect(0, 146, W, 14); ctx.fillStyle = '#5a4a36'; ctx.fillRect(0, 146, W, 1);
        /* мешочки */
        pouches.forEach((p, i) => {
          const sw = Math.sin(t * 1.4 + i * 2) * 1.2, sz = p.heavy ? 16 : 12;
          pline(ctx, p.x + sw, 0, p.x + sw, p.y - sz / 2 + 2, 1, '#8a6a46');
          ctx.drawImage(pouchImg, Math.round(p.x + sw - sz / 2), Math.round(p.y - sz / 2 + 3), sz, sz);
        });
        /* нити */
        STR.forEach((s) => {
          const p = pts(s);
          for (let i = 0; i < 8; i++) pline(ctx, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1], 1, s.pl > 1 ? '#fff3c4' : '#d9e6ee');
          ctx.fillStyle = '#f2c14e';
          [[s.x0, s.y0], [s.x1, s.y1]].forEach((q) => ctx.fillRect(Math.round(q[0]) - 1, Math.round(q[1]) - 1, 3, 3));
        });
        /* рука-монета */
        disc(ctx, coin.x, coin.y, 4, '#b8832b'); disc(ctx, coin.x, coin.y, 3, '#f4c542'); ctx.fillStyle = '#fff1a8'; ctx.fillRect(Math.round(coin.x) - 2, Math.round(coin.y) - 2, 2, 1);
        if (flash > 0) { ctx.fillStyle = 'rgba(255,60,50,' + (flash * 0.45).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }
      }
    }
  });

  /* ───────────── ПРОМЕТЕЙ · Похищение огня ───────────── */
  T.register('ember', {
    greek: 'ΠΥΡ', title: 'Похищение огня',
    lead: 'Донеси уголёк от солнца к людям. Ветер задувает его — раздувай огонь касаниями экрана, но не дай ему погаснуть.',
    make(api) {
      const W = 160, H = 90, cv = api.canvas(W, H, 'ember-cv'), ctx = cv.getContext('2d');
      api.stage.appendChild(cv);
      let fuel = 45, prog = 0, gust = 0, nextGust = 3, t = 0, flash = 0, sparks = [], lit = false;
      const tap = (e) => {
        e.preventDefault(); Sound.init(); if (lit) return;
        fuel = Math.min(115, fuel + 9); Sound.tick();
        const x = 14 + prog * 1.32, y = 70 - 4 - fuel * 0.1;
        for (let i = 0; i < 3; i++) sparks.push({ x, y, vx: rnd(-14, 14), vy: rnd(-34, -12), l: rnd(0.4, 0.9) });
      };
      cv.addEventListener('pointerdown', tap);
      api.status('Нажимай на экран — раздувай огонь!');
      api.raf((dt) => {
        if (lit) return;
        t += dt; flash = Math.max(0, flash - dt * 2.5);
        nextGust -= dt;
        if (nextGust <= 0 && gust <= 0) { gust = 1; nextGust = rnd(3.2, 5.2); Sound.wind(1); api.status('Порыв ветра! Раздувай!'); }
        if (gust > 0) { gust -= dt; if (gust <= 0) api.status('Нажимай на экран — раздувай огонь!'); }
        fuel -= (gust > 0 ? 40 : 12) * dt;
        if (fuel > 18) prog += 8.2 * dt;
        if (fuel <= 0) { fuel = 45; prog = 0; flash = 1; Sound.fail(); api.status('Огонь погас! Возвращайся к солнцу.', 'bad'); }
        if (prog >= 100) { lit = true; prog = 100; Sound.unlock(); FX.rain(['#ff7a2a', '#ffcf4a', '#e63b2e', '#fff1a8'], 120); draw(); api.win('Огонь у людей!'); return; }
        sparks.forEach((s) => { s.x += s.vx * dt; s.y += s.vy * dt; s.l -= dt; });
        sparks = sparks.filter((s) => s.l > 0);
        draw();
      });
      function flame(x, y, h, lit2) {
        for (let i = 0; i < h; i++) {
          const k = i / h, w = Math.max(1, Math.round((1 - k) * (3 + h * 0.18) + Math.sin(t * 17 + i * 1.3) * 0.8));
          const col = k < 0.3 ? '#fff1a8' : k < 0.6 ? '#ffcf4a' : k < 0.85 ? '#ff7a2a' : '#e63b2e';
          const sway = Math.round(Math.sin(t * 9 + i * 0.5) * (gust > 0 ? 2.5 : 1) * k) + (gust > 0 ? Math.round(k * 3) : 0);
          ctx.fillStyle = col; ctx.fillRect(Math.round(x - w / 2 + sway), Math.round(y - i), w, 1);
        }
      }
      function draw() {
        for (let y = 0; y < H; y += 2) {
          const k = y / H;
          ctx.fillStyle = k < 0.35 ? '#201244' : k < 0.55 ? '#5a2766' : k < 0.72 ? '#b04a52' : '#2a1a2e';
          ctx.fillRect(0, y, W, 2);
        }
        disc(ctx, 10, 50, 11, '#ffb347'); disc(ctx, 10, 50, 8, '#ffe28a'); disc(ctx, 10, 50, 4, '#fff6cf');
        ctx.fillStyle = '#1b1226'; ctx.fillRect(0, 74, W, 16);
        for (let x = 14; x < 148; x += 4) { ctx.fillStyle = '#4a3a55'; ctx.fillRect(x, 71, 2, 1); }
        /* очаг */
        ctx.fillStyle = '#6b5a74'; ctx.fillRect(138, 66, 18, 8); ctx.fillStyle = '#8a7794'; ctx.fillRect(138, 66, 18, 2);
        ctx.fillStyle = '#4a3320'; ctx.fillRect(141, 62, 12, 4); ctx.fillStyle = '#6b4a2e'; ctx.fillRect(143, 60, 8, 3);
        if (lit) flame(147, 60, 20, true);
        /* факел */
        const x = 14 + prog * 1.32;
        ctx.fillStyle = '#6b4a2e'; ctx.fillRect(Math.round(x) - 1, 62, 2, 12);
        ctx.fillStyle = '#4a3320'; ctx.fillRect(Math.round(x) - 2, 60, 4, 3);
        if (!lit) flame(x, 60, Math.max(3, Math.round(4 + Math.max(0, fuel) * 0.16)), false);
        /* ветер */
        if (gust > 0) { ctx.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 7; i++) { const yy = 30 + i * 7, xx = ((t * 260 + i * 53) % (W + 40)) - 30; ctx.fillRect(xx, yy, 18 + (i % 3) * 6, 1); } }
        sparks.forEach((s) => { ctx.fillStyle = s.l > 0.4 ? '#ffe28a' : '#ff9a3a'; ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1); });
        /* шкалы: огонь и путь */
        ctx.fillStyle = '#0b0714'; ctx.fillRect(4, 4, 52, 6); ctx.fillStyle = fuel > 18 ? '#ff9a3a' : '#e63b2e'; ctx.fillRect(5, 5, Math.max(0, Math.min(50, fuel * 0.45)), 4);
        ctx.fillStyle = '#0b0714'; ctx.fillRect(4, 80, W - 8, 6); ctx.fillStyle = '#f2c14e'; ctx.fillRect(5, 81, (W - 10) * prog / 100, 4);
        if (flash > 0) { ctx.fillStyle = 'rgba(255,60,50,' + (flash * 0.4).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }
      }
    }
  });

  /* ───────────── ДЕМЕТРА · Веяние зерна ───────────── */
  T.register('winnow', {
    greek: 'ΣΙΤΟΣ', title: 'Веяние зерна',
    lead: 'Деметра отделяет зерно от плевел ветром. Проведи пальцем по экрану, как веером: лёгкая шелуха улетит, тяжёлое зерно останется.',
    make(api) {
      const W = 120, H = 90, cv = api.canvas(W, H, 'winnow-cv'), ctx = cv.getContext('2d');
      api.stage.appendChild(cv);
      const NG = 80, NC = 46;
      let ps = [], w = 0, last = null, t = 0, wy = 50, reset = 0;
      function seed() {
        ps = [];
        for (let i = 0; i < NG + NC; i++) {
          const c = i >= NG, a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
          ps.push({ c, x: 60 + Math.cos(a) * r * 24, y: (c ? 56 : 62) + Math.sin(a) * r * 8 - (c ? 3 : 0), vx: 0, vy: 0, fly: false, gone: false,
            th: c ? 0.9 + Math.random() * 2.4 : 7 + Math.random() * 3, ph: Math.random() * 6 });
        }
        w = 0; last = null;
      }
      seed();
      const mv = (e) => {
        e.preventDefault(); const p = api.pos(cv, e), now = performance.now();
        if (last) { const dtm = Math.max(8, now - last.t) / 1000; w = clamp((p.x - last.x) / dtm / W, -9, 9) * 0.6 + w * 0.4; }
        last = { x: p.x, y: p.y, t: now }; wy = p.y;
      };
      cv.addEventListener('pointerdown', (e) => { Sound.init(); mv(e); try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } });
      cv.addEventListener('pointermove', mv);
      const end = () => { last = null; };
      cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end); cv.addEventListener('pointerleave', end);
      api.status('Проведи пальцем из стороны в сторону — вей зерно.');
      let swish = 0;
      api.raf((dt) => {
        t += dt; w *= Math.exp(-dt * 5); swish -= dt;
        if (Math.abs(w) > 1.4 && swish <= 0) { Sound.wind(0.35); swish = 0.4; }
        if (reset > 0) { reset -= dt; if (reset <= 0) { seed(); api.status('Проведи пальцем из стороны в сторону — вей зерно.'); } draw(); return; }
        let gone = 0, grains = 0;
        ps.forEach((p) => {
          if (p.gone) { if (p.c) gone++; return; }
          if (!p.fly && Math.abs(w) > p.th) {
            p.fly = true; const s = w > 0 ? 1 : -1;
            p.vx = s * (30 + Math.random() * 45); p.vy = -(6 + Math.random() * 30);
          }
          if (p.fly) {
            p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 38 * dt;
            if (p.x < -6 || p.x > W + 6 || p.y > H + 6) p.gone = true;
          } else if (p.c) { p.y += Math.sin(t * 5 + p.ph) * 0.05; }
          else if (Math.abs(w) > 1.2) { p.x += (Math.random() - 0.5) * 0.5; }
          if (!p.c) grains++;
        });
        if (grains < NG * 0.7) { api.status('Слишком сильно — зерно улетело! Начнём заново.', 'bad'); Sound.fail(); reset = 1.6; }
        else if (gone >= NC * 0.9) { draw(); api.win('Зерно чисто!'); return; }
        else api.status('Шелухи осталось: ' + (NC - gone));
        draw();
      });
      function draw() {
        for (let y = 0; y < H; y += 2) { const k = y / H; ctx.fillStyle = k < 0.4 ? '#7fa3c4' : k < 0.62 ? '#d9c98a' : '#8a6a3a'; ctx.fillRect(0, y, W, 2); }
        ctx.fillStyle = '#e8d27a'; for (let i = 0; i < 20; i++) ctx.fillRect(i * 6 + ((t * 3) | 0) % 6, 40 + (i % 3), 1, 6);
        /* плетёный поднос */
        ctx.fillStyle = '#6b4a2e'; ctx.fillRect(22, 66, 76, 10); ctx.fillStyle = '#8a6238'; ctx.fillRect(24, 64, 72, 3);
        ctx.fillStyle = '#4a3320'; for (let x = 24; x < 96; x += 4) ctx.fillRect(x, 68, 1, 7);
        ps.forEach((p) => {
          if (p.gone) return;
          if (p.c) { ctx.fillStyle = '#f4ecc8'; ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 1); ctx.fillStyle = '#cdbf88'; ctx.fillRect(Math.round(p.x) + 1, Math.round(p.y) + 1, 1, 1); }
          else { ctx.fillStyle = '#e8b83a'; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); ctx.fillStyle = '#fff1a8'; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
        });
        if (Math.abs(w) > 0.7) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.7, Math.abs(w) / 4).toFixed(2) + ')'; for (let i = 0; i < 7; i++) { const yy = clamp(wy - 12 + i * 4, 4, 60), xx = ((t * 300 * (w > 0 ? 1 : -1) + i * 41) % (W + 40) + W + 40) % (W + 40) - 20; ctx.fillRect(xx, yy, 6 + Math.min(14, Math.abs(w) * 3), 1); } }
        ctx.fillStyle = '#2a1d0a'; ctx.fillRect(4, 82, W - 8, 5);
        const done = ps.filter((p) => p.c && p.gone).length / NC;
        ctx.fillStyle = '#f2c14e'; ctx.fillRect(5, 83, Math.min(1, done / 0.9) * (W - 10), 3);
      }
    }
  });

  /* ───────────── АТЛАС · Удержи небо ───────────── */
  T.register('sky', {
    greek: 'ΟΥΡΑΝΟΣ', title: 'Удержи небо',
    lead: 'Атлас держит свод небесный на плечах. Нажимай на левую или правую половину экрана, чтобы наклонять опору. Не дай небесному шару скатиться — продержись десять секунд.',
    make(api) {
      const W = 120, H = 100, cv = api.canvas(W, H, 'sky-cv'), ctx = cv.getContext('2d');
      api.stage.appendChild(cv);
      const NEED = 10, PX = 60, PY = 62, LEN = 48;
      const bg = Array.from({ length: 36 }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.8, s: Math.random() * 6 }));
      let th = 0, x = 0, v = 0, input = 0, hold = 0, t = 0, shake = 0, started = false, fallMsg = 0;
      const set = (e) => { e.preventDefault(); Sound.init(); started = true; const p = api.pos(cv, e); input = p.x < W / 2 ? -1 : 1; };
      cv.addEventListener('pointerdown', (e) => { set(e); try { cv.setPointerCapture(e.pointerId); } catch (z) { /* ok */ } });
      cv.addEventListener('pointermove', (e) => { if (input) set(e); });
      const end = () => { input = 0; };
      cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
      const onKey = (e) => { if (e.key === 'ArrowLeft') { input = -1; started = true; } else if (e.key === 'ArrowRight') { input = 1; started = true; } };
      const onKeyUp = (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') input = 0; };
      document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKeyUp);
      api.ui.addCleanup(() => { document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKeyUp); });
      api.status('Нажми на экран, когда будешь готова. Левая половина — шар катится влево, правая — вправо.');
      api.raf((dt) => {
        if (!started) { draw(); return; }
        t += dt; shake = Math.max(0, shake - dt * 3); fallMsg = Math.max(0, fallMsg - dt);
        th += (input ? input * 1.7 : -th * 1.5) * dt; th = clamp(th, -0.5, 0.5);
        const wind = Math.sin(t * 0.9) * 22 + Math.sin(t * 2.3 + 1) * 14;
        v += (170 * Math.sin(th) + wind - 2.4 * v) * dt; x += v * dt;
        if (Math.abs(x) > 44) {
          x = 0; v = 0; th = 0; hold = 0; shake = 1; fallMsg = 1.6; Sound.fail();
        } else {
          hold += dt;
          if (hold >= NEED) { draw(); api.win('Небо удержано!'); return; }
        }
        if (fallMsg > 0) api.status('Небо накренилось! Начинай сначала.', 'bad');
        else api.status('Держи… ' + Math.max(0, Math.ceil(NEED - hold)) + ' с');
        draw();
      });
      function draw() {
        for (let y = 0; y < H; y += 2) { const k = y / H; ctx.fillStyle = k < 0.5 ? '#0d1240' : k < 0.8 ? '#1a1f5c' : '#2a2a5a'; ctx.fillRect(0, y, W, 2); }
        bg.forEach((s) => { ctx.fillStyle = (Math.sin(t * 2 + s.s) > 0.2) ? '#fff3c4' : '#7a86c8'; ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1); });
        const ox = (Math.random() - 0.5) * 3 * shake, oy = (Math.random() - 0.5) * 3 * shake;
        /* Атлас */
        ctx.fillStyle = '#5a3820'; ctx.fillRect(PX - 9 + ox, 86 + oy, 18, 14); ctx.fillStyle = '#8a5a34'; ctx.fillRect(PX - 7 + ox, 84 + oy, 14, 3);
        ctx.fillStyle = '#efe7d6'; ctx.fillRect(PX - 3 + ox, PY + oy, 6, 24); ctx.fillStyle = '#b9ad94'; ctx.fillRect(PX + 1 + ox, PY + oy, 2, 24);
        /* рычаг */
        const dx = Math.cos(th), dy = Math.sin(th);
        pline(ctx, PX - dx * LEN + ox, PY - dy * LEN + oy, PX + dx * LEN + ox, PY + dy * LEN + oy, 3, '#d4c9ae');
        pline(ctx, PX - dx * LEN + ox, PY - dy * LEN - 1 + oy, PX + dx * LEN + ox, PY + dy * LEN - 1 + oy, 1, '#fff6dc');
        ctx.fillStyle = '#f2c14e'; ctx.fillRect(PX - 2 + ox, PY - 2 + oy, 5, 5);
        /* шар неба */
        const bx = PX + dx * x + dy * 0 + ox, by = PY + dy * x - 10 + oy;
        disc(ctx, bx, by, 10, '#1f2a6e'); disc(ctx, bx, by, 9, '#2f3a8f');
        ctx.fillStyle = '#fff3c4';
        [[-4, -4], [3, -5], [5, 1], [-2, 3], [-6, 0], [1, 6], [-1, -1]].forEach((q) => ctx.fillRect(Math.round(bx + q[0]), Math.round(by + q[1]), 1, 1));
        ctx.fillStyle = '#8a96e8'; ctx.fillRect(Math.round(bx) - 6, Math.round(by) - 7, 3, 1);
        /* звёздочки-прогресс */
        for (let i = 0; i < NEED; i++) {
          const on = hold >= i + 1;
          ctx.fillStyle = on ? '#ffe28a' : '#2a3070'; ctx.fillRect(10 + i * 11, 6, 5, 1); ctx.fillRect(12 + i * 11, 4, 1, 5);
          if (on) { ctx.fillStyle = '#fff'; ctx.fillRect(12 + i * 11, 6, 1, 1); }
        }
      }
    }
  });
})();
