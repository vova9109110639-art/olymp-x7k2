/* Дары Олимпа — «инструменты станций»: диалог бога (там, где нет видео), клепсидра Геры,
   табло и колесо фантов Ники, загадка и голос-проводник Прометея, выбор пути Деметры.
   Тексты берутся из gods.js (поля speech и tool). */
(function () {
  'use strict';
  const U = () => window.QuestUI;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const spr = (key, color, cls) => Sprites.clone(key, color, cls);
  const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  function card(g, title, lead, cls) {
    const ui = U();
    const box = ui.el('section', 'tool ' + (cls || ''));
    box.innerHTML = '<h2 class="tool-title">' + ui.esc(title) + '</h2>' + (lead ? '<p class="tool-lead">' + ui.esc(ui.sub(lead)) + '</p>' : '') + '<div class="tool-body"></div>';
    return { box, body: box.querySelector('.tool-body') };
  }

  /* ───────────── ДИАЛОГ БОГА ───────────── */
  /* speech: ['реплика бога', { you: ['вариант 1', 'вариант 2'], then: ['ответ на 1', 'ответ на 2'] }, …] */
  function speech(g, opts) {
    const ui = U(), items = (g.speech || []).slice();
    const heard = (ui.store.get('spoken', []) || []).includes(g.id);
    const box = ui.el('section', 'speech');
    box.innerHTML =
      '<div class="speech-who"><span class="sp-ico"></span><b>' + ui.esc(g.name) + '</b><button class="sp-voice" type="button" hidden>Голос: выкл</button></div>' +
      '<div class="speech-log" aria-live="polite"></div><div class="speech-act"></div>';
    box.querySelector('.sp-ico').appendChild(ui.spriteFor(g));
    const log = box.querySelector('.speech-log'), act = box.querySelector('.speech-act'), vbtn = box.querySelector('.sp-voice');
    let i = 0, typing = false, timer = 0, voice = false, finished = false;
    const synth = window.speechSynthesis;
    if (synth && window.SpeechSynthesisUtterance) {
      vbtn.hidden = false;
      vbtn.addEventListener('click', () => { Sound.init(); voice = !voice; vbtn.textContent = 'Голос: ' + (voice ? 'вкл' : 'выкл'); if (!voice) synth.cancel(); });
    }
    const say = (t) => {
      if (!voice || !synth) return;
      synth.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'ru-RU'; u.rate = 0.95; u.pitch = 0.9; synth.speak(u);
    };
    ui.addCleanup(() => { clearInterval(timer); if (synth) synth.cancel(); });

    function typeLine(text, cls) {
      return new Promise((res) => {
        const p = ui.el('p', cls); log.appendChild(p); typing = true;
        let n = 0; say(text);
        const done = () => { clearInterval(timer); typing = false; p.textContent = text; log.scrollTop = log.scrollHeight; res(); };
        timer = setInterval(() => { n++; p.textContent = text.slice(0, n); log.scrollTop = log.scrollHeight; if (n % 3 === 0) Sound.type(); if (n >= text.length) done(); }, 22);
        log.onclick = () => { if (typing) done(); };
      });
    }
    function finish() {
      if (finished) return; finished = true;
      act.replaceChildren(ui.el('div', 'speech-end', 'Послание получено'));
      const h = ui.store.get('spoken', []) || []; if (!h.includes(g.id)) { h.push(g.id); ui.store.set('spoken', h); }
      if (opts && opts.onDone) opts.onDone();
    }
    function button(text, fn, cls) {
      const b = ui.el('button', 'px-btn small ' + (cls || 'gold'), ui.esc(text)); b.type = 'button';
      b.addEventListener('click', () => { Sound.init(); Sound.click(); fn(); });
      return b;
    }
    async function step() {
      act.replaceChildren();
      if (i >= items.length) return finish();
      const it = items[i++];
      if (typeof it === 'string') {
        await typeLine(ui.sub(it), 'god-line');
        if (i >= items.length) return finish();
        act.replaceChildren(button('Дальше', step));
      } else if (it && it.you) {
        const row = ui.el('div', 'speech-choices');
        it.you.forEach((t, k) => row.appendChild(button(ui.sub(t), async () => {
          act.replaceChildren();
          const p = ui.el('p', 'you-line', ui.esc(ui.sub(t))); log.appendChild(p);
          await ui.sleep(350);
          if (it.then && it.then[k]) await typeLine(ui.sub(it.then[k]), 'god-line');
          if (i >= items.length) return finish();
          act.replaceChildren(button('Дальше', step));
        }, 'ghost')));
        act.appendChild(row);
      } else step();
    }
    if (heard) {
      const p = ui.el('p', 'god-line', ui.esc('Я уже сказал тебе всё нужное. Если забыла — послушай ещё раз.'));
      log.appendChild(p);
      act.appendChild(button('Послушать снова', () => { log.replaceChildren(); i = 0; finished = false; step(); }, 'ghost'));
      finished = true; if (opts && opts.onDone) opts.onDone();
    } else setTimeout(step, 400);
    return box;
  }

  /* ───────────── ГЕРМЕС · Четыре сосуда ───────────── */
  function jars(g) {
    const ui = U(), o = g.tool || {}, list = o.jars || [];
    const { box, body } = card(g, 'Четыре сосуда', o.lead || 'Коснись сосуда, когда он найден.', 'jars');
    body.innerHTML = '<div class="jar-grid"></div><div class="jar-stat"></div>';
    const grid = body.querySelector('.jar-grid'), stat = body.querySelector('.jar-stat');
    let all = false;
    function paint() {
      const n = grid.querySelectorAll('.jar.on').length;
      stat.textContent = n < list.length ? 'Найдено сосудов: ' + n + ' из ' + list.length : 'Все сосуды найдены. Ключ — в одном из них.';
      stat.classList.toggle('good', n >= list.length);
      if (n >= list.length && !all) { all = true; Sound.success(); FX.burst(innerWidth / 2, innerHeight * 0.5, g.fx.colors.concat(['#ffe28a']), 40, 1.1); }
      if (n < list.length) all = false;
    }
    list.forEach((j, i) => {
      const b = ui.el('button', 'jar', '<span class="jar-ico"></span><b class="jar-name"></b><i class="jar-real"></i><span class="jar-ok"></span>'); b.type = 'button';
      b.querySelector('.jar-ico').appendChild(spr('amphora', j.color || '#c9693a'));
      b.querySelector('.jar-name').textContent = j.name; b.querySelector('.jar-real').textContent = j.real || '';
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        Sound.init(); const on = b.classList.toggle('on'); b.setAttribute('aria-pressed', String(on));
        if (on) { Sound.note(g.note + i * 2, 0.7); Sound.pop(); } else Sound.click();
        paint();
      });
      grid.appendChild(b);
    });
    paint();
    return box;
  }

  /* ───────────── ГЕРА · Клепсидра и колода карточек ───────────── */
  /* Вопросы лежат на бумажных карточках. Сайт отмеряет время звонка и считает карточки;
     когда все карточки пройдены, станция засчитывается сама (opts.onComplete). */
  function clepsydra(g, opts) {
    const ui = U(), o = Object.assign({ start: 60, step: 10, min: 10, cards: 5 }, g.tool || {});
    const N = Math.max(1, +o.cards || 5);
    const { box, body } = card(g, 'Клепсидра Геры', 'В колоде ' + N + ' карточек. Водяные часы отмеряют ' + o.start + ' секунд на звонок, каждая неудача сокращает следующую попытку на ' + o.step + ' секунд.', 'clep');
    body.innerHTML = '<div class="clep-pips"></div><div class="clep-main"><canvas class="clep-cv" width="48" height="72"></canvas><div class="clep-side"><div class="clep-time">' + fmt(o.start) + '</div><div class="clep-att"></div></div></div><div class="clep-btns"></div><ol class="clep-log"></ol>';
    const pips = body.querySelector('.clep-pips'), cv = body.querySelector('.clep-cv'), ctx = cv.getContext('2d'), tEl = body.querySelector('.clep-time'), aEl = body.querySelector('.clep-att'), btns = body.querySelector('.clep-btns'), logEl = body.querySelector('.clep-log');
    let cardNo = 0, fails = 0, dur = o.start, left = o.start, run = false, raf = 0, lastT = 0, lastSec = -1, done = false;
    const mk = (txt, cls, fn) => { const b = ui.el('button', 'px-btn small ' + cls, ui.esc(txt)); b.type = 'button'; b.addEventListener('click', () => { Sound.init(); fn(); }); return b; };
    const pipEls = Array.from({ length: N }, () => { const s = ui.el('i'); pips.appendChild(s); return s; });
    function draw() {
      ctx.clearRect(0, 0, 48, 72);
      const k = clamp(left / dur, 0, 1);
      const vessel = (y0, y1, fillTop, fillBot) => { /* колба-трапеция */
        for (let y = y0; y <= y1; y++) {
          const p = (y - y0) / (y1 - y0), half = 18 - Math.abs(p - 0.45) * 14;
          const x0 = Math.round(24 - half), w = Math.round(half * 2);
          ctx.fillStyle = '#d4c9ae'; ctx.fillRect(x0, y, 2, 1); ctx.fillRect(x0 + w - 2, y, 2, 1);
          ctx.fillStyle = '#2a2a5a'; ctx.fillRect(x0 + 2, y, w - 4, 1);
          if (p >= fillTop && p <= fillBot) { ctx.fillStyle = (y % 3) ? '#6fb4ff' : '#9cd0ff'; ctx.fillRect(x0 + 2, y, w - 4, 1); }
        }
      };
      vessel(2, 30, 1 - k, 1);
      vessel(40, 68, k, 1);
      ctx.fillStyle = '#d4c9ae'; ctx.fillRect(21, 30, 6, 10);
      ctx.fillStyle = '#2a2a5a'; ctx.fillRect(23, 30, 2, 10);
      if (run && left > 0) { ctx.fillStyle = '#9cd0ff'; ctx.fillRect(23, 31, 2, 9); ctx.fillStyle = '#6fb4ff'; for (let y = 31; y < 40; y += 3) ctx.fillRect(23, y + ((lastT / 90) | 0) % 3, 2, 1); }
      ctx.fillStyle = '#f2c14e'; ctx.fillRect(4, 0, 40, 2); ctx.fillRect(4, 70, 40, 2);
    }
    function show() {
      pipEls.forEach((s, i) => { s.className = i < cardNo ? 'on' : (i === cardNo && !done ? 'now' : ''); });
      aEl.textContent = done ? 'Колода пройдена!' : 'Карточка ' + (cardNo + 1) + ' из ' + N + ' · попытка ' + (fails + 1) + ' · ' + dur + ' с';
      btns.replaceChildren();
      if (done) return;
      if (!run) btns.appendChild(mk('Начать звонок', 'gold', start));
      else { btns.appendChild(mk('Ответ верный', 'gold', () => end(true))); btns.appendChild(mk('Неверно / не дозвонилась', 'ghost', () => end(false))); }
    }
    function start() { run = true; left = dur; lastT = performance.now(); lastSec = -1; Sound.click(); show(); loop(); }
    function loop() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame((t) => {
        if (!run) return;
        if (!box.isConnected) { run = false; return; }
        left -= (t - lastT) / 1000; lastT = t;
        const s = Math.ceil(left);
        if (s !== lastSec) { lastSec = s; if (s <= 5 && s > 0) Sound.tick(); }
        tEl.textContent = fmt(left); tEl.classList.toggle('low', left <= 10);
        draw();
        if (left <= 0) { Sound.gong(); end(false, true); return; }
        loop();
      });
    }
    function end(ok, timeout) {
      run = false; cancelAnimationFrame(raf);
      const used = Math.round(dur - Math.max(0, left));
      const label = 'Карточка ' + (cardNo + 1) + ', попытка ' + (fails + 1) + ': ';
      logEl.appendChild(ui.el('li', ok ? 'ok' : 'bad', (ok ? '✓ ' : '✗ ') + label + (ok ? 'верно, ' + used + ' с из ' + dur : timeout ? 'время вышло' : 'неверно, ' + used + ' с из ' + dur)));
      if (ok) {
        cardNo++; fails = 0; dur = o.start; left = dur;
        if (cardNo >= N) { finale(); return; }
        Sound.unlock(); FX.burst(innerWidth / 2, innerHeight * 0.45, g.fx.colors.concat(['#ffe28a']), 30, 1);
        tEl.textContent = fmt(dur); tEl.classList.remove('low'); draw(); show();
      } else {
        fails++; dur = Math.max(o.min, o.start - o.step * fails); left = dur; Sound.fail(); ui.shake(box);
        tEl.textContent = fmt(dur); tEl.classList.remove('low'); draw(); show();
      }
    }
    function finale() {
      done = true; left = 0; draw(); Sound.success(); FX.rain(g.fx.colors.concat(['#ffe28a']), 120);
      tEl.textContent = 'Верно!'; tEl.classList.remove('low'); show();
      body.appendChild(ui.el('p', 'tool-win', ui.esc(o.finale || 'Все карточки пройдены. Гера довольна: твои связи крепки.')));
      setTimeout(() => { if (opts && opts.onComplete) opts.onComplete(); }, 1700);
    }
    draw(); show();
    return box;
  }
  /* ───────────── НИКА · Минное поле ───────────── */
  /* Сайт хранит карту (какие клетки безопасны), Гермес касается клетки, на которую встала Юля.
     Мина → жребий: заморозка / усложнение следующей попытки / задание. Дошла до последнего ряда — станция засчитана. */
  function minefield(g, opts) {
    const ui = U(), o = Object.assign({ size: 5, safeCount: 13 }, g.tool || {});
    const N = clamp(Math.round(+o.size) || 5, 3, 7);
    const LET = 'ABCDEFG'.slice(0, N);
    const P = Object.assign({ freeze: [], next: [], now: [], weights: { freeze: 3, next: 4, now: 3 } }, o.penalties || {});
    const rnd = (n) => (Math.random() * n) | 0;
    const { box, body } = card(g, 'Минное поле Ники', o.lead || 'Гермес, касайся клетки, на которую встала Юля.', 'mine');
    body.innerHTML =
      '<div class="mf-info"></div>' +
      '<div class="mf-board"><div class="mf-lab">ФИНИШ</div><div class="mf-grid"></div><div class="mf-lab">СТАРТ</div></div>' +
      '<p class="mf-rule">Шаг — на соседнюю клетку вперёд: прямо или по диагонали. Касайся клетки, на которую встала Юля.</p>' +
      '<div class="mf-btns"></div><div class="mf-pen" hidden></div>';
    const info = body.querySelector('.mf-info'), grid = body.querySelector('.mf-grid'), btns = body.querySelector('.mf-btns'), pen = body.querySelector('.mf-pen');
    grid.style.setProperty('--n', N);

    /* ── карта ── */
    function canFinish(safe) {                         // есть ли путь от нижнего ряда к верхнему шагами вперёд
      let ok = safe[0].map(Boolean);
      for (let r = 1; r < N; r++) ok = safe[r].map((s, c) => s && [c - 1, c, c + 1].some((k) => k >= 0 && k < N && ok[k]));
      return ok.some(Boolean);
    }
    function genSafe() {
      if (Array.isArray(o.map) && o.map.length === N && o.map.every((row) => String(row).length === N)) {
        const m = o.map.map((row) => [...String(row)].map((ch) => ch === '#'));
        if (canFinish(m)) return m;
      }
      const safe = Array.from({ length: N }, () => Array(N).fill(false));
      let c = rnd(N); safe[N - 1][c] = true;
      for (let r = N - 2; r >= 0; r--) { const opt = [c - 1, c, c + 1].filter((k) => k >= 0 && k < N); c = opt[rnd(opt.length)]; safe[r][c] = true; }
      const free = []; safe.forEach((row, r) => row.forEach((s, k) => { if (!s) free.push([r, k]); }));
      for (let i = free.length - 1; i > 0; i--) { const j = rnd(i + 1); const t2 = free[i]; free[i] = free[j]; free[j] = t2; }
      let cnt = N; const want = clamp(Math.round(+o.safeCount) || 13, N, N * N - N);
      for (const [r, k] of free) { if (cnt >= want) break; safe[r][k] = true; cnt++; }
      return safe;
    }
    const sig = JSON.stringify([N, o.map || null, o.safeCount || 13]);
    function fresh() { return { sig, safe: genSafe(), known: Array.from({ length: N }, () => Array(N).fill(0)), pos: null, attempts: 1, hits: 0, comp: null, done: false }; }
    let S = ui.store.get('nike', null);
    if (!S || S.sig !== sig || !Array.isArray(S.safe) || S.safe.length !== N) S = fresh();
    const save = () => ui.store.set('nike', S);
    let busy = false, peek = false, hist = [], tmr = 0;
    const used = { freeze: [], next: [], now: [] };
    ui.addCleanup(() => clearInterval(tmr));

    /* ── отрисовка ── */
    function render() {
      info.innerHTML = 'Попытка <b>' + S.attempts + '</b> · мин: <b>' + S.hits + '</b>' + (S.comp ? '<div class="mf-comp">Усложнение этой попытки: ' + ui.esc(S.comp) + '</div>' : '');
      grid.replaceChildren();
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const k = S.known[r][c];
        const can = !S.done && !busy && (S.pos ? (r === S.pos.r - 1 && Math.abs(c - S.pos.c) <= 1) : r === N - 1);
        const b = ui.el('button', 'mf-cell ' + (k === 1 ? 'safe' : k === 2 ? 'mine' : 'unk') + (can ? ' next' : '') + (peek && S.safe[r][c] && !k ? ' peek' : '') + (S.pos && S.pos.r === r && S.pos.c === c ? ' here' : ''), '<i class="mf-co">' + LET[c] + (N - r) + '</i>');
        b.type = 'button'; b.setAttribute('aria-label', 'Клетка ' + LET[c] + (N - r));
        if (S.pos && S.pos.r === r && S.pos.c === c) b.appendChild(spr('nike', g.color, 'mf-nike'));
        b.addEventListener('click', () => tap(r, c));
        grid.appendChild(b);
      }
    }
    function snapshot() { hist.push(JSON.stringify(S)); if (hist.length > 30) hist.shift(); }

    /* ── шаг ── */
    function tap(r, c) {
      Sound.init();
      if (S.done || busy) return;
      if (S.pos) { if (!(r === S.pos.r - 1 && Math.abs(c - S.pos.c) <= 1)) { ui.toast('Шаг — на соседнюю клетку вперёд: прямо или по диагонали.'); ui.shake(grid); return; } }
      else if (r !== N - 1) { ui.toast('Начинай с первого ряда — у линии «СТАРТ».'); ui.shake(grid); return; }
      snapshot();
      if (S.safe[r][c]) {
        S.known[r][c] = 1; S.pos = { r, c }; Sound.note(4 + (N - 1 - r) * 2, 0.8); Sound.pop();
        if (r === 0) return win();
        save(); render();
      } else {
        S.known[r][c] = 2; boom();
      }
    }
    function win() {
      S.done = true; S.comp = null; busy = true; save(); render();
      Sound.success(); FX.rain(g.fx.colors.concat(['#ffe28a']), 130);
      info.innerHTML = '<b>Победа!</b> Поле пройдено: попыток ' + S.attempts + ', мин ' + S.hits + '.' + (o.finale ? '<div class="mf-comp">' + ui.esc(o.finale) + '</div>' : '');
      setTimeout(() => { if (opts && opts.onComplete) opts.onComplete(); }, 1800);
    }

    /* ── мина и жребий ── */
    function boom() {
      busy = true; S.hits++; S.attempts++; S.pos = null; S.comp = null; save();
      Sound.fail(); Sound.rumble(1); ui.shake(grid); render();
      pen.hidden = false; pen.className = 'mf-pen';
      pen.innerHTML = '<div class="mf-pt">МИНА!</div><p class="mf-ptx">Клетка не выдержала. Плати Олимпу — и начинай сначала.</p><div class="mf-pb"></div>';
      const pb = pen.querySelector('.mf-pb');
      const lot = ui.el('button', 'px-btn gold', 'Бросить жребий'); lot.type = 'button'; lot.addEventListener('click', () => { Sound.init(); pb.replaceChildren(); spin(); });
      const oops = ui.el('button', 'px-btn small ghost', 'Ошибся — отменить касание'); oops.type = 'button'; oops.addEventListener('click', () => { Sound.click(); undo(true); });
      pb.append(lot, oops);
      pen.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    function kindOf() {
      const ks = ['freeze', 'next', 'now'].filter((k) => P[k].length); if (!ks.length) return null;
      let tot = ks.reduce((s, k) => s + (P.weights[k] || 1), 0), x = Math.random() * tot;
      for (const k of ks) { x -= (P.weights[k] || 1); if (x <= 0) return k; }
      return ks[0];
    }
    function draw(kind) {
      const a = P[kind]; let pool = a.filter((_, i) => !used[kind].includes(i)); if (!pool.length) { used[kind] = []; pool = a.slice(); }
      const item = pool[rnd(pool.length)]; used[kind].push(a.indexOf(item)); return item;
    }
    function spin() {
      const kind = kindOf();
      if (!kind) { closePen(); return; }
      const titles = ['ЗАМОРОЗКА', 'УСЛОЖНЕНИЕ', 'ЗАДАНИЕ'], fin = { freeze: 0, next: 1, now: 2 }[kind];
      const title = pen.querySelector('.mf-pt'); pen.querySelector('.mf-ptx').textContent = 'Жребий брошен…';
      let i = 0, delay = 70; const steps = 15 + (((fin - 15) % 3) + 3) % 3;
      const tick = () => {
        title.textContent = titles[i % 3]; Sound.tick();
        if (i >= steps) return setTimeout(() => reveal(kind), 450);
        i++; delay *= 1.13; setTimeout(tick, delay);
      };
      tick();
    }
    function reveal(kind) {
      const item = draw(kind), pb = pen.querySelector('.mf-pb'), tx = pen.querySelector('.mf-ptx'), title = pen.querySelector('.mf-pt');
      pb.replaceChildren(); pen.classList.add(kind); Sound.pop();
      pen.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      const done = (label, fn) => { const b = ui.el('button', 'px-btn gold', ui.esc(label)); b.type = 'button'; b.addEventListener('click', () => { Sound.init(); Sound.click(); fn(); }); pb.appendChild(b); return b; };
      if (kind === 'freeze') {
        title.textContent = 'ЗАМОРОЗКА'; tx.textContent = item.text;
        let left = Math.max(5, +item.sec || 20);
        const cnt = ui.el('div', 'mf-count', String(left)); pb.appendChild(cnt);
        clearInterval(tmr);
        tmr = setInterval(() => {
          left--; cnt.textContent = String(Math.max(0, left)); if (left <= 3 && left > 0) Sound.tick();
          if (left <= 0) { clearInterval(tmr); Sound.unlock(); pb.replaceChildren(); pen.classList.add('thawed'); tx.textContent = 'Оттаяла! Возвращайся к старту.'; done('К старту', closePen); }
        }, 1000);
      } else if (kind === 'next') {
        title.textContent = 'УСЛОЖНЕНИЕ'; tx.textContent = item; S.comp = item; save();
        done('Принято', closePen);
      } else {
        title.textContent = 'ЗАДАНИЕ'; tx.textContent = item;
        done('Выполнено', closePen);
      }
    }
    function closePen() { clearInterval(tmr); pen.hidden = true; busy = false; hist = []; save(); render(); }

    /* ── кнопки ── */
    function undo(fromBoom) {
      if (busy && !fromBoom) return;
      const prev = hist.pop(); if (!prev) return;
      S = JSON.parse(prev); busy = false; pen.hidden = true; clearInterval(tmr); save(); render();
    }
    const mk = (txt, cls, fn) => { const b = ui.el('button', 'px-btn small ' + cls, ui.esc(txt)); b.type = 'button'; b.addEventListener('click', () => { Sound.init(); fn(); }); btns.appendChild(b); return b; };
    mk('Отменить касание', 'ghost', () => undo(false));
    mk('Карта (организатору)', 'ghost', () => {
      if (peek) { peek = false; render(); return; }
      const pin = prompt('Пин организатора — показать безопасные клетки'); if (pin == null) return;
      if (pin !== String(ui.CFG.ADMIN_PIN)) { alert('Неверный пин'); return; }
      peek = true; render(); setTimeout(() => { peek = false; render(); }, 8000);
    });
    mk('Поле заново', 'ghost', () => { if (!confirm('Создать новое поле и сбросить всё, что открыто?')) return; S = fresh(); hist = []; busy = false; pen.hidden = true; clearInterval(tmr); save(); render(); });
    save(); render();
    return box;
  }
  /* ───────────── ПРОМЕТЕЙ · загадка и голос-проводник ───────────── */
  function prometheus(g) {
    const ui = U(), o = g.tool || {};
    const { box, body } = card(g, 'Загадка Прометея', o.lead || 'Я не скажу прямо, что слепить. Отгадай — и повязка ляжет тебе на глаза.', 'prom');
    body.innerHTML = ((o.prep && o.prep.length) ? '<div class="prom-prep"><b>Гермес, подготовь кровать:</b><ul>' + o.prep.map((s) => '<li>' + ui.esc(s) + '</li>').join('') + '</ul></div>' : '') + '<blockquote class="prom-riddle">' + ui.esc(o.riddle || '') + '</blockquote><form class="seal-form"><input class="seal-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="24" placeholder="· · · ·" aria-label="Отгадка"><button class="px-btn gold" type="submit">Отгадать</button></form><p class="seal-msg" role="alert"></p><div class="prom-guide" hidden></div>';
    const form = body.querySelector('form'), inp = body.querySelector('input'), msg = body.querySelector('.seal-msg'), guide = body.querySelector('.prom-guide');
    let fails = 0, solved = false;
    form.addEventListener('submit', (e) => {
      e.preventDefault(); Sound.init(); if (solved) return;
      const v = ui.norm(inp.value); if (!v) { ui.shake(form); return; }
      if ((o.answers || ['сова']).map(ui.norm).includes(v)) {
        solved = true; Sound.success(); FX.burst(innerWidth / 2, innerHeight / 2, g.fx.colors, 40, 1.2);
        form.hidden = true; msg.classList.remove('on'); body.querySelector('.prom-riddle').classList.add('solved');
        msg.textContent = ''; showGuide();
      } else {
        fails++; ui.shake(form); Sound.fail();
        msg.textContent = fails >= 2 && o.hint ? o.hint : 'Не то. Прочитай загадку ещё раз.'; msg.classList.add('on'); inp.select();
      }
    });

    function showGuide() {
      guide.hidden = false;
      guide.innerHTML = '<p class="prom-ok">Верно: <b>сова</b>. Гермес, помоги ей надеть повязку.</p><button class="px-btn gold big" type="button" id="pg-go">Повязка надета — слушаю</button><div class="pg-run" hidden><div class="pg-step"></div><div class="pg-bar"><b></b></div><div class="pg-meta"></div><div class="pg-btns"></div></div>';
      guide.querySelector('#pg-go').addEventListener('click', () => { Sound.init(); Sound.click(); runGuide(); });
    }
    function runGuide() {
      const steps = o.guide || [], run = guide.querySelector('.pg-run'), stepEl = guide.querySelector('.pg-step'), bar = guide.querySelector('.pg-bar b'), meta = guide.querySelector('.pg-meta'), pb = guide.querySelector('.pg-btns');
      guide.querySelector('#pg-go').hidden = true; guide.querySelector('.prom-ok').hidden = true; run.hidden = false;
      const synth = window.speechSynthesis; let idx = -1, left = 0, total = 0, alive = true, voice = !!(synth && window.SpeechSynthesisUtterance), tmr = 0;
      const say = (t) => { if (!voice || !synth) return; synth.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'ru-RU'; u.rate = 0.9; synth.speak(u); };
      ui.addCleanup(() => { alive = false; clearInterval(tmr); if (synth) synth.cancel(); });
      const mk = (txt, cls, fn) => { const b = ui.el('button', 'px-btn small ' + cls, ui.esc(txt)); b.type = 'button'; b.addEventListener('click', () => { Sound.init(); fn(); }); pb.appendChild(b); return b; };
      mk('Дальше', 'gold', () => next());
      mk('Повторить', 'ghost', () => { if (idx >= 0 && idx < steps.length) say(steps[idx].text); });
      if (synth && window.SpeechSynthesisUtterance) { const vb = mk('Голос: вкл', 'ghost', () => { voice = !voice; vb.textContent = 'Голос: ' + (voice ? 'вкл' : 'выкл'); if (!voice) synth.cancel(); }); }
      function next() {
        idx++;
        if (idx >= steps.length) {
          clearInterval(tmr); if (synth) synth.cancel(); Sound.gong();
          stepEl.textContent = 'Время! Сними повязку и посмотри, что получилось. Сова — твой сувенир.'; bar.style.width = '100%'; meta.textContent = ''; pb.replaceChildren(); return;
        }
        const s = steps[idx]; left = total = s.sec || 30;
        stepEl.textContent = s.text; say(s.text); Sound.blip(440 + idx * 40, 0.2, 0.2);
        meta.textContent = 'Шаг ' + (idx + 1) + ' из ' + steps.length;
      }
      clearInterval(tmr);
      tmr = setInterval(() => {
        if (!alive || !box.isConnected) { clearInterval(tmr); return; }
        if (idx < 0 || idx >= steps.length) return;
        left -= 0.25; bar.style.width = clamp((1 - left / total) * 100, 0, 100) + '%';
        if (left <= 0) next();
      }, 250);
      setTimeout(next, 1200);
    }
    return box;
  }

  /* ───────────── ДЕМЕТРА · дегустация вслепую ───────────── */
  /* jams: [{ answer, color, hint, line }] — по порядку розеток; за верный ответ открывается строка загадки */
  function tasting(g) {
    const ui = U(), o = g.tool || {}, jams = o.jams || [];
    const { box, body } = card(g, 'Дегустация Деметры', o.lead || 'Коснись названия, которое назвала Юля.', 'taste');
    body.innerHTML =
      '<div class="tj-slots"></div>' +
      '<div class="tj-panel"><div class="tj-ask"></div><div class="tj-opts"></div><p class="tj-msg" role="alert"></p><div class="tj-btns"></div></div>' +
      '<div class="tj-riddle" hidden><div class="tj-rl">Загадка Деметры</div><div class="tj-lines"></div></div>' +
      '<p class="tj-end" hidden></p>';
    const slots = body.querySelector('.tj-slots'), panel = body.querySelector('.tj-panel'), ask = body.querySelector('.tj-ask'), optsEl = body.querySelector('.tj-opts'),
      msg = body.querySelector('.tj-msg'), btns = body.querySelector('.tj-btns'), riddle = body.querySelector('.tj-riddle'), lines = body.querySelector('.tj-lines'), end = body.querySelector('.tj-end');
    const synth = window.speechSynthesis;
    let voice = !!(synth && window.SpeechSynthesisUtterance), idx = 0, wrong = 0, busy = false;
    const say = (t) => { if (!voice || !synth) return; synth.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'ru-RU'; u.rate = 0.92; synth.speak(u); };
    ui.addCleanup(() => { if (synth) synth.cancel(); });
    if (voice) {
      const vb = ui.el('button', 'px-btn small ghost', 'Голос: вкл'); vb.type = 'button';
      vb.addEventListener('click', () => { Sound.init(); voice = !voice; vb.textContent = 'Голос: ' + (voice ? 'вкл' : 'выкл'); if (!voice) synth.cancel(); });
      btns.appendChild(vb);
    }
    const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
    const slotEls = jams.map((j, i) => {
      const s = ui.el('div', 'tj-slot', '<span class="tj-ico"></span><b>' + (i + 1) + '</b>');
      s.querySelector('.tj-ico').appendChild(spr('amphora', j.color || '#c2314f')); slots.appendChild(s); return s;
    });
    function round() {
      if (idx >= jams.length) return finish();
      const j = jams[idx]; wrong = 0; busy = false;
      slotEls.forEach((s, i) => { s.classList.toggle('now', i === idx); s.classList.toggle('done', i < idx); });
      ask.innerHTML = 'Розетка <b>' + (idx + 1) + '</b>: что это за варенье?';
      msg.textContent = ''; msg.className = 'tj-msg';
      const pool = shuffle((o.options || []).filter((n) => n !== j.answer));
      optsEl.replaceChildren();
      shuffle([j.answer].concat(pool.slice(0, 5))).forEach((name) => {
        const b = ui.el('button', 'tj-opt', ui.esc(name)); b.type = 'button';
        b.addEventListener('click', () => pick(b, name, j));
        optsEl.appendChild(b);
      });
    }
    function pick(b, name, j) {
      Sound.init();
      if (busy || b.disabled) return;
      if (name === j.answer) {
        busy = true; b.classList.add('good');
        optsEl.querySelectorAll('button').forEach((x) => { x.disabled = true; });
        Sound.unlock(); FX.burst(innerWidth / 2, innerHeight * 0.45, g.fx.colors.concat([j.color || '#ffe28a']), 30, 1);
        msg.textContent = 'Верно: ' + name + '!'; msg.className = 'tj-msg on good';
        slotEls[idx].classList.add('done'); slotEls[idx].classList.remove('now');
        riddle.hidden = false;
        const p = ui.el('p', 'tj-line', ui.esc(j.line || '')); lines.appendChild(p);
        setTimeout(() => say(j.line || ''), 700);
        setTimeout(() => { idx++; round(); }, 3200);
      } else {
        b.disabled = true; b.classList.add('bad'); wrong++; Sound.fail(); ui.shake(optsEl);
        msg.textContent = wrong >= 2 && j.hint ? 'Подсказка: ' + j.hint : 'Не то. Распробуй ещё раз.'; msg.className = 'tj-msg on';
      }
    }
    function finish() {
      panel.hidden = true; slotEls.forEach((s) => { s.classList.remove('now'); s.classList.add('done'); });
      end.hidden = false; end.textContent = o.finale || 'Все вкусы узнаны!';
      Sound.success(); FX.rain(g.fx.colors.concat(['#ffe28a']), 120); setTimeout(() => say(o.finale || ''), 600);
    }
    if (!jams.length) { panel.hidden = true; end.hidden = false; end.textContent = 'Варенья ещё не заданы (gods.js → tool.jams).'; } else round();
    return box;
  }
  /* ───────────── АТЛАС · наперсток и созвездие ───────────── */
  /* 1) отметки наперстка (Гермес): сначала мешочек с ключом, потом с монетой; 2) конструктор созвездия: звёзды перетаскиваются
     в небо, форма проверяется без привязки к месту и масштабу; когда всё верно — станция засчитывается сама. */
  function hungarian(cost) {
    const n = cost.length, INF = 1e9;
    const u = new Array(n + 1).fill(0), v = new Array(n + 1).fill(0), p = new Array(n + 1).fill(0), way = new Array(n + 1).fill(0);
    for (let i = 1; i <= n; i++) {
      p[0] = i; let j0 = 0; const minv = new Array(n + 1).fill(INF), used = new Array(n + 1).fill(false);
      do {
        used[j0] = true; const i0 = p[j0]; let delta = INF, j1 = 0;
        for (let j = 1; j <= n; j++) if (!used[j]) {
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (let j = 0; j <= n; j++) { if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta; }
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const a = new Array(n).fill(0); for (let j = 1; j <= n; j++) a[p[j] - 1] = j - 1; return a;
  }
  /* pts: [{x,y,m}], tg: [{x,y,m}] → для каждой звезды расстояние до её места в узоре (в долях среднего радиуса узора) */
  function assessShape(pts, tg) {
    const norm = (a) => {
      const cx = a.reduce((s, q) => s + q.x, 0) / a.length, cy = a.reduce((s, q) => s + q.y, 0) / a.length;
      const r = Math.sqrt(a.reduce((s, q) => s + (q.x - cx) ** 2 + (q.y - cy) ** 2, 0) / a.length) || 1;
      return a.map((q) => ({ x: (q.x - cx) / r, y: (q.y - cy) / r, m: q.m }));
    };
    const P = norm(pts), T = norm(tg);
    const cost = P.map((a) => T.map((b) => Math.hypot(a.x - b.x, a.y - b.y) + 0.12 * Math.abs(a.m - b.m)));
    const asg = hungarian(cost);
    const d = P.map((a, i) => Math.hypot(a.x - T[asg[i]].x, a.y - T[asg[i]].y));
    return { asg, d };
  }

  function atlas(g, opts) {
    const ui = U(), o = g.tool || {}, C = o.constellation || { stars: [], lines: [] }, N = C.stars.length;
    const wrap = ui.el('div', 'atlas-tool');
    const S = Object.assign({ key: false, coin: false }, ui.store.get('atlas', {}) || {});

    /* ── 1. наперсток ── */
    const th = card(g, 'Наперсток Гермеса', o.thimbleLead || 'Сначала мешочек с ключом, потом — с монетой.', 'thim');
    th.body.innerHTML = '<div class="th-rows"></div>';
    const rows = th.body.querySelector('.th-rows');
    const steps = [
      { id: 'key', title: 'Мешочек с ключом', btn: 'Ключ найден' },
      { id: 'coin', title: 'Мешочек с монетой', btn: 'Монета найдена' }
    ];
    const cons = card(g, 'Созвездие ' + (C.name || ''), o.consLead || 'Собери созвездие по звёздам.', 'cons');
    cons.box.hidden = true;
    function paintSteps() {
      rows.replaceChildren();
      steps.forEach((s, i) => {
        const row = ui.el('div', 'th-row' + (S[s.id] ? ' done' : '') + (i === 1 && !S.key ? ' wait' : ''));
        row.innerHTML = '<span class="th-n">' + (i + 1) + '</span><b>' + ui.esc(s.title) + '</b>';
        if (S[s.id]) row.appendChild(ui.el('span', 'th-ok', 'найдено'));
        else {
          const b = ui.el('button', 'px-btn small gold', ui.esc(s.btn)); b.type = 'button'; b.disabled = i === 1 && !S.key;
          b.addEventListener('click', () => { Sound.init(); S[s.id] = true; ui.store.set('atlas', S); Sound.success(); FX.burst(innerWidth / 2, innerHeight * 0.5, g.fx.colors.concat(['#ffe28a']), 28, 1); paintSteps(); if (S.key && S.coin) openCons(true); });
          row.appendChild(b);
        }
        rows.appendChild(row);
      });
    }
    paintSteps();

    /* ── 2. конструктор созвездия ── */
    const W = 300, H = 390, RACK = 292, SCALE = 128, CX = 150, CY = 146;
    cons.body.innerHTML = '<canvas class="cons-cv" width="' + W + '" height="' + H + '"></canvas><div class="cons-stat"></div><div class="cons-btns"></div>';
    const cv = cons.body.querySelector('.cons-cv'), ctx = cv.getContext('2d'), stat = cons.body.querySelector('.cons-stat'), btns = cons.body.querySelector('.cons-btns');
    const rad = (m) => Math.max(4.5, Math.min(8.5, 4.5 + (4.6 - m) * 2.2));
    let toks = [], drag = null, done = false, ok = [], peek = 0, t = 0, started = false;
    function scatter() {
      const order = C.stars.map((_, i) => i).sort(() => Math.random() - 0.5);
      toks = order.map((si, k) => ({ si, m: C.stars[si].m, r: rad(C.stars[si].m), x: 26 + (k % 7) * 41, y: RACK + 26 + Math.floor(k / 7) * 38 }));
      done = false; ok = []; renderStat();
    }
    function inSky(q) { return q.y < RACK - 4; }
    function evaluate() {
      if (toks.some((q) => !inSky(q))) return null;
      const res = assessShape(toks.map((q) => ({ x: q.x, y: q.y, m: q.m })), C.stars.map((s) => ({ x: s.x, y: s.y, m: s.m })));
      return res;
    }
    const TOL = 0.30;
    function renderStat() {
      const placed = toks.filter(inSky).length;
      if (done) { stat.textContent = 'Созвездие ' + C.name + ' собрано!'; stat.className = 'cons-stat good'; return; }
      if (placed < N) { stat.textContent = 'Звёзд в небе: ' + placed + ' из ' + N; stat.className = 'cons-stat'; return; }
      const r = evaluate(); const k = r.d.filter((x) => x < TOL).length;
      stat.textContent = 'Верно стоят: ' + k + ' из ' + N; stat.className = 'cons-stat';
    }
    function check() {
      const r = evaluate(); if (!r) { ok = []; renderStat(); return; }
      ok = r.d.map((x) => x < TOL);
      const k = ok.filter(Boolean).length, mean = r.d.reduce((s, x) => s + x, 0) / N;
      renderStat();
      if (k === N && mean < 0.2 && !done) win(r);
    }
    function win() {
      done = true; drag = null; renderStat(); Sound.success(); FX.rain(g.fx.colors.concat(['#ffe28a', '#ffffff']), 130);
      setTimeout(() => { if (opts && opts.onComplete) opts.onComplete(); }, 2200);
    }
    const xy = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault(); Sound.init(); if (done) return;
      const p = xy(e); let best = -1, bd = 24;
      toks.forEach((q, i) => { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d <= bd) { bd = d; best = i; } });
      if (best >= 0) { drag = { i: best, dx: toks[best].x - p.x, dy: toks[best].y - p.y }; const q = toks.splice(best, 1)[0]; toks.push(q); drag.i = toks.length - 1; Sound.tick(); try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!drag) return; const p = xy(e), q = toks[drag.i];
      q.x = Math.max(q.r, Math.min(W - q.r, p.x + drag.dx)); q.y = Math.max(q.r, Math.min(H - q.r, p.y + drag.dy));
    });
    const up = () => { if (!drag) return; drag = null; Sound.pop(); check(); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('lostpointercapture', up);
    const mk = (txt, fn) => { const b = ui.el('button', 'px-btn small ghost', ui.esc(txt)); b.type = 'button'; b.addEventListener('click', () => { Sound.init(); fn(); }); btns.appendChild(b); };
    mk('Звёзды заново', () => { if (!done) scatter(); });
    mk('Подсказка (организатору)', () => {
      const pin = prompt('Пин организатора — показать узор на 8 секунд'); if (pin == null) return;
      if (pin !== String(ui.CFG.ADMIN_PIN)) { alert('Неверный пин'); return; }
      peek = 8;
    });

    function drawStar(x, y, r, col, glow) {
      x = Math.round(x); y = Math.round(y); r = Math.round(r);
      if (glow) { ctx.fillStyle = 'rgba(255,226,138,.18)'; ctx.fillRect(x - r - 4, y - r - 4, 2 * r + 9, 2 * r + 9); }
      ctx.fillStyle = col; ctx.fillRect(x - 1, y - r, 3, 2 * r + 1); ctx.fillRect(x - r, y - 1, 2 * r + 1, 3); ctx.fillRect(x - r + 2, y - r + 2, 2 * r - 3, 2 * r - 3);
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 1, 3, 3);
    }
    function line(a, b, col) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(Math.round(a.x), Math.round(a.y)); ctx.lineTo(Math.round(b.x), Math.round(b.y)); ctx.stroke(); }
    let last = performance.now();
    function frame(now) {
      if (!wrap.isConnected && now - last > 2500 && started) return;
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; if (peek > 0) peek -= dt;
      if (cons.box.hidden) return; started = true;
      for (let y = 0; y < H; y += 2) { const k = Math.min(1, y / RACK); ctx.fillStyle = y < RACK ? 'rgb(' + Math.round(10 + k * 8) + ',' + Math.round(14 + k * 12) + ',' + Math.round(48 + k * 30) + ')' : '#07081f'; ctx.fillRect(0, y, W, 2); }
      ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(0, RACK, W, 2);
      ctx.fillStyle = '#5a5f9a'; ctx.font = '7px "Press Start 2P", monospace'; ctx.fillText('НЕБО', 8, 12); ctx.fillText('ЗВЁЗДЫ', 8, RACK + 12);
      for (let i = 0; i < 40; i++) { const sx = (i * 73) % W, sy = (i * 41) % (RACK - 6); ctx.fillStyle = Math.sin(t * 1.6 + i) > 0.3 ? 'rgba(200,210,255,.55)' : 'rgba(200,210,255,.18)'; ctx.fillRect(sx, sy, 1, 1); }
      if (peek > 0) {                                  // подсказка организатору: узор относительно текущих звёзд
        ctx.globalAlpha = 0.45;
        C.lines.forEach(([a, b]) => line({ x: CX + C.stars[a].x * SCALE * 0.84, y: CY + C.stars[a].y * SCALE }, { x: CX + C.stars[b].x * SCALE * 0.84, y: CY + C.stars[b].y * SCALE }, '#7de0db'));
        C.stars.forEach((s) => drawStar(CX + s.x * SCALE * 0.84, CY + s.y * SCALE, rad(s.m) * 0.7, '#7de0db'));
        ctx.globalAlpha = 1;
      }
      const res = !done ? evaluate() : null;
      if (done) C.lines.forEach(([a, b]) => { const A = toks.find((q) => q.si === a), B = toks.find((q) => q.si === b); if (A && B) line(A, B, '#ffe28a'); });
      else if (res) {
        C.lines.forEach(([a, b]) => {                  // золотом загораются линии между верно стоящими звёздами
          const ia = res.asg.indexOf(a), ib = res.asg.indexOf(b);
          if (ia >= 0 && ib >= 0 && res.d[ia] < TOL && res.d[ib] < TOL) line(toks[ia], toks[ib], 'rgba(255,226,138,.75)');
        });
      }
      toks.forEach((q, i) => {
        const good = done || (res && res.d[i] < TOL);
        drawStar(q.x, q.y, q.r, good ? '#ffe28a' : (drag && drag.i === i ? '#ffffff' : '#c8d2ff'), good || (drag && drag.i === i));
      });
      if (done) { ctx.fillStyle = '#ffe28a'; ctx.font = '12px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillText(C.greek || '', W / 2, H - 14); ctx.textAlign = 'left'; }
    }
    function openCons(animate) {
      cons.box.hidden = false; if (animate) { cons.box.classList.add('screen-in'); setTimeout(() => cons.box.scrollIntoView({ block: 'start', behavior: 'smooth' }), 150); }
      if (!toks.length) scatter(); last = performance.now(); requestAnimationFrame(frame);
    }
    wrap._dbg = { tokens: () => toks, stars: C.stars, W: W, H: H };   // для проверки организатором
    wrap.append(th.box, cons.box);
    if (S.key && S.coin) { setTimeout(() => openCons(false), 0); }
    return wrap;
  }
  window.Tools_assess = assessShape;      // для проверки организатором
  window.Tools = { speech, hermes: jars, hera: clepsydra, nike: minefield, prometheus, demeter: tasting, atlas };
})();
