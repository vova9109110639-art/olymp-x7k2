/* Дары Олимпа — «испытания у врат»: у каждого бога своя маленькая игра, которую нужно пройти,
   прежде чем он заговорит. Здесь: каркас, капча Сфинкса и игры на DOM (скитала, Аргус, Пандора,
   лира, забег). Игры на canvas — в trials2.js. Данные (какой бог — какая игра) лежат в gods.js → trial. */
(function () {
  'use strict';
  const REG = {};
  const U = () => window.QuestUI;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const spr = (key, color, cls) => Sprites.clone(key, color, cls);

  /* ───────────── каркас ───────────── */
  function create(g, onWin) {
    const ui = U(), def = REG[g.trial];
    const box = ui.el('section', 'trial');
    box.innerHTML =
      '<div class="greek">' + def.greek + '</div>' +
      '<h2 class="trial-title">' + ui.esc(def.title) + '</h2>' +
      '<p class="trial-lead">' + ui.esc(ui.sub(def.lead)) + '</p>' +
      '<div class="trial-stage"></div>' +
      '<p class="trial-status" role="status"></p>' +
      '<div class="trial-foot"></div>';
    const stage = box.querySelector('.trial-stage'), st = box.querySelector('.trial-status'), foot = box.querySelector('.trial-foot');
    const stops = [];
    let won = false;
    const api = {
      g, ui, stage, color: g.color,
      status(msg, cls) { st.textContent = msg || ''; st.className = 'trial-status' + (cls ? ' ' + cls : ''); },
      /* цикл анимации: fn(dt) — сам останавливается, когда игра выиграна или экран ушёл */
      raf(fn) {
        let id = 0, alive = true, last = performance.now();
        const born = last;
        const tick = (t) => {
          if (!alive) return;
          if (!stage.isConnected && t - born > 1500) { alive = false; return; }   // экран ушёл
          const dt = Math.min(0.05, (t - last) / 1000); last = t;
          try { fn(dt); } catch (e) { console.error(e); }
          id = requestAnimationFrame(tick);
        };
        id = requestAnimationFrame(tick);
        const stop = () => { alive = false; cancelAnimationFrame(id); };
        stops.push(stop); return stop;
      },
      canvas(w, h, cls) {
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.className = 'trial-cv' + (cls ? ' ' + cls : '');
        cv.style.aspectRatio = w + ' / ' + h;
        return cv;
      },
      /* координаты указателя в «пикселях» canvas */
      pos(cv, ev) {
        const r = cv.getBoundingClientRect();
        return { x: (ev.clientX - r.left) * cv.width / r.width, y: (ev.clientY - r.top) * cv.height / r.height };
      },
      win(msg) {
        if (won) return; won = true;
        stops.forEach((f) => f());
        api.status(msg || 'Испытание пройдено!', 'good');
        box.classList.add('won');
        Sound.success();
        FX.rain(g.fx.colors.concat(['#ffe28a', '#ffffff']), 110);
        setTimeout(() => onWin && onWin(), 1300);
      },
      get won() { return won; }
    };
    ui.addCleanup(() => stops.forEach((f) => f()));
    def.make(api);

    /* запасной выход, чтобы квест не застрял из-за капризов экрана или микрофона */
    if (ui.SETUP) {
      const b = ui.el('button', 'px-btn small ghost', 'Пропустить (режим настройки)'); b.type = 'button';
      b.addEventListener('click', () => { Sound.init(); api.win('Пропущено'); });
      foot.appendChild(b);
    } else {
      const t = setTimeout(() => {
        if (won) return;
        const a = ui.el('button', 'trial-help', 'Не получается? Позвать Гермеса'); a.type = 'button';
        a.addEventListener('click', () => {
          foot.replaceChildren();
          const f = ui.el('form', 'seal-form', '<input class="seal-input" type="password" inputmode="numeric" placeholder="Пин" aria-label="Пин Гермеса"><button class="px-btn small" type="submit">Открыть</button>');
          f.addEventListener('submit', (e) => {
            e.preventDefault();
            if (f.querySelector('input').value === String(ui.CFG.ADMIN_PIN)) api.win('Гермес открыл врата'); else { ui.shake(f); Sound.fail(); }
          });
          foot.appendChild(f); f.querySelector('input').focus();
        });
        foot.appendChild(a);
      }, 75000);
      ui.addCleanup(() => clearTimeout(t));
    }
    return box;
  }

  /* ───────────── ГЕРМЕС · Скитала ───────────── */
  REG.scytale = {
    greek: 'ΣΚΥΤΑΛΗ', title: 'Скитала Гермеса',
    lead: 'Гермес запечатал первое слово по-спартански: буквы перемешаны. Подбери ширину жезла — и слова встанут на место.',
    make(api) {
      const ui = api.ui, cfg = ui.CFG;
      const R = clamp(+cfg.HERMES_CIPHER_ROWS || 4, 3, 6);
      let text = String(cfg.HERMES_CIPHER || 'Ищи стол, обведённый лентой. Не всё, что скользит, — выход.').toUpperCase().replace(/\s+/g, ' ').trim();
      while (text.length % R) text += ' ';
      const L = text.length / R, strip = [];
      for (let c = 0; c < L; c++) for (let r = 0; r < R; r++) strip.push(text[r * L + c]);
      api.stage.innerHTML =
        '<div class="scy-label">Лента, снятая с жезла</div><div class="scy-strip"></div>' +
        '<div class="scy-label">Лента на жезле</div><div class="scy-rod"><div class="scy-grid"></div></div>' +
        '<div class="scy-ctl"><button class="px-btn small" type="button" data-d="-1" aria-label="Уже">−</button><div class="scy-val">Ширина жезла: <b></b></div><button class="px-btn small" type="button" data-d="1" aria-label="Шире">+</button></div>';
      const sEl = api.stage.querySelector('.scy-strip'), grid = api.stage.querySelector('.scy-grid'), val = api.stage.querySelector('.scy-val b');
      sEl.textContent = strip.map((c) => (c === ' ' ? '·' : c)).join('');
      let r = 2, solved = false;
      function render() {
        val.textContent = r;
        const cols = Math.ceil(strip.length / r);
        grid.style.gridTemplateRows = 'repeat(' + r + ', auto)';
        grid.style.gridAutoColumns = '1fr';
        grid.replaceChildren.apply(grid, strip.map((ch) => { const s = document.createElement('span'); s.className = 'scy-tile' + (ch === ' ' ? ' sp' : ''); s.textContent = ch === ' ' ? '' : ch; return s; }));
        const w = grid.clientWidth || api.stage.clientWidth || 320;
        grid.style.fontSize = clamp(w / cols * 0.62, 8, 22) + 'px';
      }
      function set(n) {
        if (solved) return;
        n = clamp(n, 2, 8); if (n === r) return;
        r = n; Sound.click(); render();
        if (r === R) {
          solved = true; grid.classList.add('ok'); Sound.unlock();
          api.status('Слова встали на место!', 'good');
          setTimeout(() => api.win('Послание прочитано'), 1500);
        }
      }
      api.stage.querySelectorAll('.scy-ctl button').forEach((b) => b.addEventListener('click', () => { Sound.init(); set(r + (+b.dataset.d)); }));
      const onKey = (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowUp') set(r + 1); else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') set(r - 1); };
      document.addEventListener('keydown', onKey); ui.addCleanup(() => document.removeEventListener('keydown', onKey));
      render(); requestAnimationFrame(render);
      setTimeout(() => { if (!solved) api.status('Подсказка: нужна ширина, при которой строки читаются как обычный текст.'); }, 35000);
    }
  };

  /* ───────────── ГЕРА · Сто глаз Аргуса ───────────── */
  function eyeCanvas(open) {
    const cv = document.createElement('canvas'); cv.width = 13; cv.height = 7; cv.className = 'argus-eye' + (open ? '' : ' shut');
    const x = cv.getContext('2d');
    if (open) {
      x.fillStyle = '#10264d'; x.fillRect(3, 0, 7, 7); x.fillRect(1, 1, 11, 5); x.fillRect(0, 2, 13, 3);
      x.fillStyle = '#fff7e0'; x.fillRect(2, 2, 9, 3); x.fillRect(3, 1, 7, 5);
      x.fillStyle = '#1aa7a0'; x.fillRect(4, 1, 5, 5); x.fillStyle = '#10264d'; x.fillRect(5, 2, 3, 3); x.fillStyle = '#fff'; x.fillRect(5, 2, 1, 1);
    } else {
      x.fillStyle = '#10264d'; x.fillRect(0, 3, 13, 1); x.fillRect(1, 4, 11, 1); x.fillRect(3, 5, 7, 1);
      x.fillStyle = '#5b6aa0'; x.fillRect(2, 2, 1, 1); x.fillRect(5, 2, 1, 1); x.fillRect(8, 2, 1, 1); x.fillRect(11, 2, 1, 1);
    }
    return cv;
  }
  REG.argus = {
    greek: 'ΑΡΓΟΣ', title: 'Сто глаз Аргуса',
    lead: 'Гера поставила на страже стоглазого Аргуса. Он не спит — пока ты не найдёшь все пары. Каждая пара усыпляет один его глаз.',
    make(api) {
      const ui = api.ui, PAIRS = 6;
      const ids = shuffle(ui.GODS.map((g) => g.id)).slice(0, PAIRS);
      const deck = shuffle(ids.concat(ids));
      api.stage.innerHTML = '<div class="argus-eyes"></div><div class="argus-grid"></div>';
      const eyes = api.stage.querySelector('.argus-eyes'), grid = api.stage.querySelector('.argus-grid');
      const eyeEls = ids.map(() => { const e = eyeCanvas(true); eyes.appendChild(e); return e; });
      let open = [], lock = false, found = 0, moves = 0;
      deck.forEach((id) => {
        const g = ui.byId(id);
        const b = ui.el('button', 'argus-card', '<span class="back"></span><span class="front"></span>'); b.type = 'button'; b.dataset.id = id;
        b.querySelector('.front').appendChild(spr(g.sprite, g.color));
        b.setAttribute('aria-label', 'Карта');
        b.addEventListener('click', () => {
          Sound.init();
          if (lock || b.classList.contains('up') || b.classList.contains('ok')) return;
          b.classList.add('up'); Sound.note(g.note + 3, 0.5); open.push(b);
          if (open.length < 2) return;
          moves++; lock = true;
          const [a, c] = open; open = [];
          if (a.dataset.id === c.dataset.id) {
            setTimeout(() => {
              a.classList.add('ok'); c.classList.add('ok'); Sound.pop();
              const eye = eyeEls[found]; eye.replaceWith(eyeCanvas(false)); found++;
              api.status(found < PAIRS ? 'Ещё один глаз закрылся… осталось ' + (PAIRS - found) : 'Аргус уснул!', found < PAIRS ? '' : 'good');
              lock = false;
              if (found === PAIRS) setTimeout(() => api.win('Аргус уснул!'), 700);
            }, 350);
          } else {
            setTimeout(() => { ui.shake(a); ui.shake(c); }, 250);
            setTimeout(() => { a.classList.remove('up'); c.classList.remove('up'); lock = false; }, 900);
            Sound.locked();
          }
        });
        grid.appendChild(b);
      });
      api.status('Открывай по две карты.');
    }
  };

  /* ───────────── ПАНДОРА · «Не открывай» ───────────── */
  REG.pandora = {
    greek: 'ΠΙΘΟΣ', title: 'Не открывай!',
    lead: 'Пандоре велели не открывать ящик. Ты знаешь, чем это кончилось. Так что — не открывай. Совсем. Ни за что. Вот кнопка «Не открывать» — не нажимай.',
    make(api) {
      const ui = api.ui;
      api.stage.innerHTML =
        '<div class="pan-field"><div class="pan-sign">НЕ ОТКРЫВАТЬ</div><div class="pan-chest"></div><div class="pan-hope" hidden><span class="greek">ΕΛΠΙΣ</span><b>Надежда</b></div></div>' +
        '<button class="px-btn gold" type="button" id="pan-btn">Не открывать</button>';
      const field = api.stage.querySelector('.pan-field'), chest = api.stage.querySelector('.pan-chest'), btn = api.stage.querySelector('#pan-btn'), hope = api.stage.querySelector('.pan-hope');
      chest.appendChild(spr('chest', '#8a5a34', 'pan-chest-sprite'));
      const NAMES = ['Хандра', 'Лень', 'Зависть', 'Тревога', 'Нытьё', 'Понедельник', 'Занудство'];
      const COLORS = ['#8fb7ff', '#b79cff', '#8fd8a0', '#ffb08f', '#ff9ac8', '#9ad3e8', '#d2c37a'];
      let spirits = [], left = NAMES.length, started = false;
      btn.addEventListener('click', async () => {
        Sound.init(); if (started) return; started = true;
        btn.disabled = true; btn.textContent = 'Ну я же просила…';
        api.status('Ты же знаешь, чем это кончилось…');
        chest.classList.add('shaking'); Sound.rumble(1.4);
        await ui.sleep(1300);
        chest.classList.remove('shaking'); chest.classList.add('open');
        Sound.thunder(0.6);
        const fr = field.getBoundingClientRect(), cr = chest.getBoundingClientRect();
        FX.burst(cr.left + cr.width / 2, cr.top + 6, ['#c9a6ff', '#8b5fbf', '#f0e1ff'], 40, 1.2);
        const cx = field.clientWidth / 2, cy = field.clientHeight - 80;
        NAMES.forEach((n, i) => {
          const el = ui.el('button', 'spirit', '<i>' + ui.esc(n) + '</i>'); el.type = 'button';
          el.insertBefore(spr('wisp', COLORS[i]), el.firstChild);
          field.appendChild(el);
          const a = -Math.PI / 2 + (i - 3) * 0.32;
          const s = { el, x: cx, y: cy, vx: Math.cos(a) * 120, vy: Math.sin(a) * 150, t: rnd(0, 6), gone: false };
          spirits.push(s);
          el.addEventListener('pointerdown', (e) => {
            e.preventDefault(); Sound.init();
            if (s.gone) return; s.gone = true; left--; Sound.pop();
            const r = el.getBoundingClientRect();
            FX.burst(r.left + r.width / 2, r.top + r.height / 2, [COLORS[i], '#ffffff'], 14, 0.8);
            el.classList.add('caught'); setTimeout(() => el.remove(), 300);
            api.status(left ? 'Верни их всех в ящик! Осталось: ' + left : '');
            if (!left) finale();
          });
        });
        api.status('Они вылетели! Лови и возвращай в ящик. Осталось: ' + left);
        api.raf((dt) => {
          const W = field.clientWidth, H = field.clientHeight - 6;
          const spd = 88 + (NAMES.length - left) * 10;
          spirits.forEach((s) => {
            if (s.gone) return;
            s.t -= dt;
            if (s.t <= 0 || s.tx == null) { s.t = rnd(1.6, 3.4); s.tx = rnd(40, W - 40); s.ty = rnd(40, H - 70); }
            const dx = s.tx - s.x, dy = s.ty - s.y, dl = Math.hypot(dx, dy) || 1;
            s.vx += (dx / dl * spd - s.vx) * Math.min(1, dt * 1.6); s.vy += (dy / dl * spd - s.vy) * Math.min(1, dt * 1.6);
            s.x += s.vx * dt; s.y += s.vy * dt;
            if (s.x < 30) { s.x = 30; s.vx = Math.abs(s.vx); } if (s.x > W - 30) { s.x = W - 30; s.vx = -Math.abs(s.vx); }
            if (s.y < 30) { s.y = 30; s.vy = Math.abs(s.vy); } if (s.y > H - 20) { s.y = H - 20; s.vy = -Math.abs(s.vy); }
            s.el.style.transform = 'translate(' + (s.x - 30).toFixed(1) + 'px,' + (s.y - 30).toFixed(1) + 'px)';
          });
        });
      });
      async function finale() {
        Sound.unlock(); chest.classList.add('closing');
        await ui.sleep(700);
        hope.hidden = false; hope.classList.add('rise');
        FX.rain(['#ffe28a', '#ffffff', '#c9a6ff'], 90);
        api.status('Все беды в ящике. Но на дне осталась Надежда.', 'good');
        setTimeout(() => api.win('Надежда осталась с тобой'), 2200);
      }
    }
  };

  /* ───────────── АПОЛЛОН · Эхо лиры ───────────── */
  REG.lyre = {
    greek: 'ΛΥΡΑ', title: 'Эхо лиры',
    lead: 'Аполлон играет — ты повторяешь. Каждая струна звучит по-своему. Слушай внимательно: с каждым кругом мелодия длиннее.',
    make(api) {
      const ui = api.ui, NOTES = [4, 7, 9, 11, 13], COLS = ['#ffe28a', '#ffc94d', '#ffab3d', '#ff8a3d', '#ffd9a0'];
      const ROUNDS = [3, 4, 5, 6];
      api.stage.innerHTML = '<div class="lyre-info"></div><div class="lyre-strings"></div><button class="px-btn small ghost" type="button" id="lyre-again">Послушать ещё раз</button>';
      const info = api.stage.querySelector('.lyre-info'), wrap = api.stage.querySelector('.lyre-strings');
      const strs = NOTES.map((n, i) => {
        const b = ui.el('button', 'lyre-str', '<i></i>'); b.type = 'button'; b.style.setProperty('--c', COLS[i]); b.setAttribute('aria-label', 'Струна ' + (i + 1));
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); Sound.init(); press(i); });
        wrap.appendChild(b); return b;
      });
      let round = 0, seq = [], pos = 0, busy = true, dead = false;
      ui.addCleanup(() => { dead = true; });
      function ping(i, ms) { strs[i].classList.add('on'); Sound.note(NOTES[i], 0.85); setTimeout(() => strs[i].classList.remove('on'), ms || 320); }
      function makeSeq(n) {
        const s = [];
        while (s.length < n) { const v = (Math.random() * NOTES.length) | 0; if (s.length >= 2 && s[s.length - 1] === v && s[s.length - 2] === v) continue; s.push(v); }
        return s;
      }
      async function play() {
        busy = true; pos = 0;
        info.textContent = 'Круг ' + (round + 1) + ' из ' + ROUNDS.length + ' · слушай…';
        await ui.sleep(500);
        for (const i of seq) { if (dead) return; ping(i); await ui.sleep(560); }
        busy = false; info.textContent = 'Круг ' + (round + 1) + ' из ' + ROUNDS.length + ' · теперь ты';
      }
      async function press(i) {
        if (busy || api.won) return;
        ping(i, 200);
        if (i !== seq[pos]) {
          busy = true; Sound.fail(); ui.shake(wrap); api.status('Не та струна. Слушай ещё раз.', 'bad');
          await ui.sleep(900); api.status(''); return play();
        }
        pos++;
        if (pos < seq.length) return;
        busy = true; round++;
        await ui.sleep(450);
        if (round >= ROUNDS.length) { info.textContent = 'Мелодия сыграна!'; api.win('Лира звучит в твоих руках'); return; }
        Sound.unlock(); api.status('Верно!', 'good'); await ui.sleep(700); api.status('');
        seq = makeSeq(ROUNDS[round]); play();
      }
      const onKey = (e) => { const n = +e.key; if (n >= 1 && n <= 5) press(n - 1); };
      document.addEventListener('keydown', onKey); ui.addCleanup(() => document.removeEventListener('keydown', onKey));
      api.stage.querySelector('#lyre-again').addEventListener('click', () => { Sound.init(); if (!busy) play(); });
      seq = makeSeq(ROUNDS[0]);
      setTimeout(() => { Sound.init(); play(); }, 600);
    }
  };

  /* ───────────── НИКА · Забег за победой ───────────── */
  REG.dash = {
    greek: 'ΔΡΟΜΟΣ', title: 'Забег за победой',
    lead: 'Ника не ждёт. Нажми числа по порядку, от 1 до 12, пока не вышло время. Промах отнимает секунду.',
    make(api) {
      const ui = api.ui, N = 12, TIME = 22;
      api.stage.innerHTML = '<div class="dash-bar"><b></b></div><div class="dash-grid"></div><button class="px-btn gold" type="button" id="dash-go">Старт!</button>';
      const bar = api.stage.querySelector('.dash-bar b'), grid = api.stage.querySelector('.dash-grid'), go = api.stage.querySelector('#dash-go');
      let next = 1, left = 0, running = false;
      function deal() {
        grid.replaceChildren(); next = 1; left = TIME; bar.style.width = '100%';
        shuffle(Array.from({ length: N }, (_, i) => i + 1)).forEach((n) => {
          const b = ui.el('button', 'dash-plate', '<span>' + n + '</span>'); b.type = 'button'; b.disabled = true; b.dataset.n = n;
          b.addEventListener('pointerdown', (e) => {
            e.preventDefault(); Sound.init();
            if (!running || b.classList.contains('ok')) return;
            if (n === next) {
              b.classList.add('ok'); Sound.blip(330 + next * 55, 0.1, 0.25); next++;
              if (next > N) { running = false; api.win('Победа! Времени ещё ' + left.toFixed(1) + ' с'); }
            } else { left = Math.max(0, left - 1); ui.shake(b); b.classList.add('bad'); setTimeout(() => b.classList.remove('bad'), 300); Sound.locked(); }
          });
          grid.appendChild(b);
        });
      }
      deal();
      go.addEventListener('click', () => {
        Sound.init(); Sound.click(); go.hidden = true; running = true; api.status('Беги!');
        grid.querySelectorAll('.dash-plate').forEach((b) => { b.disabled = false; });
      });
      api.raf((dt) => {
        if (!running) return;
        left -= dt; bar.style.width = clamp(left / TIME * 100, 0, 100) + '%';
        bar.parentNode.classList.toggle('low', left < 6);
        if (left <= 0) {
          running = false; Sound.fail(); api.status('Время вышло! Победа не ждёт — ещё раз.', 'bad');
          setTimeout(() => { deal(); go.hidden = false; go.textContent = 'Ещё раз!'; }, 900);
        }
      });
      api.status('Нажми «Старт», когда будешь готова.');
    }
  };

  /* ───────────── КАПЧА СФИНКСА (вход в храм) ───────────── */
  function runSphinx() {
    const ui = U();
    return new Promise((resolve) => {
      const ov = ui.el('div', 'captcha');
      ov.innerHTML = '<div class="cap-box pxbox"><div class="cap-head"><span class="cap-sphinx"></span><div><div class="greek">ΣΦΙΓΞ</div><b>Страж Олимпа</b></div></div><div class="cap-body"></div><div class="cap-foot">Защищено древней капчей ΚΑΠΤΧΑ</div></div>';
      document.getElementById('overlay-root').appendChild(ov);
      ov.querySelector('.cap-sphinx').appendChild(spr('sphinx', '#d8b98a'));
      requestAnimationFrame(() => ov.classList.add('on'));
      const body = ov.querySelector('.cap-body');
      const say = (t) => { const p = body.querySelector('.cap-say'); if (p) p.textContent = t; };
      const close = () => { ov.classList.remove('on'); setTimeout(() => ov.remove(), 400); resolve(); };
      if (ui.SETUP) {
        const s = ui.el('button', 'cap-skip', 'пропустить (режим настройки)'); s.type = 'button';
        s.addEventListener('click', () => { Sound.init(); close(); });
        ov.querySelector('.cap-foot').appendChild(s);
      }

      /* шаг 1: «Я не титан» — галочка убегает */
      function step1() {
        body.innerHTML = '<p class="cap-say">Стой. Сперва докажи, что ты не титан.</p><div class="cap-row"><div class="cap-zone"><button class="cap-check" type="button" aria-label="Я не титан"><i></i></button></div><span class="cap-lbl">Я не титан</span></div>';
        const btn = body.querySelector('.cap-check'), zone = body.querySelector('.cap-zone');
        let dodges = 0, busy = false;
        const dodge = () => {
          dodges++; Sound.whoosh();
          const w = body.clientWidth - 60;
          btn.style.transform = 'translate(' + rnd(-20, Math.min(220, w - 120)).toFixed(0) + 'px,' + rnd(-26, 26).toFixed(0) + 'px)';
          say(['Ой, куда ты?', 'Слишком быстро для титана…', 'Подозрительно скользкая галочка.'][Math.min(dodges - 1, 2)]);
        };
        btn.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && dodges < 2) dodge(); });
        btn.addEventListener('click', async () => {
          Sound.init();
          if (busy) return;
          if (dodges < 2) { dodge(); return; }
          busy = true; btn.classList.add('spin'); say('Сверяю с реестром титанов…');
          await ui.sleep(1300);
          btn.classList.remove('spin'); btn.classList.add('ok'); Sound.unlock(); say('Не титан. Но может, робот? Ещё одна проверка.');
          await ui.sleep(1100); step2();
        });
        zone.addEventListener('pointerdown', () => Sound.init());
      }

      /* шаг 2: сетка 3×3 */
      function step2() {
        const OLD = [['amphora', '#c9693a'], ['helmet', '#9aa3b2'], ['column', '#efe7d6'], ['apollo', '#f2c14e'], ['prometheus', '#c1443b'], ['nike', '#3fa3a0']];
        const NEW = [['phone', '#6fb4ff'], ['cup', '#efe3c4'], ['car', '#e0453a']];
        const final = shuffle(OLD.map((o) => ({ s: o, bad: false })).concat(NEW.map((o) => ({ s: o, bad: true }))));
        body.innerHTML = '<p class="cap-say"></p><div class="cap-ask">Выбери <b>все</b> клетки, где есть то, чего не было в Древней Греции</div><div class="cap-grid"></div><button class="px-btn gold" type="button">Подтвердить</button>';
        say('Хм. Теперь серьёзно.');
        const grid = body.querySelector('.cap-grid'), ok = body.querySelector('.px-btn');
        final.forEach((c) => {
          const b = ui.el('button', 'cap-cell'); b.type = 'button'; b.appendChild(spr(c.s[0], c.s[1]));
          b.addEventListener('click', () => { Sound.init(); Sound.tick(); b.classList.toggle('sel'); });
          c.el = b; grid.appendChild(b);
        });
        ok.addEventListener('click', () => {
          Sound.init();
          if (final.every((c) => c.el.classList.contains('sel') === c.bad)) { Sound.unlock(); say('Какие современные вещи… Но ты права.'); setTimeout(step3, 1000); return; }
          Sound.fail(); ui.shake(grid); say('Ты точно не робот? Попробуй ещё раз.');
          final.forEach((c) => c.el.classList.remove('sel'));
        });
      }

      /* шаг 3: загадка */
      function step3() {
        const A = ['Человек', 'Табурет', 'Кентавр', ui.name + ' до первой чашки кофе'];
        const opts = shuffle(A);
        body.innerHTML = '<p class="cap-say"></p><blockquote class="cap-riddle">Кто утром ходит на четырёх ногах, днём — на двух, а вечером — на трёх?</blockquote><div class="cap-opts"></div>';
        say('Последнее. Мою загадку знает любой фиванец.');
        const wrap = body.querySelector('.cap-opts');
        opts.forEach((t) => {
          const b = ui.el('button', 'cap-opt', ui.esc(t)); b.type = 'button';
          b.addEventListener('click', async () => {
            Sound.init();
            if (t === A[0]) {
              wrap.querySelectorAll('button').forEach((x) => { x.disabled = true; });
              b.classList.add('right'); Sound.success(); FX.rain(['#ffe28a', '#ffffff', '#d8b98a'], 100);
              say('Верно. Человек. Проходи, ' + ui.name + ' — Олимп ждёт.');
              await ui.sleep(2200); close();
            } else {
              b.disabled = true; b.classList.add('wrong'); Sound.fail(); ui.shake(wrap);
              say(t === A[3] ? 'Смешно. Но нет.' : ['Нет. Думай.', 'Мимо. Подумай о себе.', 'Почти… нет.'][(Math.random() * 3) | 0]);
            }
          });
          wrap.appendChild(b);
        });
      }
      step1();
    });
  }

  window.Trials = {
    has: (n) => !!REG[n],
    create,
    runSphinx,
    register(name, def) { REG[name] = def; },
    shuffle, clamp, rnd,
    get names() { return Object.keys(REG); }
  };
})();
