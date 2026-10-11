/* Пиксель-арт, нарисованный кодом: эмблемы богов 16×16, цифры, иконки.
   Никаких картинок — всё рисуется на canvas. */
(function () {
  'use strict';
  const N = 16;

  /* ───── цвет ───── */
  const BASE = {
    k: '#1b1330',                         // контур
    w: '#fff7e0', p: '#efe3c4',           // светлое
    g: '#f4c542', o: '#b8832b', y: '#ffe680', f: '#fff1a8', // золото
    n: '#8a5a34', N: '#5a3820', t: '#d8b98a',               // дерево/кожа
    s: '#c3ccd8', S: '#7c8696', a: '#3d4452',               // металл
    e: '#ff8a2a', r: '#e0453a',                              // огонь/рубин
    u: '#2fc4b2', B: '#6fb4ff', b: '#2a2050', v: '#cdb0ff',  // бирюза/синий/фиолет
    G: '#4f9a4a', h: '#8fcf6a'                               // зелень
  };
  function hex2rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgb2hex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  function mix(a, b, t) {
    const A = hex2rgb(a), B = hex2rgb(b);
    return rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  }
  function toHsl(h) {
    let [r, g, b] = hex2rgb(h).map(v => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let hh = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) hh = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) hh = (b - r) / d + 2;
      else hh = (r - g) / d + 4;
      hh /= 6;
    }
    return [hh, s, l];
  }
  function fromHsl(h, s, l) {
    const f = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    let r, g, b;
    if (s === 0) r = g = b = l;
    else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3);
    }
    return rgb2hex(r * 255, g * 255, b * 255);
  }
  /* Тёмные цвета (Атлас) подтягиваем, чтобы эмблема читалась на тёмной плитке. */
  function lift(c) {
    const [h, s, l] = toHsl(c);
    return l < 0.46 ? fromHsl(h, Math.min(1, s * 1.15), 0.52) : c;
  }
  function palette(color) {
    const c = lift(color || '#8888cc');
    return Object.assign({}, BASE, { c, l: mix(c, '#ffffff', 0.5), d: mix(c, '#000000', 0.42) });
  }

  /* ───── мини-язык рисования ───── */
  function api(g) {
    const p = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < N && y >= 0 && y < N) g[y][x] = c; };
    const r = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) p(x + i, y + j, c); };
    const mr = (x, y, w, h, c) => { r(x, y, w, h, c); r(N - x - w, y, w, h, c); };
    const mp = (x, y, c) => { p(x, y, c); p(N - 1 - x, y, c); };
    const line = (x0, y0, x1, y1, c) => {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        p(x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    };
    const disc = (cx, cy, rad, c) => {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= rad * rad) p(x, y, c);
    };
    const ring = (cx, cy, r0, r1, c) => {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d >= r0 && d <= r1) p(x, y, c);
      }
    };
    return { p, r, mr, mp, line, disc, ring, g };
  }

  /* ───── эмблемы ───── */
  const DRAW = {
    /* Гермес — кадуцей */
    hermes(d) {
      d.r(7, 1, 2, 1, 'y');
      d.r(7, 2, 2, 13, 'g'); d.r(8, 2, 1, 13, 'o');
      d.mr(1, 2, 2, 1, 'w'); d.mr(1, 3, 5, 1, 'w'); d.mr(2, 4, 5, 1, 'w'); d.mr(3, 5, 4, 1, 'l');
      d.r(5, 6, 2, 1, 'c'); d.r(4, 7, 2, 1, 'c'); d.r(5, 8, 2, 1, 'c'); d.r(6, 9, 4, 1, 'c');
      d.r(9, 10, 2, 1, 'c'); d.r(10, 11, 2, 1, 'c'); d.r(9, 12, 2, 1, 'c'); d.r(6, 13, 4, 1, 'c');
      d.r(9, 6, 2, 1, 'l'); d.r(10, 7, 2, 1, 'l'); d.r(9, 8, 2, 1, 'l');
      d.r(5, 10, 2, 1, 'l'); d.r(4, 11, 2, 1, 'l'); d.r(5, 12, 2, 1, 'l');
      d.p(4, 7, 'w');
    },
    /* Гера — корона с «павлиньим глазом» */
    hera(d) {
      const apex = [[3.5, 4], [8, 2], [12.5, 4]];
      for (let x = 2; x <= 13; x++) {
        let top = 9;
        for (const [ax, ay] of apex) top = Math.min(top, Math.round(ay + Math.abs(x + 0.5 - ax) * 1.3));
        d.r(x, top, 1, 13 - top, 'g');
      }
      d.r(2, 9, 12, 1, 'y'); d.r(2, 12, 12, 1, 'o');
      d.mr(4, 10, 2, 2, 'c'); d.mp(4, 10, 'l');
      d.r(6, 9, 4, 4, 'u'); d.r(7, 10, 2, 2, 'b'); d.p(7, 10, 'B');
      d.p(3, 3, 'w'); d.p(12, 3, 'w'); d.r(7, 1, 2, 1, 'w');
    },
    /* Харон — лодка, фонарь и обол */
    charon(d) {
      d.r(3, 5, 1, 4, 'N');
      d.r(2, 1, 3, 1, 'N'); d.r(2, 2, 3, 3, 'o'); d.p(3, 3, 'y'); d.p(3, 2, 'f');
      d.disc(12.3, 4.6, 2.5, 'g'); d.p(11, 3, 'y'); d.p(12, 3, 'y'); d.p(13, 5, 'o'); d.p(12, 6, 'o');
      d.r(1, 9, 14, 1, 't'); d.p(0, 8, 't'); d.p(1, 8, 't'); d.p(14, 8, 't'); d.p(15, 8, 't');
      d.r(2, 10, 12, 1, 'n'); d.r(3, 11, 10, 1, 'N'); d.r(5, 12, 6, 1, 'N');
      for (let x = 0; x < N; x++) {
        d.p(x, 13, x % 4 < 2 ? 'c' : 'l');
        d.p(x, 14, (x + 2) % 4 < 2 ? 'l' : 'c');
      }
    },
    /* Пандора — пифос с лёгким дымком */
    pandora(d) {
      const rows = { 5: [6, 9], 6: [5, 10], 7: [4, 11], 8: [3, 12], 9: [3, 12], 10: [3, 12], 11: [4, 11], 12: [5, 10], 13: [6, 9] };
      for (const y in rows) { const [a, b] = rows[y]; d.r(a, +y, b - a + 1, 1, 'c'); d.p(b, +y, 'd'); if (b - 1 > a) d.p(b - 1, +y, 'd'); d.p(a + 1, +y, 'l'); }
      d.r(6, 3, 4, 2, 'c'); d.r(5, 3, 6, 1, 'd');
      for (let x = 3; x <= 12; x++) d.p(x, 9, x % 2 ? 'g' : 'o');
      d.r(5, 2, 6, 1, 'y');
      d.r(6, 1, 6, 1, 'o'); d.r(6, 1, 4, 1, 'g');
      d.p(3, 2, 'v'); d.p(2, 1, 'v'); d.p(4, 0, 'v'); d.p(1, 3, 'v'); d.p(12, 0, 'v');
    },
    /* Аполлон — лира */
    apollo(d) {
      d.mr(2, 2, 2, 5, 'c'); d.mr(3, 7, 2, 1, 'c'); d.mr(4, 8, 2, 1, 'c');
      d.r(4, 2, 8, 2, 'o'); d.r(4, 2, 8, 1, 'g');
      d.r(6, 4, 1, 5, 'w'); d.r(9, 4, 1, 5, 'w'); d.r(4, 4, 1, 3, 'w'); d.r(11, 4, 1, 3, 'w');
      d.r(4, 9, 8, 1, 'c'); d.r(3, 10, 10, 2, 'c'); d.r(4, 12, 8, 1, 'c'); d.r(5, 13, 6, 1, 'd');
      d.r(4, 10, 2, 1, 'l'); d.r(10, 11, 2, 2, 'd');
      d.r(7, 11, 2, 2, 'b');
      d.p(1, 1, 'y'); d.p(14, 1, 'y'); d.p(8, 0, 'y');
    },
    /* Прометей — факел */
    prometheus(d) {
      d.r(7, 10, 2, 5, 'n'); d.r(8, 10, 1, 5, 'N');
      d.r(5, 8, 6, 1, 'o'); d.r(6, 9, 4, 1, 'o'); d.r(5, 8, 6, 1, 'g');
      d.p(8, 1, 'r'); d.r(7, 2, 2, 1, 'r'); d.r(6, 3, 4, 1, 'r');
      d.r(5, 4, 6, 4, 'r');
      d.r(7, 3, 2, 1, 'e'); d.r(6, 4, 4, 1, 'e'); d.r(6, 5, 4, 3, 'e');
      d.r(7, 5, 2, 3, 'f'); d.r(7, 6, 2, 2, 'y');
      d.p(4, 5, 'r'); d.p(11, 3, 'r'); d.p(10, 1, 'e'); d.p(3, 7, 'e');
    },
    /* Деметра — колос */
    demeter(d) {
      d.r(7, 1, 2, 14, 'g'); d.r(8, 1, 1, 14, 'o');
      d.r(7, 0, 2, 2, 'y');
      for (const y of [2, 4, 6, 8]) {
        d.r(5, y, 2, 2, 'g'); d.r(9, y, 2, 2, 'g');
        d.p(5, y, 'y'); d.p(9, y, 'y'); d.p(6, y + 1, 'o'); d.p(10, y + 1, 'o');
      }
      d.line(7, 13, 2, 9, 'c'); d.line(7, 12, 2, 8, 'l'); d.line(8, 13, 13, 10, 'c'); d.line(8, 12, 13, 9, 'l');
      d.line(7, 14, 3, 12, 'd'); d.line(8, 14, 12, 12, 'd');
    },
    /* Ника — лавровый венок со звездой */
    nike(d) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const dist = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
        if (dist >= 4.3 && dist <= 7 && !(y < 3 && Math.abs(x - 7.5) < 2.2)) d.p(x, y, (x * 3 + y * 5) % 4 === 0 ? 'l' : (x + y) % 3 === 0 ? 'd' : 'c');
      }
      d.p(3, 5, 'g'); d.p(12, 5, 'g'); d.p(3, 10, 'g'); d.p(12, 10, 'g');
      d.r(7, 6, 2, 4, 'y'); d.r(6, 7, 4, 2, 'y'); d.p(7, 7, 'w');
      d.r(6, 13, 4, 2, 'r'); d.p(5, 14, 'r'); d.p(10, 14, 'r');
    },
    /* Атлас — звёздная сфера */
    atlas(d) {
      d.disc(8, 8, 6.2, 'd');
      d.disc(7.4, 7.4, 5.4, 'c');
      d.disc(6.4, 6.4, 3.2, 'l');
      d.disc(6, 6, 2, 'c');
      d.ring(8, 8, 5.6, 6.2, 'c');
      for (let t = 0; t < 40; t++) {
        const a = (t / 40) * Math.PI * 2;
        d.p(8 + Math.cos(a) * 6.9 - 0.5, 8 + Math.sin(a) * 2.2 - 0.5, 'g');
        d.p(8 + Math.cos(a) * 2.2 - 0.5, 8 + Math.sin(a) * 6.9 - 0.5, 'o');
      }
      d.p(5, 5, 'w'); d.p(10, 9, 'y'); d.p(6, 10, 'y'); d.p(11, 5, 'w'); d.p(8, 12, 'y');
      d.r(13, 1, 1, 3, 'y'); d.r(12, 2, 3, 1, 'y');
    },
    /* ───── предметы для испытаний ───── */
    amphora(d) {
      d.r(6, 1, 4, 1, 'o'); d.r(7, 2, 2, 2, 'c');
      d.p(5, 3, 'o'); d.p(4, 4, 'o'); d.p(4, 5, 'o'); d.p(5, 6, 'o');
      d.p(10, 3, 'o'); d.p(11, 4, 'o'); d.p(11, 5, 'o'); d.p(10, 6, 'o');
      const rows = { 4: [6, 9], 5: [5, 10], 6: [4, 11], 7: [4, 11], 8: [4, 11], 9: [5, 10], 10: [5, 10], 11: [6, 9], 12: [6, 9] };
      for (const y in rows) { const [a, b] = rows[y]; d.r(a, +y, b - a + 1, 1, 'c'); d.p(b, +y, 'd'); d.p(a + 1, +y, 'l'); }
      for (let x = 4; x <= 11; x++) d.p(x, 8, x % 2 ? 'N' : 'g');
      d.r(6, 13, 4, 1, 'd'); d.r(5, 14, 6, 1, 'd');
    },
    helmet(d) {
      d.r(6, 1, 4, 1, 'r'); d.r(5, 2, 6, 1, 'r');
      d.r(4, 3, 8, 1, 's'); d.r(3, 4, 10, 3, 's'); d.r(3, 7, 10, 4, 's');
      d.r(4, 11, 2, 3, 's'); d.r(10, 11, 2, 3, 's');
      d.r(4, 7, 3, 1, 'a'); d.r(9, 7, 3, 1, 'a'); d.r(7, 7, 2, 6, 'a');
      d.r(4, 4, 3, 1, 'w'); d.r(3, 5, 1, 4, 'S'); d.r(12, 5, 1, 5, 'S');
    },
    column(d) {
      d.r(2, 2, 12, 1, 'w'); d.r(3, 3, 10, 1, 'p'); d.p(2, 3, 'p'); d.p(13, 3, 'p'); d.p(2, 4, 'S'); d.p(13, 4, 'S');
      d.r(5, 4, 6, 9, 'w'); d.r(10, 4, 1, 9, 'p');
      for (const x of [6, 8]) d.r(x, 4, 1, 9, 'p');
      d.r(3, 13, 10, 1, 'p'); d.r(2, 14, 12, 1, 'w');
    },
    phone(d) {
      d.r(4, 1, 8, 14, 'a'); d.r(5, 2, 6, 10, 'B'); d.r(5, 2, 6, 1, 'v'); d.r(5, 3, 2, 2, 'w');
      d.r(7, 13, 2, 1, 'S'); d.p(7, 1, 'S'); d.p(8, 1, 'S');
    },
    cup(d) {
      d.r(4, 1, 8, 1, 'a'); d.r(3, 2, 10, 2, 'a'); d.r(4, 4, 8, 1, 'w');
      for (let y = 5; y <= 13; y++) { const ins = (y - 5) >> 2; d.r(4 + ins, y, 8 - ins * 2, 1, y >= 7 && y <= 10 ? 'n' : 'w'); }
      d.r(6, 8, 4, 2, 'N');
    },
    car(d) {
      d.r(1, 9, 14, 3, 'r'); d.r(3, 6, 10, 3, 'r'); d.r(2, 8, 12, 1, 'r');
      d.r(4, 7, 3, 2, 'B'); d.r(9, 7, 3, 2, 'B'); d.p(14, 9, 'y'); d.p(1, 9, 'e');
      d.disc(4.5, 12.5, 2, 'a'); d.disc(11.5, 12.5, 2, 'a'); d.disc(4.5, 12.5, 0.9, 'S'); d.disc(11.5, 12.5, 0.9, 'S');
    },
    wisp(d) {
      d.disc(8, 7, 5, 'c'); d.r(3, 7, 10, 6, 'c');
      for (const x of [3, 6, 9, 12]) d.r(x, 13, 2, 1, 'c');
      d.r(4, 5, 3, 2, 'l'); d.r(5, 6, 2, 2, 'b'); d.r(9, 6, 2, 2, 'b'); d.r(7, 10, 2, 2, 'b'); d.p(5, 6, 'w'); d.p(9, 6, 'w');
    },
    chest(d) {
      d.r(2, 4, 12, 3, 'n'); d.r(2, 4, 12, 1, 't'); d.r(2, 7, 12, 7, 'n'); d.r(2, 7, 12, 1, 'N'); d.r(2, 13, 12, 1, 'N');
      d.r(4, 4, 1, 10, 'o'); d.r(11, 4, 1, 10, 'o'); d.r(7, 7, 2, 3, 'g'); d.p(8, 8, 'N');
    },
    coin(d) {
      d.disc(8, 8, 6, 'o'); d.disc(8, 8, 5, 'g'); d.ring(8, 8, 2.6, 3.8, 'y'); d.r(7, 7, 2, 2, 'o'); d.p(4, 5, 'f');
    },
    pouch(d) {
      d.disc(8, 10, 5, 'n'); d.r(6, 3, 4, 4, 'n'); d.r(5, 5, 6, 1, 'r'); d.r(4, 3, 8, 1, 'N'); d.p(5, 2, 'N'); d.p(10, 2, 'N');
      d.r(5, 9, 2, 2, 't'); d.r(5, 13, 6, 1, 'N');
    },
    owl(d) {
      d.r(4, 3, 8, 11, 'n'); d.r(5, 2, 6, 1, 'n'); d.p(4, 2, 'N'); d.p(11, 2, 'N');
      d.r(5, 10, 6, 3, 't'); d.disc(6, 6, 2, 'w'); d.disc(10, 6, 2, 'w'); d.p(6, 6, 'b'); d.p(10, 6, 'b'); d.r(7, 8, 2, 2, 'y');
      d.r(3, 6, 1, 6, 'N'); d.r(12, 6, 1, 6, 'N'); d.r(5, 14, 2, 1, 'y'); d.r(9, 14, 2, 1, 'y');
    },
    sphinx(d) {
      d.r(3, 9, 11, 4, 't'); d.r(1, 12, 5, 2, 't'); d.r(13, 8, 2, 1, 't'); d.p(14, 7, 'n');
      d.disc(5.5, 5.5, 3, 't'); d.r(2, 4, 2, 7, 'g'); d.r(8, 4, 1, 6, 'g'); d.r(3, 2, 5, 1, 'g'); d.r(4, 5, 1, 1, 'k'); d.r(7, 5, 1, 1, 'k');
      d.r(9, 5, 4, 4, 'w'); d.r(10, 4, 3, 1, 'p'); d.r(11, 9, 2, 1, 'p');
    },
    key(d) {
      d.ring(4.5, 7.5, 1.9, 4, 'g'); d.p(2, 5, 'y'); d.p(3, 4, 'y'); d.p(2, 6, 'y');
      d.r(8, 7, 7, 2, 'g'); d.r(8, 7, 7, 1, 'y');
      d.r(11, 9, 2, 3, 'g'); d.r(14, 9, 1, 2, 'g'); d.p(11, 11, 'o'); d.p(12, 11, 'o');
      d.r(9, 8, 1, 1, 'c');
    },
    /* мелочи */
    check(d) {
      d.line(2, 8, 6, 12, 'w'); d.line(2, 7, 6, 11, 'w'); d.line(6, 12, 13, 3, 'w'); d.line(6, 11, 13, 2, 'w');
    },
    question(d) {
      d.r(5, 2, 6, 2, 'w'); d.r(10, 4, 2, 3, 'w'); d.r(8, 7, 3, 2, 'w'); d.r(7, 9, 2, 2, 'w'); d.r(7, 12, 2, 2, 'w');
      d.r(4, 4, 2, 2, 'w');
    },
    star(d) {
      d.r(7, 2, 2, 12, 'y'); d.r(2, 7, 12, 2, 'y'); d.r(5, 5, 6, 6, 'y');
      d.r(7, 6, 2, 4, 'w'); d.r(6, 7, 4, 2, 'w');
      d.mp(3, 3, 'g'); d.mp(3, 12, 'g');
    },
    lock(d) {
      d.ring(8, 6, 3, 4.6, 'S'); d.r(3, 6, 10, 1, 'S');
      d.r(3, 7, 10, 7, 'g'); d.r(3, 7, 10, 1, 'y'); d.r(3, 13, 10, 1, 'o'); d.r(12, 7, 1, 7, 'o');
      d.r(7, 9, 2, 3, 'N'); d.disc(8, 9.4, 1.4, 'N');
    }
  };

  /* ───── сборка спрайта ───── */
  const cache = {};
  function grid(key, color) {
    const g = Array.from({ length: N }, () => Array(N).fill('.'));
    (DRAW[key] || DRAW.star)(api(g));
    return g;
  }
  function outlineGrid(g) {
    const o = g.map(r => r.slice());
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (g[y][x] !== '.') continue;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of nb) {
        const c = g[y + dy] && g[y + dy][x + dx];
        if (c && c !== '.') { o[y][x] = 'k'; break; }
      }
    }
    return o;
  }
  /* mode 'gray' — выцветший вариант для запертых кнопок */
  function sprite(key, color, mode) {
    const ck = key + '|' + (color || '') + '|' + (mode || '');
    if (cache[ck]) return cache[ck];
    const pal = palette(color);
    const g = outlineGrid(grid(key));
    const cv = document.createElement('canvas');
    cv.width = N; cv.height = N;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const ch = g[y][x]; if (ch === '.') continue;
      let [r, gg, b] = hex2rgb(pal[ch] || '#ff00ff');
      if (mode === 'gray') {
        const l = 0.3 * r + 0.59 * gg + 0.11 * b;
        const v = ch === 'k' ? 14 : l * 0.5 + 22;
        r = v; gg = v + 2; b = v + 8;
      }
      const i = (y * N + x) * 4;
      img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    cache[ck] = cv;
    return cv;
  }
  /* свежая копия canvas (чтобы вставлять в DOM несколько раз) */
  function clone(key, color, cls, mode) {
    const src = sprite(key, color, mode);
    const cv = document.createElement('canvas');
    cv.width = N; cv.height = N;
    cv.getContext('2d').drawImage(src, 0, 0);
    cv.className = 'sprite' + (cls ? ' ' + cls : '');
    return cv;
  }

  /* ───── пиксельные цифры 5×7 ───── */
  const DIGITS = {
    0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
    3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100']
  };
  function digits(value, opts) {
    opts = opts || {};
    const str = String(value), color = opts.color || '#fff7e0', shadow = opts.shadow;
    const W = str.length * 6 - 1 + (shadow ? 1 : 0), H = 7 + (shadow ? 1 : 0);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H; cv.className = 'digits';
    const ctx = cv.getContext('2d');
    const draw = (ox, oy, col) => {
      ctx.fillStyle = col;
      [...str].forEach((ch, i) => {
        const gl = DIGITS[ch]; if (!gl) return;
        gl.forEach((row, y) => [...row].forEach((v, x) => { if (v === '1') ctx.fillRect(ox + i * 6 + x, oy + y, 1, 1); }));
      });
    };
    if (shadow) draw(1, 1, shadow);
    draw(0, 0, color);
    return cv;
  }

  window.Sprites = { sprite, clone, digits, mix, lift, palette, hex2rgb, rgb2hex, keys: Object.keys(DRAW) };
})();
