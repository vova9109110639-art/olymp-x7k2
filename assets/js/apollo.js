/* Игра Аполлона: голос ведёт шарик по нотам песни.
   Микрофон → высота тона (алгоритм YIN) → положение шарика.
   За каждый чисто спетый куплет открывается часть кода станции. */
window.Apollo = (function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const freqToMidi = (f) => 69 + 12 * Math.log2(f / 440);
  const SAVE_KEY = 'quest.apollo';

  function load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } }
  function save(v) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(v)); } catch (e) { /* ok */ } }

  /* ───── определение высоты тона (YIN) ───── */
  function yin(buf, sr) {
    const W = buf.length >> 1;
    const minTau = Math.floor(sr / 1000), maxTau = Math.min(W - 1, Math.floor(sr / 75));
    const d = new Float32Array(maxTau + 1);
    let run = 0; d[0] = 1;
    for (let tau = 1; tau <= maxTau; tau++) {
      let sum = 0;
      for (let j = 0; j < W; j++) { const diff = buf[j] - buf[j + tau]; sum += diff * diff; }
      run += sum; d[tau] = run === 0 ? 1 : (sum * tau) / run;
    }
    let tau = minTau;
    while (tau < maxTau) {
      if (d[tau] < 0.16) { while (tau + 1 < maxTau && d[tau + 1] < d[tau]) tau++; break; }
      tau++;
    }
    if (tau >= maxTau || d[tau] >= 0.16) return -1;
    const x0 = d[tau - 1], x1 = d[tau], x2 = d[tau + 1];
    const denom = x0 + x2 - 2 * x1;
    const shift = denom !== 0 ? (x0 - x2) / (2 * denom) : 0;
    return sr / (tau + shift);
  }

  function open(opts) {
    const cfg = opts.cfg || {};
    /* Куплет — либо массив нот [[midi, доли], …] (старый формат, ровный темп),
       либо объект { dur, notes: [[midi, начало_с, конец_с], …], lines: [[{ t, d, w }, …], …] } — время в секундах от начала куплета,
       lines — строки для «караоке» (слово w звучит с t на протяжении d). */
    const verseOk = (v) => v && (Array.isArray(v) ? v.length : (v.notes && v.notes.length));
    const verses = (cfg.VERSES || []).filter(verseOk);
    const verseNotes = (v) => (Array.isArray(v) ? v : v.notes);
    const OFF = +cfg.AUDIO_OFFSET || 0;      // задержка звука (динамик ≈ 0.05 с, Bluetooth-наушники ≈ 0.15–0.25 с): ноты сдвигаются на неё
    if (!verses.length) { alert('В config.js не задан ни один куплет (APOLLO.VERSES).'); return; }
    const BPM = cfg.BPM || 84, BEAT = 60 / BPM, TOL0 = cfg.TOLERANCE || 1.1, HIT = cfg.HIT_RATIO || 0.5;
    /* Облегчения (все настраиваются в config.js → APOLLO):
       MIN_NOTE — ноты короче этого (сек) склеиваются в одну длинную: слова речитатива звучат по 0.2–0.3 с, угнаться за ними голосом нереально;
       MAX_GAP — пауза длиннее этой не склеивается;  PASS_RATIO — какая доля нот куплета должна быть спета (1 = без единого промаха);
       KEY_FREE — «чужая тональность»: игра подстраивается под высоту голоса поющего (важна мелодия, а не абсолютная нота);
       ASSIST — после каждой неудачной попытки куплета допуск шире, а нужная доля меньше. */
    const MIN_NOTE = +cfg.MIN_NOTE || 0, MAX_GAP = cfg.MAX_GAP != null ? +cfg.MAX_GAP : 0.5;
    const PASS = cfg.PASS_RATIO != null ? +cfg.PASS_RATIO : 1;
    const KEY_FREE = !!cfg.KEY_FREE, KEY_TAU = 3, KEY_MAX = 4, ASSIST = cfg.ASSIST !== false;
    const saved = load();
    const got = verses.map((_, i) => !!(saved.done && saved.done[i]));
    const color = opts.color || '#D9A441';

    /* диапазон нот */
    let lo = 200, hi = -1;
    verses.forEach((v) => verseNotes(v).forEach(([m]) => { if (m != null) { lo = Math.min(lo, m); hi = Math.max(hi, m); } }));
    lo -= 3; hi += 3; if (hi - lo < 12) { const c = (hi + lo) / 2; lo = c - 6; hi = c + 6; }

    Sound.hold(true);

    const ov = el('div', 'apollo');
    ov.innerHTML =
      '<div class="ap-top"><div class="ap-title">Песнь Аполлона</div><div class="ap-verse"></div><button class="px-btn small ghost ap-close" type="button">Закрыть</button></div>' +
      '<div class="ap-stage"><canvas class="ap-canvas"></canvas><div class="ap-flash"></div><div class="ap-lyrics" aria-live="off"></div><div class="ap-center"></div></div>' +
      '<div class="ap-bottom"><div class="ap-mic"><span>голос</span><i class="ap-meter"><b></b></i></div><div class="ap-code"></div><button class="ap-skip" type="button" title="для организатора">⏭</button></div>';
    document.getElementById('overlay-root').appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('on'));

    const stage = $('.ap-stage', ov), cvs = $('.ap-canvas', ov), center = $('.ap-center', ov), meter = $('.ap-meter b', ov), flashEl = $('.ap-flash', ov), lyricsEl = $('.ap-lyrics', ov);
    const ctx = cvs.getContext('2d');
    const P = innerWidth < 700 ? 3 : 4;
    let lw = 0, lh = 0, vlo = lo, vhi = hi;
    function resize() {
      const r = stage.getBoundingClientRect();
      lw = Math.max(80, Math.floor(r.width / P)); lh = Math.max(60, Math.floor(r.height / P));
      cvs.width = lw; cvs.height = lh;
      cvs.style.width = lw * P + 'px'; cvs.style.height = lh * P + 'px';
      ctx.imageSmoothingEnabled = false;
      /* вертикальный масштаб: не больше ~8 логических пикселей на полутон, чтобы ноты не раздувались */
      const span = Math.max(hi - lo, (lh - 16) / 8), mid = (hi + lo) / 2;
      vlo = mid - span / 2; vhi = mid + span / 2;
    }
    resize();
    window.addEventListener('resize', resize);

    /* ───── состояние ───── */
    const S = {
      mode: 'intro',          // intro | count | play | result | done
      verse: 0, t0: 0, songTime: -4 * BEAT, notes: [], dur: 0,
      micOK: false, demo: false, demoDown: false, demoMidi: 64,
      ballMidi: (lo + hi) / 2, octK: 0, voicedAt: -1e9, lastVoicedMidi: null, hist: [],
      rms: 0, trail: [], misses: 0, hits: 0, lastPenalty: 0, guideIdx: 0, backtrack: null, raf: 0, frame: 0,
      tol: TOL0, need: PASS, fails: [], keyOff: 0, fresh: false
    };
    ov._S = S;   // для проверки организатором
    let actx = null, analyser = null, stream = null, tbuf = null;

    /* ───── интерфейс ───── */
    function paintCode() {
      const box = $('.ap-code', ov); box.replaceChildren();
      verses.forEach((_, i) => {
        const s = el('span', 'ap-digit' + (got[i] ? ' got' : ''), got[i] ? '✓' : String(i + 1));
        box.appendChild(s);
      });
    }
    function paintVerse() { $('.ap-verse', ov).textContent = 'Куплет ' + (S.verse + 1) + ' из ' + verses.length; }
    function setCenter(html, cls) { center.className = 'ap-center ' + (cls || ''); center.innerHTML = html; }
    paintCode(); paintVerse();

    function showIntro(msg) {
      S.mode = 'intro';
      setCenter(
        '<h2>Спой, и шарик взлетит</h2>' +
        '<p>Нужен микрофон. Пой так, как тебе удобно, — важна только мелодия: длинные ноты едут к шарику слева, а голос ведёт его вверх и вниз. Не нужно попадать в каждое слово: держи высоту, пока нота рядом с шариком. Куплету хватит большей части нот.</p>' +
        (msg ? '<p class="ap-err">' + esc(msg) + '</p>' : '') +
        '<button class="px-btn gold big" type="button" id="ap-mic">Разрешить микрофон</button>' +
        '<button class="ap-link" type="button" id="ap-demo">проверка без голоса (для организатора)</button>', 'intro');
      $('#ap-mic', ov).addEventListener('click', enableMic);
      $('#ap-demo', ov).addEventListener('click', () => { S.demo = true; S.micOK = true; startVerse(firstOpen()); });
    }

    async function enableMic() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return showIntro('Микрофон недоступен: сайт нужно открыть по https:// или с localhost.');
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: cfg.MIC_AEC !== false, noiseSuppression: false, autoGainControl: false } });   // эхоподавление: музыка идёт из динамика того же телефона
        const AC = window.AudioContext || window.webkitAudioContext;
        actx = new AC();
        if (actx.state === 'suspended') await actx.resume();
        const src = actx.createMediaStreamSource(stream);
        analyser = actx.createAnalyser(); analyser.fftSize = 2048; src.connect(analyser);
        tbuf = new Float32Array(analyser.fftSize);
        S.micOK = true;
        startVerse(firstOpen());
      } catch (e) {
        showIntro('Не получилось включить микрофон. Разреши доступ в настройках браузера и попробуй ещё раз.');
      }
    }

    const firstOpen = () => { const i = got.findIndex((g) => !g); return i < 0 ? 0 : i; };

    /* ───── куплет ───── */
    /* склейка коротких нот: группа закрывается, когда набрала MIN_NOTE секунд или после паузы длиннее MAX_GAP;
       высота — медиана нот группы с весом по длительности */
    function simplify(list) {
      const out = []; let grp = [];
      const flush = () => {
        if (!grp.length) return;
        const tot = grp.reduce((a, n) => a + (n[2] - n[1]), 0);
        let acc = 0, med = grp[0][0];
        for (const n of grp.slice().sort((a, b) => a[0] - b[0])) { acc += n[2] - n[1]; if (acc >= tot / 2) { med = n[0]; break; } }
        out.push([med, grp[0][1], grp[grp.length - 1][2]]); grp = [];
      };
      list.forEach((n) => {
        if (grp.length && n[1] - grp[grp.length - 1][2] > MAX_GAP) flush();
        if (grp.length && grp[grp.length - 1][2] - grp[0][1] >= MIN_NOTE) flush();
        grp.push(n);
      });
      flush();
      /* одиночные совсем короткие ноты (после паузы с обеих сторон) спеть невозможно — их не требуем */
      const keep = out.filter((n) => n[2] - n[1] >= 0.35);
      return keep.length >= 3 ? keep : out;
    }

    function buildNotes(vi) {
      const vv = verses[vi];
      if (!Array.isArray(vv)) {                 // новый формат: время в секундах
        const out2 = (MIN_NOTE > 0 ? simplify(vv.notes) : vv.notes).map(([m, s, e]) => ({ m, s, e, inBand: 0, total: 0, state: 'wait' }));
        S.dur = Math.max(vv.dur || 0, ...out2.map((n) => n.e)) + 1.2;
        return out2;
      }
      let beat = 0; const out = [];
      verses[vi].forEach(([m, b]) => {
        if (m != null) out.push({ m, s: beat * BEAT, e: (beat + b) * BEAT, inBand: 0, total: 0, state: 'wait' });
        beat += b;
      });
      S.dur = beat * BEAT + 1.2;
      return out;
    }

    function startVerse(vi) {
      S.verse = vi; paintVerse();
      S.notes = buildNotes(vi); S.misses = 0; S.hits = 0; S.guideIdx = 0; S.trail.length = 0;
      const assist = ASSIST ? Math.min(3, S.fails[vi] || 0) : 0;       // сколько раз подряд куплет не удавался
      S.tol = TOL0 + 0.4 * assist; S.need = PASS >= 1 ? 1 : Math.max(0.45, PASS - 0.07 * assist);
      S.lines = Array.isArray(verses[vi]) ? null : (verses[vi].lines || null); S.lineIdx = -2; lyricsEl.replaceChildren();
      S.mode = 'count';
      const lead = 4 * BEAT;
      S.t0 = performance.now() + 600;
      S.songTime = -lead - 0.6;
      S.leadBeat = -1;
      center.className = 'ap-center count'; center.innerHTML = '';
      /* бэктрек куплета, если лежит файл: gods/05-apollo/backtrack-1.mp3 … */
      stopBacktrack();
      if (cfg.BACKTRACK) {
        const url = String(cfg.BACKTRACK).replace('{n}', vi + 1);
        const a = new Audio(); a.preload = 'auto'; a.src = url; a.volume = 0.9;
        a.addEventListener('error', () => { if (S.backtrack === a) S.backtrack = null; });
        S.backtrack = a;
      }
      S.started = false; S.bleed = 0;
      /* музыка играет из динамика телефона и попадает в микрофон: секунду «слушаем фон» → порог голоса */
      if (S.backtrack && S.micOK && !S.demo) {
        const a = S.backtrack; a.volume = +cfg.BACKTRACK_VOLUME || 0.8;
        S.mode = 'calib'; S.cal = { t0: performance.now(), v: [] };
        center.className = 'ap-center count'; center.innerHTML = '<p class="ap-cal">Слушаю музыку… помолчи секунду</p>';
        a.currentTime = 0; a.play().catch(() => { S.mode = 'count'; S.t0 = performance.now() + 600; });
      }
    }
    function stopBacktrack() { if (S.backtrack) { try { S.backtrack.pause(); } catch (e) { /* ok */ } S.backtrack = null; } }

    function penalty() {
      const now = performance.now();
      stage.classList.remove('hit'); void stage.offsetWidth; stage.classList.add('hit');
      flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go');
      Sound.fail();
      if (now - S.lastPenalty < 1200) return;
      S.lastPenalty = now;
      if (cfg.PENALTY_VIBRATE !== false && navigator.vibrate) navigator.vibrate(220);
      if (cfg.PENALTY_WEBHOOK) { try { fetch(cfg.PENALTY_WEBHOOK, { mode: 'no-cors' }).catch(() => {}); } catch (e) { /* ok */ } }
    }

    function endVerse() {
      S.mode = 'result'; stopBacktrack();
      const total = S.notes.length, need = Math.max(1, Math.ceil(total * S.need - 1e-9));
      const clean = S.hits >= need;
      if (clean) {
        S.fails[S.verse] = 0;
        got[S.verse] = true; const sv = load(); sv.done = got.slice(); save(sv);
        Sound.success(); paintCode();
      } else { S.fails[S.verse] = (S.fails[S.verse] || 0) + 1; Sound.fail(); }
      const allGot = got.every(Boolean);
      const nextI = got.findIndex((g, i) => !g && i !== S.verse);
      const easier = ASSIST && !clean && S.fails[S.verse] <= 3;
      setCenter(
        '<h2>' + (clean ? (S.misses === 0 ? 'Куплет чист!' : 'Куплет спет!') : 'Куплет не засчитан') + '</h2>' +
        '<p>' + (clean ? 'Нот спето: ' + S.hits + ' из ' + total + '.'
                       : 'Нот спето: ' + S.hits + ' из ' + total + ', нужно хотя бы ' + need + '. Спой ещё раз — боги терпеливы' + (easier ? ', и ноты станут чуть шире.' : '.')) + '</p>' +
        (allGot ? '<p>Все куплеты спеты. Аполлон доволен!</p><button class="px-btn gold big" type="button" id="ap-done">Готово</button>'
                 : clean ? '<button class="px-btn gold big" type="button" id="ap-next">Дальше</button>'
                 : '<button class="px-btn gold big" type="button" id="ap-again">Спеть ещё раз</button>'), 'result');
      const q = (id) => $(id, ov);
      if (q('#ap-done')) q('#ap-done').addEventListener('click', close);
      if (q('#ap-next')) q('#ap-next').addEventListener('click', () => startVerse(nextI >= 0 ? nextI : firstOpen()));
      if (q('#ap-again')) q('#ap-again').addEventListener('click', () => startVerse(S.verse));
    }

    /* ───── голос ───── */
    function readPitch(dt) {
      if (S.demo) {
        S.rms = S.demoDown ? 0.5 : 0;
        if (S.demoDown) { S.voicedAt = performance.now(); S.lastVoicedMidi = S.demoMidi; S.fresh = true; }
        return;
      }
      if (!analyser) return;
      analyser.getFloatTimeDomainData(tbuf);
      let sum = 0; for (let i = 0; i < tbuf.length; i++) sum += tbuf[i] * tbuf[i];
      S.rms = Math.sqrt(sum / tbuf.length);
      const thr = Math.max(0.014, (S.bleed || 0) * 2);          // порог голоса: выше фона музыки из динамика
      if (S.frame % 2 === 0 && S.rms > thr) {
        const f = yin(tbuf, actx.sampleRate);
        if (f > 70 && f < 1100) {
          S.hist.push(freqToMidi(f)); if (S.hist.length > 5) S.hist.shift();
          const sorted = S.hist.slice().sort((a, b) => a - b);
          S.lastVoicedMidi = sorted[sorted.length >> 1];
          S.voicedAt = performance.now(); S.fresh = true;
        }
      }
      if (S.rms <= thr) S.hist.length = 0;
    }

    function currentTarget() {
      let up = null;
      for (const n of S.notes) {
        if (S.songTime >= n.s && S.songTime <= n.e) return n;
        if (!up && n.s > S.songTime) up = n;
      }
      return up;
    }

    function updateBall(dt) {
      const voiced = performance.now() - S.voicedAt < 250;       // короткие провалы определения тона (согласные) не роняют шарик
      S.voiced = voiced;
      const tgt = currentTarget();
      if (voiced && S.lastVoicedMidi != null) {
        let m = S.lastVoicedMidi;
        if (cfg.OCTAVE_FREE !== false) {
          const ref = (tgt ? tgt.m : S.ballMidi) + (KEY_FREE ? S.keyOff : 0);
          const cand = m + 12 * S.octK;
          if (Math.abs(cand - ref) > 7) S.octK = Math.round((ref - m) / 12);
          m += 12 * S.octK;
        }
        if (KEY_FREE) {
          /* подстройка под тональность певца: медленно «догоняем» разницу между его голосом и нотой */
          if (S.fresh && tgt && S.songTime >= tgt.s && S.songTime <= tgt.e) {
            const diff = Math.max(-7, Math.min(7, m - tgt.m));
            S.keyOff += (diff - S.keyOff) * Math.min(1, dt / KEY_TAU);
            S.keyOff = Math.max(-KEY_MAX, Math.min(KEY_MAX, S.keyOff));
          }
          m -= S.keyOff;
        }
        m = Math.max(lo, Math.min(hi, m));
        S.ballMidi += (m - S.ballMidi) * Math.min(1, dt * 14);
      } else {
        S.ballMidi = Math.max(lo, S.ballMidi - dt * 3);
      }
      S.fresh = false;
    }

    function judge(dt) {
      for (const n of S.notes) {
        if (n.state === 'done') continue;
        const len = n.e - n.s, ws = n.s + Math.min(0.4, len * 0.3), we = n.e - Math.min(0.06, len * 0.1);   // начало ноты — время, чтобы взять высоту
        if (S.songTime >= ws && S.songTime <= we) {
          n.total += dt;
          if (S.voiced && Math.abs(S.ballMidi - n.m) <= S.tol) n.inBand += dt;
          n.state = 'live';
        }
        if (S.songTime > we && n.state !== 'done') {
          const ratio = n.total > 0 ? n.inBand / n.total : 0;
          n.state = 'done'; n.ok = ratio >= HIT;
          if (n.ok) S.hits++; else { S.misses++; penalty(); }
        }
      }
    }

    /* ───── отрисовка ───── */
    const yOf = (m) => 8 + (lh - 16) * (1 - (m - vlo) / (vhi - vlo));
    function draw() {
      const ballX = Math.round(lw * 0.26), pps = lw * 0.3, semi = (lh - 16) / (vhi - vlo);
      /* фон */
      const g = ctx.createLinearGradient(0, 0, 0, lh); g.addColorStop(0, '#1a1236'); g.addColorStop(1, '#0a0820');
      ctx.fillStyle = g; ctx.fillRect(0, 0, lw, lh);
      for (let m = Math.ceil(vlo); m <= vhi; m++) {
        const y = Math.round(yOf(m));
        ctx.fillStyle = (m % 12 === 0) ? 'rgba(255,226,138,.22)' : (m % 2 === 0 ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.025)');
        for (let x = (m * 3) % 6; x < lw; x += 6) ctx.fillRect(x, y, 3, 1);
      }
      ctx.fillStyle = 'rgba(255,226,138,.18)'; ctx.fillRect(ballX, 0, 1, lh);
      /* ноты */
      const bandH = Math.max(5, Math.round(S.tol * 2 * semi));
      for (const n of S.notes) {
        const x0 = Math.round(ballX + (n.s - S.songTime) * pps), w = Math.max(3, Math.round((n.e - n.s) * pps));
        if (x0 > lw || x0 + w < 0) continue;
        const yc = Math.round(yOf(n.m)), y0 = yc - (bandH >> 1);
        let col = '#d9a441', hl = '#ffe28a', sh = '#8a6420';
        if (n.state === 'live') { col = '#f6c95a'; hl = '#fff6cf'; sh = '#b8832b'; }
        if (n.state === 'done') { if (n.ok) { col = '#5fbf7a'; hl = '#a8f0b8'; sh = '#2f7a4a'; } else { col = '#c9483f'; hl = '#ff9a8a'; sh = '#7a2a28'; } }
        ctx.fillStyle = col; ctx.fillRect(x0, y0, w, bandH);
        ctx.fillStyle = hl; ctx.fillRect(x0 + 1, y0, w - 2, 1);
        ctx.fillStyle = sh; ctx.fillRect(x0 + 1, y0 + bandH - 1, w - 2, 1);
        ctx.fillStyle = '#0a0820'; ctx.fillRect(x0, y0, 1, 1); ctx.fillRect(x0 + w - 1, y0, 1, 1); ctx.fillRect(x0, y0 + bandH - 1, 1, 1); ctx.fillRect(x0 + w - 1, y0 + bandH - 1, 1, 1);
        if (n.state === 'live' && S.voiced && Math.abs(S.ballMidi - n.m) <= S.tol) {
          ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x0 + 1, y0 + 1, w - 2, bandH - 2);
        }
      }
      /* шлейф и шарик */
      if (S.frame % 2 === 0) { S.trail.push({ y: yOf(S.ballMidi), a: 1 }); if (S.trail.length > 16) S.trail.shift(); }
      S.trail.forEach((t, i) => {
        ctx.fillStyle = 'rgba(255,226,138,' + (0.08 + 0.3 * (i / S.trail.length)).toFixed(2) + ')';
        ctx.fillRect(ballX - (S.trail.length - i) * 3 - 1, Math.round(t.y) - 1, 3, 3);
      });
      const by = Math.round(yOf(S.ballMidi)), live = S.voiced;
      const R = 4;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const d = dx * dx + dy * dy;
        if (d > R * R + 1) continue;
        ctx.fillStyle = d > (R - 1) * (R - 1) ? (live ? '#b36a1f' : '#4a4468') : (d > 5 ? (live ? '#ffd24a' : '#8d86b0') : (live ? '#fff6cf' : '#c9c3e0'));
        ctx.fillRect(ballX + dx, by + dy, 1, 1);
      }
      if (live) { ctx.fillStyle = 'rgba(255,226,138,.35)'; ctx.fillRect(ballX - R - 2, by, 2, 1); ctx.fillRect(ballX + R + 1, by, 2, 1); ctx.fillRect(ballX, by - R - 2, 1, 2); ctx.fillRect(ballX, by + R + 1, 1, 2); }
    }

    /* ───── слова «как в караоке» ───── */
    const lineEnd = (ln) => ln[ln.length - 1].t + ln[ln.length - 1].d;
    function paintLyrics() {
      const on = !!(S.lines && S.lines.length) && (S.mode === 'count' || S.mode === 'play');
      lyricsEl.style.display = on ? '' : 'none';
      if (!on) return;
      const t = S.songTime;
      let idx = S.lines.findIndex((ln) => t < lineEnd(ln) + 0.4);   // первая строка, которая ещё не допета
      if (idx < 0) idx = S.lines.length;
      if (idx !== S.lineIdx) {
        S.lineIdx = idx; lyricsEl.replaceChildren();
        [idx, idx + 1].forEach((li, k) => {
          const ln = S.lines[li]; if (!ln) return;
          const row = el('div', 'ap-ly ' + (k ? 'next' : 'cur'));
          ln.forEach((w) => { const s = el('span', 'w'); s.textContent = w.w + ' '; row.appendChild(s); });
          lyricsEl.appendChild(row);
        });
      }
      const cur = lyricsEl.querySelector('.cur'), ln = S.lines[idx];
      if (cur && ln) {
        for (let i = 0; i < cur.children.length; i++) {
          const w = ln[i], sp = cur.children[i];
          const p = t <= w.t ? 0 : t >= w.t + w.d ? 1 : (t - w.t) / w.d;
          sp.style.setProperty('--p', (p * 100).toFixed(0) + '%');
          sp.classList.toggle('done', p >= 1); sp.classList.toggle('now', p > 0 && p < 1);
        }
      }
    }

    /* ───── главный цикл ───── */
    let tPrev = 0;
    function loop(t) {
      S.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.06, (t - (tPrev || t)) / 1000); tPrev = t; S.frame++;
      if (S.mode === 'calib') {
        readPitch(dt); S.cal.v.push(S.rms); meter.style.width = Math.min(100, S.rms * 600) + '%';
        if (performance.now() - S.cal.t0 > 1600) {
          const v = S.cal.v.slice().sort((x, y) => x - y); S.bleed = Math.min(0.2, v[Math.floor(v.length * 0.9)] || 0);
          if (S.backtrack) { try { S.backtrack.pause(); S.backtrack.currentTime = 0; } catch (e) { /* ok */ } }
          S.mode = 'count'; S.t0 = performance.now() + 500; S.leadBeat = -1; center.innerHTML = '';
        }
        S.songTime = -4 * BEAT;
      } else if (S.mode === 'count' || S.mode === 'play') {
        const raw = (performance.now() - S.t0) / 1000 - 4 * BEAT;   // время запуска звука; ноты и слова — с поправкой на задержку звука (OFF)
        S.songTime = raw - OFF;
        readPitch(dt); updateBall(dt);
        meter.style.width = Math.min(100, S.rms * 600) + '%';
        if (S.mode === 'count') {
          const beat = Math.floor((raw + 4 * BEAT) / BEAT);
          if (raw < 0 && beat !== S.leadBeat && beat >= 0) {
            S.leadBeat = beat; Sound.pluckFreq(beat === 3 ? 440 : 330, 0.5, 0);
            center.innerHTML = '<div class="ap-count">' + (4 - beat) + '</div>';
          }
          if (raw >= 0) {
            S.mode = 'play'; center.className = 'ap-center'; center.innerHTML = '';
            if (S.backtrack) S.backtrack.play().catch(() => { S.backtrack = null; });
          }
        } else {
          /* подсказка-лира, если нет файла бэктрека */
          if (cfg.GUIDE_NOTES !== false && !(S.backtrack && !S.backtrack.paused)) {
            while (S.guideIdx < S.notes.length && S.notes[S.guideIdx].s <= S.songTime) {
              Sound.pluckFreq(midiToFreq(S.notes[S.guideIdx].m + 12 * 0), 0.32, 0); S.guideIdx++;
            }
          }
          judge(dt);
          if (S.songTime >= S.dur) endVerse();
        }
      } else {
        meter.style.width = '0%';
        S.songTime = -4 * BEAT;
        if (S.mode === 'result' || S.mode === 'intro') { S.voiced = false; }
      }
      draw(); paintLyrics();
    }
    S.raf = requestAnimationFrame(loop);

    /* демо-режим: водить пальцем/мышью */
    const onPoint = (e) => {
      if (!S.demo) return;
      const r = cvs.getBoundingClientRect();
      const y = (e.clientY - r.top) / P;
      S.demoMidi = vlo + (1 - (y - 8) / (lh - 16)) * (vhi - vlo);
    };
    cvs.addEventListener('pointerdown', (e) => { if (S.demo) { S.demoDown = true; onPoint(e); } });
    cvs.addEventListener('pointermove', onPoint);
    addEventListener('pointerup', () => { S.demoDown = false; });

    /* пропуск куплета организатором */
    $('.ap-skip', ov).addEventListener('click', () => {
      const pin = prompt('Пин организатора — засчитать куплет');
      if (pin == null) return;
      if (pin !== String(window.QUEST_CONFIG.ADMIN_PIN)) { alert('Неверный пин'); return; }
      S.misses = 0; got[S.verse] = true; const sv = load(); sv.done = got.slice(); save(sv); paintCode();
      stopBacktrack();
      endVerseAsClean();
    });
    function endVerseAsClean() { S.misses = 0; S.hits = S.notes.length; S.mode = 'play'; S.songTime = S.dur; endVerse(); }

    $('.ap-close', ov).addEventListener('click', close);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);

    function close() {
      cancelAnimationFrame(S.raf); stopBacktrack();
      window.removeEventListener('resize', resize); document.removeEventListener('keydown', onKey);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (actx) { try { actx.close(); } catch (e) { /* ok */ } }
      Sound.hold(false);
      ov.classList.remove('on'); setTimeout(() => ov.remove(), 350);
      if (opts.onComplete && got.every(Boolean)) opts.onComplete();   // все куплеты спеты — станция пройдена
    }

    showIntro();
  }

  return { open };
})();
