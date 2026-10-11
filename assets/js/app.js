/* Дары Олимпа — логика сайта: хаб, страницы богов, печати-коды, тайная дверь, админ-панель. */
(function () {
  'use strict';
  const CFG = window.QUEST_CONFIG, GODS = window.GODS;
  const view = document.getElementById('view');
  const body = document.body;
  const root = document.documentElement;
  const NAME = CFG.HERO_NAME || 'друг';
  const NAME_GEN = CFG.HERO_NAME_GEN || NAME;
  const mix = Sprites.mix;

  const byId = (id) => GODS.find((g) => g.id === +id);
  const $ = (s, r) => (r || document).querySelector(s);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const sub = (s) => String(s).replace(/\{name\}/g, NAME);
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function shake(node) { node.classList.remove('shake'); void node.offsetWidth; node.classList.add('shake'); }
  const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^0-9a-zа-яё]/gi, '');

  /* ───────────── хранилище (с запасным вариантом без localStorage) ───────────── */
  const mem = {};
  const store = {
    get(k, d) { try { const v = localStorage.getItem('quest.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return k in mem ? mem[k] : d; } },
    set(k, v) { mem[k] = v; try { localStorage.setItem('quest.' + k, JSON.stringify(v)); } catch (e) { /* ok */ } },
    wipe() { Object.keys(mem).forEach((k) => delete mem[k]); try { Object.keys(localStorage).filter((k) => k.indexOf('quest.') === 0 && k !== 'quest.sound').forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ok */ } }
  };
  if (/[?&]reset\b/.test(location.search)) { store.wipe(); history.replaceState(null, '', location.pathname + location.hash); }

  /* ───────────── порядок и прогресс ───────────── */
  function validOrder(o) {
    return Array.isArray(o) && o.length === GODS.length && new Set(o.map(Number)).size === o.length && o.every((n) => byId(n));
  }
  const ORDER = validOrder(CFG.ORDER) ? CFG.ORDER.map(Number) : null;
  const SETUP = !ORDER;

  const state = { done: store.get('done', []), gateOpen: !!store.get('gateOpen', false), entered: false, adminOK: false };
  function syncDone() {
    if (!ORDER) { state.done = []; return; }
    let n = 0;
    while (n < ORDER.length && state.done.map(Number).includes(ORDER[n])) n++;
    state.done = ORDER.slice(0, n);
  }
  syncDone();

  function status(id) {
    if (SETUP) return 'active';
    if (state.done.includes(+id)) return 'done';
    return ORDER[state.done.length] === +id ? 'active' : 'locked';
  }
  const allDone = () => !SETUP && state.done.length >= ORDER.length;
  const nextId = () => (SETUP || allDone() ? null : ORDER[state.done.length]);

  function toCode(c) {
    if (c == null || c === '') return null;
    const a = Array.isArray(c) ? c.map(Number) : String(c).replace(/\D/g, '').split('').map(Number);
    return a.length && a.every((n) => byId(n)) ? a : null;
  }
  const FINAL = toCode(CFG.FINAL_CODE) || (ORDER ? ORDER.slice() : null);

  /* ───────────── мелочи интерфейса ───────────── */
  let toastT = 0;
  function toast(msg, ms) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms || 2800);
  }
  function godVars(g) {
    const c = Sprites.lift(g.color);
    return { '--god': g.color, '--god-hi': mix(c, '#ffffff', 0.4), '--god-lo': mix(g.color, '#000000', 0.45), '--god-lit': c, '--bg1': mix(g.color, '#05061a', 0.6), '--bg2': mix(g.color, '#05061a', 0.88) };
  }
  function applyVars(node, vars) { Object.keys(vars).forEach((k) => node.style.setProperty(k, vars[k])); }
  function spriteFor(g, cls, mode) { return Sprites.clone(g.sprite, g.color, cls, mode); }

  /* пиксельный меандр — рисуем один раз и отдаём в CSS */
  (function () {
    const c = document.createElement('canvas'); c.width = 10; c.height = 12;
    const g = c.getContext('2d'); g.fillStyle = '#f2c14e';
    g.fillRect(0, 0, 10, 1); g.fillRect(0, 11, 10, 1);
    ['#########.', '........#.', '..#####.#.', '..#...#.#.', '..#.#.#.#.', '..#.###.#.', '..#.....#.', '..#######.']
      .forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') g.fillRect(x, y + 2, 1, 1); }));
    root.style.setProperty('--meander', 'url(' + c.toDataURL() + ')');
  })();

  /* фронтон храма на canvas (для рамки видео) */
  function pediment(cv) {
    const w = 72, h = 12; cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    for (let r = 0; r < h; r++) {
      const half = Math.round((w / 2) * (1 - r / h));
      g.fillStyle = r === 0 ? '#fff6dc' : '#efe7d6';
      g.fillRect(w / 2 - half, h - 1 - r, half * 2, 1);
      g.fillStyle = '#b9ad94'; g.fillRect(w / 2 + half - 1, h - 1 - r, 1, 1);
    }
    g.fillStyle = '#d4c9ae'; g.fillRect(0, h - 2, w, 2);
    g.fillStyle = '#f2c14e'; g.fillRect(w / 2 - 1, 2, 2, 2);
  }

  /* ───────────── маршрутизация и переходы ───────────── */
  let busy = false, silent = 0, cleanups = [], pendingFocus = null, justKey = null;
  function addCleanup(fn) { cleanups.push(fn); }
  function runCleanups() { const c = cleanups; cleanups = []; c.forEach((f) => { try { f(); } catch (e) { /* ok */ } }); }

  /* всё, что нужно играм из trials.js / tools.js */
  window.QuestUI = { el, esc, shake, sleep, toast, addCleanup, store, spriteFor, godVars, norm, sub, CFG, GODS, byId, SETUP, name: NAME };

  function setRoute(r) {
    body.dataset.route = r;
    window.scrollTo(0, 0);
  }
  function mount(node) {
    view.replaceChildren(node);
    node.classList.add('screen-in');
  }
  async function go(hash, opts) {
    opts = opts || {};
    if (busy) return;
    busy = true;
    await FX.cover(opts);
    if (location.hash !== hash) { silent++; location.hash = hash; }
    route();
    await FX.uncover(opts.hold);
    busy = false;
  }
  function route() {
    runCleanups();
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    if (parts[0] === 'god' && byId(parts[1])) {
      const g = byId(parts[1]);
      if (status(g.id) === 'locked') { silent++; location.replace('#/'); toast('Этот бог ещё спит. Сначала — другой подвиг.'); return renderHub(); }
      return renderGod(g);
    }
    if (parts[0] === 'gate') return renderGate();
    if (parts[0] === 'admin') return renderAdmin();
    return renderHub();
  }
  window.addEventListener('hashchange', () => { if (silent > 0) { silent--; return; } if (!busy) route(); });

  /* ───────────── ХАБ ───────────── */
  function tileEl(g, i) {
    const st = status(g.id);
    const a = el('a', 'tile ' + st);
    a.href = st === 'locked' ? '#' : '#/god/' + g.id;
    a.style.setProperty('--i', i);
    applyVars(a, godVars(g));
    const face = el('span', 'face');
    const num = el('span', 'num'); num.appendChild(Sprites.digits(g.id, { color: '#fff7e0', shadow: 'rgba(0,0,0,.55)' }));
    const plate = el('span', 'plate'); plate.appendChild(spriteFor(g, '', st === 'locked' ? 'gray' : null));
    const name = el('span', 'name', st === 'locked' ? '· · ·' : (CFG.SHOW_GOD_NAMES === false ? '' : esc(g.name)));
    face.append(num, plate, name);
    if (st === 'done') { const b = el('span', 'badge done'); b.appendChild(Sprites.clone('check', '#ffffff')); face.appendChild(b); }
    if (st === 'locked') { const b = el('span', 'badge lock'); b.appendChild(Sprites.clone('lock', '#ffffff')); face.appendChild(b); }
    a.appendChild(face);
    a.setAttribute('aria-label', 'Подвиг ' + g.id + (st === 'locked' ? ': закрыт' : ': ' + g.name));

    a.addEventListener('mouseenter', () => { if (st !== 'locked') Sound.note(g.note, 0.38); });
    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (busy) return;
      Sound.init();
      if (st === 'locked') { shake(a); Sound.locked(); toast('Этот бог ещё спит. Сначала — другой подвиг.'); return; }
      const r = a.getBoundingClientRect();
      Sound.note(g.note, 0.8); Sound.note(g.note + 2, 0.5);
      FX.burst(r.left + r.width / 2, r.top + r.height / 2, g.fx.colors, 22);
      go('#/god/' + g.id, { color: g.color, sprite: spriteFor(g, 'veil-sprite'), greek: g.greek, label: g.name });
    });
    return a;
  }

  function renderHub() {
    setRoute('hub');
    Scene.resume(); FX.setMode('gold'); Sound.setMood('hub');
    const wrap = el('section', 'hub' + (SETUP ? ' setup' : ''));
    const done = SETUP ? 0 : state.done.length;
    wrap.innerHTML =
      '<header class="hub-head">' +
        '<div class="greek">ΔΩΡΑ ΤΟΥ ΟΛΥΜΠΟΥ</div>' +
        '<h1 class="title">ДАРЫ ОЛИМПА</h1>' +
        '<div class="meander"></div>' +
        '<p class="sub">Девять подвигов ' + esc(NAME_GEN) + '</p>' +
      '</header>' +
      (SETUP ? '<div class="setup-banner pxbox">Режим настройки: порядок не задан (<b>assets/js/config.js → ORDER</b>) — открыты все кнопки.</div>' : '') +
      '<nav class="tiles" aria-label="Девять богов"></nav>' +
      '<div class="hub-foot"></div>';
    const tiles = $('.tiles', wrap);
    GODS.forEach((g, i) => tiles.appendChild(tileEl(g, i)));

    const foot = $('.hub-foot', wrap);
    if (!SETUP) {
      const pr = el('div', 'progress');
      pr.innerHTML = '<span>Подвигов пройдено</span>';
      const pips = el('span', 'pips');
      GODS.forEach((_, i) => pips.appendChild(el('i', i < done ? 'on' : '')));
      pr.appendChild(pips);
      pr.appendChild(el('b', '', done + ' / ' + GODS.length));
      foot.appendChild(pr);
    }
    /* связка ключей: по ключу за каждую станцию с ключом */
    const keyGods = (SETUP ? GODS : ORDER.map(byId)).filter((g) => g.key);
    if (keyGods.length) {
      const kr = el('div', 'keyring');
      const got = keyGods.filter((g) => !SETUP && state.done.includes(g.id));
      kr.innerHTML =
        '<div class="kr-title">Связка ключей</div>' +
        '<div class="kr-wrap"><span class="kr-ring"></span><div class="kr-keys"></div></div>' +
        '<div class="kr-note"></div>';
      const keys = $('.kr-keys', kr);
      keyGods.forEach((g) => {
        const has = !SETUP && state.done.includes(g.id);
        const k = el('span', 'kr-key' + (has ? ' has' : '') + (has && justKey === g.id ? ' new' : ''));
        k.appendChild(has ? Sprites.clone('key', g.color) : Sprites.clone('key', '#8888aa', '', 'gray'));
        k.title = has ? 'Ключ: ' + g.name : 'Ключ ещё не найден';
        keys.appendChild(k);
      });
      $('.kr-note', kr).textContent = got.length
        ? 'Ключей: ' + got.length + ' из ' + keyGods.length + ' · к последнему замку подойдёт только один'
        : 'Ключи ждут своих станций · к последнему замку подойдёт только один';
      foot.appendChild(kr);
      if (justKey) {
        const jk = justKey; justKey = null;
        setTimeout(() => { Sound.unlock(); const r = $('.kr-key.new', kr); if (r) { const b = r.getBoundingClientRect(); FX.burst(b.left + b.width / 2, b.top + b.height / 2, ['#ffe28a', '#ffffff', byId(jk).color], 30, 1); } }, 1500);
      }
    }
    if (allDone()) {
      const door = el('a', 'secret-door');
      door.href = '#/gate';
      door.innerHTML = '<span class="door-arch"></span><span class="door-txt"><span class="greek">ΘΥΡΑ</span>Тайная дверь</span>';
      door.querySelector('.door-arch').appendChild(Sprites.clone('lock', '#ffffff'));
      door.addEventListener('click', (e) => { e.preventDefault(); Sound.init(); go('#/gate', { color: '#2a1d0a', sprite: Sprites.clone('lock', '#ffffff', 'veil-sprite'), greek: 'ΘΥΡΑ', label: 'Тайная дверь' }); });
      foot.appendChild(door);
    }
    const scroll = el('button', 'px-btn small ghost', 'Свиток пролога');
    scroll.type = 'button';
    scroll.addEventListener('click', () => { Sound.init(); Sound.click(); showPrologue(true); });
    foot.appendChild(scroll);
    mount(wrap);

    /* только что открылся новый бог */
    if (pendingFocus) {
      const id = pendingFocus; pendingFocus = null;
      const t = $('.tile[href="#/god/' + id + '"]', wrap);
      if (t && !body.classList.contains('pre')) {
        t.classList.add('just');
        setTimeout(() => {
          Sound.unlock();
          const r = t.getBoundingClientRect();
          FX.burst(r.left + r.width / 2, r.top + r.height / 2, ['#ffe28a', '#ffffff', byId(id).color], 40, 1.1);
          t.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 900);
      }
    }
    /* случайные молнии над Олимпом */
    const bolts = () => {
      const t = setTimeout(() => {
        if (document.body.dataset.route === 'hub' && !body.classList.contains('pre') && !document.hidden) {
          FX.lightning(); setTimeout(() => Sound.thunder(0.7), 450 + Math.random() * 700);
        }
        timerRef.id = bolts();
      }, 28000 + Math.random() * 40000);
      return t;
    };
    const timerRef = { id: bolts() };
    addCleanup(() => clearTimeout(timerRef.id));
  }

  /* ───────────── СТРАНИЦА БОГА ───────────── */
  function drawStage(g) {
    const cv = $('#stage .stage-sprite'); const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 16, 16); ctx.drawImage(Sprites.sprite(g.sprite, g.color), 0, 0);
  }

  function buildVideo(g, page) {
    const base = 'gods/' + g.slug + '/video';
    const FORMATS = [['mp4', 'video/mp4'], ['webm', 'video/webm'], ['mov', '']];
    const wrap = el('div', 'stele');
    wrap.innerHTML =
      '<div class="stele-cap"><canvas class="pediment"></canvas></div>' +
      '<div class="stele-frame">' +
        '<video class="stele-video" playsinline preload="auto" controls controlsList="nodownload"></video>' +
        '<button class="video-cover" type="button" aria-label="Смотреть видео"><span class="cover-ico"></span><span class="cover-txt">Внимай</span><span class="cover-play">▶</span></button>' +
        '<div class="video-loading" hidden><span class="load-ico"></span><span class="load-txt">Загружаем свиток…</span></div>' +
        '<div class="video-missing" hidden><span class="miss-ico"></span><b class="miss-title"></b><span class="miss-text"></span><button class="px-btn small gold miss-retry" type="button" hidden>Повторить</button></div>' +
      '</div>' +
      '<div class="stele-base"><i></i><i></i><i></i></div>';
    pediment($('.pediment', wrap));
    const video = $('video', wrap), cover = $('.video-cover', wrap), miss = $('.video-missing', wrap), loading = $('.video-loading', wrap);
    const mTitle = $('.miss-title', wrap), mText = $('.miss-text', wrap), retry = $('.miss-retry', wrap);
    $('.cover-ico', wrap).appendChild(spriteFor(g));
    $('.miss-ico', wrap).appendChild(spriteFor(g));
    $('.load-ico', wrap).appendChild(spriteFor(g));

    let holding = false, failures = 0, autoRetried = false, alive = true, wantPlay = false;
    const setHold = (v) => { if (v !== holding) { holding = v; Sound.hold(v); } };
    const setLoading = (v) => { loading.hidden = !v; };

    const isHttp = /^https?:$/.test(location.protocol);

    /* По http(s) сначала быстро выясняем, какой файл есть, и грузим только его.
       Результат: {url} | 'absent' (файла нет — «скоро появится») | 'failed' (сеть/сервер) | 'unknown' */
    async function probe(bust) {
      const q = bust ? '?r=' + Date.now() : '';
      const res = await Promise.all(FORMATS.map(([ext]) =>
        fetch(base + '.' + ext + q, { method: 'HEAD', cache: 'no-store' })
          .then((r) => (r.ok ? 'ok' : r.status === 404 ? 'no' : 'other')).catch(() => 'err')));
      const i = res.indexOf('ok');
      if (i >= 0) return { url: base + '.' + FORMATS[i][0] + q };
      if (res.includes('err')) return 'failed';
      if (res.every((r) => r === 'no')) return 'absent';
      return 'unknown';
    }

    function useSources(bust) {            // запасной путь (file:// или нестандартный хостинг): пробуем все форматы по очереди
      failures = 0;
      video.removeAttribute('src');
      video.replaceChildren();
      FORMATS.forEach(([ext, type]) => {
        const s = document.createElement('source');
        s.src = base + '.' + ext + (bust ? '?r=' + Date.now() : '') + '#t=0.1';
        if (type) s.type = type;
        s.addEventListener('error', () => { failures++; if (failures >= FORMATS.length) problem('unknown'); });
        video.appendChild(s);
      });
      video.load();
    }

    async function attach(bust) {
      if (!isHttp) return useSources(bust);
      let r;
      try { r = await probe(bust); } catch (e) { r = 'failed'; }
      if (!alive) return;
      if (r && r.url) {
        video.replaceChildren();
        video.src = r.url + '#t=0.1';
        video.load();
        return;
      }
      if (r === 'unknown') return useSources(bust);
      problem(r);
    }

    function problem(kind) {
      if (!alive) return;
      setLoading(false);
      if (kind === 'failed' && !autoRetried) { autoRetried = true; setTimeout(() => alive && attach(true), 800); return; }
      cover.hidden = true; miss.hidden = false; video.classList.add('gone'); wrap.classList.add('no-video');
      if (kind === 'absent') {
        mTitle.textContent = 'Свиток ещё в пути'; mText.textContent = 'Видео от бога скоро появится здесь'; retry.hidden = true;
      } else if (kind === 'failed') {
        mTitle.textContent = 'Не удалось загрузить видео'; mText.textContent = 'Проверь соединение и нажми «Повторить»'; retry.hidden = false;
      } else {
        mTitle.textContent = 'Видео пока недоступно'; mText.textContent = 'Если оно уже лежит в папке бога — нажми «Повторить»'; retry.hidden = false;
      }
    }
    retry.addEventListener('click', () => {
      Sound.init(); Sound.click();
      miss.hidden = true; video.classList.remove('gone'); wrap.classList.remove('no-video'); cover.hidden = false; cover.classList.remove('hide');
      autoRetried = true; attach(true);
    });

    /* рамка подстраивается под формат ролика: вертикальное видео с телефона не тонет в 16:9 */
    video.addEventListener('loadedmetadata', () => {
      if (!video.videoWidth || !video.videoHeight) return;
      const ar = Math.max(0.5, Math.min(2.2, video.videoWidth / video.videoHeight));
      wrap.style.setProperty('--ar', ar.toFixed(4));
      wrap.classList.toggle('portrait', ar < 0.95);
    });
    /* обрыв посреди воспроизведения или ошибка единственного файла (сеть пропала, битый файл) */
    let resumeAt = 0;
    video.addEventListener('loadedmetadata', () => { if (resumeAt > 1) { try { video.currentTime = resumeAt; } catch (e) { /* ok */ } } resumeAt = 0; });
    video.addEventListener('error', () => {
      if (!alive || !video.currentSrc || failures > 0) return;
      if (video.currentTime > 1) resumeAt = video.currentTime;
      problem(isHttp ? 'failed' : 'unknown');
    });

    cover.addEventListener('click', () => {
      Sound.init(); Sound.click(); wantPlay = true;
      cover.classList.add('hide'); if (video.readyState < 3) setLoading(true);
      video.play().catch(() => { cover.classList.remove('hide'); setLoading(false); });
    });
    video.addEventListener('play', () => { cover.classList.add('hide'); setHold(true); });
    video.addEventListener('playing', () => setLoading(false));
    video.addEventListener('canplay', () => { if (!video.paused) setLoading(false); });
    video.addEventListener('waiting', () => { if (wantPlay && !video.paused) setLoading(true); });
    video.addEventListener('pause', () => { setHold(false); setLoading(false); });
    video.addEventListener('ended', () => { setHold(false); setLoading(false); page.classList.add('watched'); });
    addCleanup(() => { alive = false; setHold(false); try { video.pause(); video.removeAttribute('src'); video.replaceChildren(); video.load(); } catch (e) { /* ok */ } });

    attach(false);
    return wrap;
  }

  function buildLetter(g) {
    const wrap = el('div', 'letter');
    const paras = (CFG.HERMES_LETTER || []).map((p) => sub(p));
    wrap.innerHTML =
      '<div class="letter-top"><span class="wax"></span></div>' +
      '<div class="letter-paper">' +
        paras.map((p, i) => '<p style="animation-delay:' + (0.25 + i * 0.18).toFixed(2) + 's">' + esc(p) + '</p>').join('') +
        '<div class="letter-sign" style="animation-delay:' + (0.25 + paras.length * 0.18).toFixed(2) + 's">— ' + esc(CFG.HERMES_SIGN || g.name) + '</div>' +
      '</div>';
    $('.wax', wrap).appendChild(spriteFor(g));
    return wrap;
  }

  /* печать подвига: скрепляется, когда станция пройдена.
     auto=true — печати нет на странице, станцию завершает игра внутри (wrap.complete()). */
  function buildSeal(g, page, auto) {
    const wrap = el('section', 'seal');
    const k = SETUP ? null : ORDER.indexOf(g.id) + 1;
    const isDone = !SETUP && status(g.id) === 'done';

    function showOk(justNow) {
      const nxt = nextId();
      const all = allDone();
      wrap.innerHTML =
        '<div class="seal-ok">' +
          '<div class="stamp"></div>' +
          '<h2>' + (justNow ? 'Печать скреплена!' : 'Подвиг пройден') + '</h2>' +
          (g.key ? '<div class="got-key"><span class="gk-ico"></span><span>Ключ добавлен в связку</span></div>' : '') +
          (SETUP ? '' :
          '<div class="passport">' +
            '<div class="pp-label">Впиши в Паспорт Странника</div>' +
            '<div class="pp-row"><span>клетка</span><b class="pp-cell"></b><span>число</span><b class="pp-num"></b></div>' +
          '</div>') +
          '<p class="seal-next">' + (SETUP ? 'Режим настройки: прогресс не сохраняется.' : all ? 'Девять подвигов позади. Олимп явил тайную дверь…' : nxt ? 'Олимп открывает следующую дверь…' : '') + '</p>' +
          '<button class="px-btn gold big" type="button" id="back-btn">' + (all && justNow ? 'К тайной двери' : 'Вернуться на Олимп') + '</button>' +
        '</div>';
      $('.stamp', wrap).appendChild(Sprites.clone('check', '#ffffff'));
      if (g.key) $('.gk-ico', wrap).appendChild(Sprites.clone('key', g.color));
      if (!SETUP) {
        $('.pp-cell', wrap).appendChild(Sprites.digits(k, { color: '#3a2412' }));
        $('.pp-num', wrap).appendChild(Sprites.digits(g.id, { color: '#3a2412' }));
      }
      $('#back-btn', wrap).addEventListener('click', () => {
        Sound.click();
        if (all && justNow) go('#/gate', { color: '#2a1d0a', sprite: Sprites.clone('lock', '#ffffff', 'veil-sprite'), greek: 'ΘΥΡΑ', label: 'Тайная дверь' });
        else { pendingFocus = justNow ? nxt : null; go('#/', { color: '#1a1536', greek: 'ΟΛΥΜΠΟΣ', label: 'Олимп' }); }
      });
    }

    if (isDone) { showOk(false); return wrap; }

    let sealed = false;
    function success() { if (sealed) return; sealed = true; wrap.hidden = false; sealSuccess(g, page, wrap, showOk); }
    wrap.complete = success;
    if (auto) { wrap.hidden = true; return wrap; }

    wrap.innerHTML =
      '<h2>Печать подвига</h2>' +
      '<p class="seal-lead">Когда подвиг свершён — удерживай печать, пока она не скрепится. Олимп откроет следующую дверь.</p>' +
      '<button class="seal-hold" type="button" aria-label="Удерживай, чтобы скрепить печать"><span class="sh-bar"></span><span class="sh-ico"></span><span class="sh-txt">Удерживай печать</span></button>';
    const btn = $('.seal-hold', wrap), bar = $('.sh-bar', wrap), HOLD = 1100;
    $('.sh-ico', wrap).appendChild(Sprites.clone('check', '#ffffff'));
    let t0 = 0, timer = 0;
    function stop() { clearInterval(timer); timer = 0; btn.classList.remove('holding'); bar.style.width = '0'; }
    function start() {
      if (timer || sealed) return;
      Sound.init(); t0 = performance.now(); btn.classList.add('holding');
      timer = setInterval(() => {
        const p = Math.min(1, (performance.now() - t0) / HOLD);
        bar.style.width = (p * 100) + '%';
        if (p >= 1) { clearInterval(timer); timer = 0; success(); }
      }, 30);
    }
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); start(); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, stop));
    btn.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); start(); } });
    btn.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') stop(); });
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    addCleanup(() => clearInterval(timer));
    return wrap;
  }

  function sealSuccess(g, page, wrap, showOk) {
    Sound.success();
    FX.rain(g.fx.colors.concat(['#ffe28a', '#ffffff']), 160);
    FX.burst(innerWidth / 2, innerHeight * 0.55, g.fx.colors.concat(['#ffe28a']), 50, 1.3);
    if (!SETUP && !state.done.includes(g.id)) { state.done.push(g.id); store.set('done', state.done); }
    if (g.key) justKey = g.id;
    wrap.classList.add('sealed');
    showOk(true);
    wrap.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function renderGod(g) {
    setRoute('god');
    Scene.pause(); FX.setMode(g.fx.mode, g.fx.colors); Sound.setMood('god');
    const vars = godVars(g);
    applyVars(body, vars); drawStage(g);
    const k = SETUP ? null : ORDER.indexOf(g.id) + 1;
    const page = el('section', 'god');
    applyVars(page, vars);
    page.innerHTML =
      '<div class="god-top"><button class="px-btn small back" type="button">← На Олимп</button></div>' +
      '<header class="god-head">' +
        '<div class="god-sprite"></div>' +
        '<div class="god-n">' + (SETUP ? 'Знак № ' + g.id : 'Подвиг ' + k + ' из ' + GODS.length) + '</div>' +
        '<div class="greek">' + g.greek + '</div>' +
        '<h1 class="title">' + esc(g.name) + '</h1>' +
        '<div class="epithet">' + esc(g.epithet) + ' · ' + esc(g.station) + '</div>' +
        '<div class="meander"></div>' +
        '<blockquote class="quote">«' + esc(g.quote) + '»</blockquote>' +
      '</header>' +
      '<div class="god-body"></div>';
    $('.god-sprite', page).appendChild(spriteFor(g));
    const gb = $('.god-body', page);
    const Tr = window.Trials, Tl = window.Tools;

    /* испытание у врат: пока не пройдено — остальное закрыто */
    const passed = () => store.get('trials', []) || [];
    const needTrial = !!(Tr && g.trial && Tr.has(g.trial) && !passed().includes(g.id));
    const content = el('div', 'god-content');

    /* чем начинает бог: ролик, письмо Гермеса или диалог на сайте */
    const afterSpeech = [];
    let spoken = false;
    const gated = (node) => { if (g.intro === 'speech' && !spoken) { node.hidden = true; afterSpeech.push(node); } return node; };
    let intro;
    if (g.intro === 'letter') intro = buildLetter(g);
    else if (g.intro === 'speech' && Tl) intro = Tl.speech(g, { onDone: () => { spoken = true; afterSpeech.forEach((n) => { n.hidden = false; n.classList.add('screen-in'); }); } });
    else intro = buildVideo(g, page);
    content.appendChild(intro);

    const TOOLS = { 1: 'hermes', 2: 'hera', 6: 'prometheus', 7: 'demeter', 8: 'nike', 9: 'atlas' };
    let sealRef = null;
    if (g.game === 'apollo') content.appendChild(gated(buildApollo(g, () => sealRef && sealRef.complete && sealRef.complete())));
    const completeStation = () => sealRef && sealRef.complete && sealRef.complete();
    if (Tl && TOOLS[g.id] && Tl[TOOLS[g.id]]) content.appendChild(gated(Tl[TOOLS[g.id]](g, { onComplete: completeStation })));

    content.appendChild(el('p', 'myth', esc(g.myth)));

    if (CFG.SHOW_TASK_RECAP !== false && g.recap) {
      const d = el('details', 'recap');
      d.innerHTML = '<summary>Напомнить задание</summary><p>' + esc(g.recap) + '</p>';
      d.addEventListener('toggle', () => Sound.click());
      content.appendChild(d);
    }
    /* печать прячется, если станцию завершает игра или инструмент внутри (Аполлон; поле finish: 'tool') */
    sealRef = buildSeal(g, page, g.game === 'apollo' || g.finish === 'tool');
    content.appendChild(sealRef);

    if (needTrial) {
      content.hidden = true; page.classList.add('gated');
      const gate = Tr.create(g, () => {
        const l = passed(); if (!l.includes(g.id)) { l.push(g.id); store.set('trials', l); }
        gate.classList.add('leaving');
        setTimeout(() => {
          gate.remove(); page.classList.remove('gated'); content.hidden = false; content.classList.add('reveal');
          content.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }, 500);
      });
      gb.append(gate, content);
    } else gb.appendChild(content);

    $('.back', page).addEventListener('click', () => { Sound.init(); Sound.click(); go('#/', { color: '#1a1536', greek: 'ΟΛΥΜΠΟΣ', label: 'Олимп' }); });
    const onKey = (e) => { if (e.key === 'Escape' && !busy && !document.querySelector('.apollo')) go('#/', { color: '#1a1536', greek: 'ΟΛΥΜΠΟΣ', label: 'Олимп' }); };
    document.addEventListener('keydown', onKey);
    addCleanup(() => document.removeEventListener('keydown', onKey));
    mount(page);
  }

  function buildApollo(g, onComplete) {
    const box = el('section', 'game-card');
    const A = CFG.APOLLO || {};
    box.innerHTML =
      '<h2>Песнь Аполлона</h2>' +
      '<p>Возьми телефон, надень наушники и разреши микрофон. Шарик слушается только твоего голоса: попадай в ноты — и за каждый чисто спетый куплет получишь цифру.</p>' +
      '<button class="px-btn gold big" type="button">Начать песнь</button>' +
      '<p class="game-note">Песня: ' + esc(A.SONG_TITLE || '—') + '</p>';
    $('button', box).addEventListener('click', () => {
      Sound.init(); Sound.click();
      window.Apollo.open({ cfg: A, color: g.color, onComplete });
    });
    return box;
  }

  /* ───────────── ТАЙНАЯ ДВЕРЬ ───────────── */
  function renderGate() {
    setRoute('gate');
    Scene.pause(); FX.setMode('stars', ['#fff3c4', '#b9c6ff', '#ffffff', '#f3c24f']); Sound.setMood('gate');
    applyVars(body, { '--god': '#f2c14e', '--bg1': '#1a1230', '--bg2': '#07061a' });
    const stageCtx = $('#stage .stage-sprite').getContext('2d'); stageCtx.clearRect(0, 0, 16, 16); stageCtx.drawImage(Sprites.sprite('lock', '#f2c14e'), 0, 0);

    const page = el('section', 'gate');
    page.innerHTML =
      '<div class="god-top"><button class="px-btn small back" type="button">← На Олимп</button></div>' +
      '<header class="gate-head">' +
        '<div class="greek">ΘΥΡΑ</div>' +
        '<h1 class="title">Тайная дверь</h1>' +
        '<div class="meander"></div>' +
      '</header>' +
      '<div class="gate-body"></div>';
    const gb = $('.gate-body', page);
    $('.back', page).addEventListener('click', () => { Sound.init(); Sound.click(); go('#/', { color: '#1a1536', greek: 'ΟΛΥΜΠΟΣ', label: 'Олимп' }); });

    if (!FINAL) {
      gb.innerHTML = '<p class="gate-lead">Врата ещё не знают своего ключа. Организатору: впиши <b>ORDER</b> в assets/js/config.js.</p>';
    } else if (state.gateOpen) {
      gb.appendChild(coordsCard(false));
    } else {
      buildLock(gb, page);
    }
    mount(page);
  }

  function coordsCard(animate) {
    const c = el('div', 'coords-card' + (animate ? ' reveal' : ''));
    const val = String(CFG.FINALE && CFG.FINALE.coordinates || '').trim();
    c.innerHTML =
      '<div class="coords-label">' + esc((CFG.FINALE && CFG.FINALE.caption) || 'Координаты') + '</div>' +
      (val ? '<div class="coords-val" id="coords-val">' + esc(val) + '</div><button class="px-btn small ghost" type="button" id="copy-btn">Скопировать</button>'
           : '<div class="coords-val empty">Координаты пока не заданы<br><small>assets/js/config.js → FINALE.coordinates</small></div>');
    const b = $('#copy-btn', c);
    if (b) b.addEventListener('click', () => {
      const done = () => toast('Скопировано');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(val).then(done, () => selectText());
      else selectText();
      function selectText() { const r = document.createRange(); r.selectNodeContents($('#coords-val', c)); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Выделено — скопируй'); }
    });
    return c;
  }

  function buildLock(gb, page) {
    const need = FINAL.length;
    const entered = [];
    let fails = 0, locked = false;
    gb.innerHTML =
      '<p class="gate-lead">Девять печатей. Впиши числа из Паспорта Странника — в том порядке, в каком ты проходила подвиги.</p>' +
      '<div class="door"><div class="door-leaf l"></div><div class="door-leaf r"></div><div class="door-glow"></div>' +
        '<div class="slots"></div></div>' +
      '<div class="keypad"></div>' +
      '<div class="gate-actions"><button class="px-btn small ghost" type="button" id="erase">Стереть</button><button class="px-btn small ghost" type="button" id="clear">Сначала</button></div>' +
      '<p class="gate-msg" role="alert"></p>' +
      '<div class="gate-result"></div>';
    const slots = $('.slots', gb), pad = $('.keypad', gb), msg = $('.gate-msg', gb);
    const slotEls = [];
    for (let i = 0; i < need; i++) { const s = el('span', 'slot'); slots.appendChild(s); slotEls.push(s); }
    GODS.forEach((g) => {
      const b = el('button', 'key'); b.type = 'button'; b.style.setProperty('--god', g.color);
      applyVars(b, godVars(g));
      const num = Sprites.digits(g.id, { color: '#fff7e0', shadow: 'rgba(0,0,0,.55)' });
      b.appendChild(num);
      b.addEventListener('click', () => press(g.id));
      b.setAttribute('aria-label', 'Число ' + g.id);
      pad.appendChild(b);
    });

    function paint() {
      slotEls.forEach((s, i) => {
        s.replaceChildren(); s.classList.toggle('on', i < entered.length);
        if (i < entered.length) { s.appendChild(Sprites.digits(entered[i], { color: '#fff7e0', shadow: 'rgba(0,0,0,.55)' })); const g = byId(entered[i]); s.style.setProperty('--god', g.color); }
      });
    }
    function press(n) {
      if (locked || entered.length >= need) return;
      Sound.init(); Sound.note(byId(n).note, 0.6);
      entered.push(n); paint(); msg.textContent = ''; msg.classList.remove('on');
      if (entered.length === need) check();
    }
    function check() {
      locked = true;
      setTimeout(() => {
        const ok = entered.every((v, i) => v === FINAL[i]);
        if (ok) return open();
        fails++; Sound.fail(); shake($('.door', gb)); slots.classList.add('bad');
        const hint = fails >= (CFG.GATE_HINT_AFTER || 3) ? ' Загляни в свой Паспорт Странника: числа идут в том порядке, в каком ты проходила подвиги.' : '';
        msg.textContent = 'Врата безмолвны.' + hint; msg.classList.add('on');
        setTimeout(() => { entered.length = 0; slots.classList.remove('bad'); paint(); locked = false; }, 1100);
      }, 350);
    }
    async function open() {
      Sound.doorOpen(); FX.lightning(innerWidth / 2); FX.rain(['#ffe28a', '#f3c24f', '#ffffff'], 140);
      state.gateOpen = true; store.set('gateOpen', true);
      $('.door', gb).classList.add('opening');
      $('.keypad', gb).classList.add('gone'); $('.gate-actions', gb).classList.add('gone'); $('.gate-lead', gb).classList.add('gone'); msg.classList.add('gone');
      await sleep(2600);
      const res = $('.gate-result', gb); res.appendChild(coordsCard(true));
      $('.door', gb).classList.add('open');
      res.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    $('#erase', gb).addEventListener('click', () => { if (locked) return; entered.pop(); paint(); Sound.click(); });
    $('#clear', gb).addEventListener('click', () => { if (locked) return; entered.length = 0; paint(); Sound.click(); });
    const onKey = (e) => {
      if (/^[1-9]$/.test(e.key)) press(+e.key);
      else if (e.key === 'Backspace' && !locked) { entered.pop(); paint(); }
    };
    document.addEventListener('keydown', onKey);
    addCleanup(() => document.removeEventListener('keydown', onKey));
    paint();
    window.__openGate = () => open();   // для проверки организатором: в консоли браузера __openGate()
  }

  /* ───────────── ПАНЕЛЬ ОРГАНИЗАТОРА ───────────── */
  function renderAdmin() {
    setRoute('admin');
    Scene.pause(); FX.setMode('gold'); Sound.setMood('gate');
    applyVars(body, { '--god': '#f2c14e', '--bg1': '#14122e', '--bg2': '#07061a' });
    const page = el('section', 'admin');
    if (!state.adminOK) {
      page.innerHTML =
        '<div class="god-top"><button class="px-btn small back" type="button">← На Олимп</button></div>' +
        '<div class="admin-card"><h1 class="title">Для организатора</h1><form class="seal-form"><input class="seal-input" type="password" placeholder="Пин" autocomplete="off" aria-label="Пин"><button class="px-btn gold" type="submit">Войти</button></form><p class="seal-msg"></p></div>';
      $('.back', page).addEventListener('click', () => go('#/', { color: '#1a1536', label: 'Олимп' }));
      $('form', page).addEventListener('submit', (e) => {
        e.preventDefault();
        if ($('input', page).value === String(CFG.ADMIN_PIN)) { state.adminOK = true; renderAdmin(); }
        else { shake($('form', page)); $('.seal-msg', page).textContent = 'Неверный пин.'; $('.seal-msg', page).classList.add('on'); }
      });
      return mount(page);
    }

    const warn = [];
    if (SETUP) warn.push('ORDER не задан — сайт в режиме настройки (открыты все кнопки).');
    if (!FINAL) warn.push('Финальный код не определён (нужен ORDER или FINAL_CODE).');
    if (!String(CFG.FINALE && CFG.FINALE.coordinates || '').trim()) warn.push('Не заданы координаты (FINALE.coordinates).');
    if (CFG.ADMIN_PIN === '0000') warn.push('Пин организатора всё ещё 0000 — поменяй ADMIN_PIN.');

    const seq = SETUP ? GODS.map((g) => g.id) : ORDER;
    page.innerHTML =
      '<div class="god-top"><button class="px-btn small back" type="button">← На Олимп</button></div>' +
      '<div class="admin-card">' +
        '<h1 class="title">Для организатора</h1>' +
        (warn.length ? '<ul class="warn">' + warn.map((w) => '<li>' + esc(w) + '</li>').join('') + '</ul>' : '<p class="ok-line">Конфигурация заполнена полностью.</p>') +
        '<h2>Цепочка</h2>' +
        '<table class="chain"><thead><tr><th>Шаг</th><th>Бог</th><th>Игра у врат</th><th>Статус</th><th>Видео</th></tr></thead><tbody>' +
        seq.map((id, i) => { const g = byId(id); return '<tr><td>' + (i + 1) + '</td><td>№' + g.id + ' ' + esc(g.name) + '</td><td class="mono">' + esc(g.trial || '—') + '</td><td>' + (SETUP ? '—' : ({ done: 'пройден', active: 'открыт', locked: 'закрыт' }[status(g.id)])) + '</td><td class="vid" data-v="' + g.id + '">' + (g.video === false ? (g.intro === 'letter' ? 'нет (письмо)' : 'нет (диалог)') : '…') + '</td></tr>'; }).join('') +
        '</tbody></table>' +
        '<p class="mono final-line">Финальный код: <b>' + (FINAL ? FINAL.join(' ') : '—') + '</b></p>' +
        '<h2>Управление прогрессом</h2>' +
        '<div class="admin-row"><label>Считать пройденными первые <select id="adm-n"></select> подвигов</label><button class="px-btn small" type="button" id="adm-set">Применить</button></div>' +
        '<div class="admin-row"><button class="px-btn small ghost" type="button" id="adm-reset">Сбросить прогресс</button><button class="px-btn small ghost" type="button" id="adm-gate">Тайная дверь: ' + (state.gateOpen ? 'закрыть' : 'открыть') + '</button><button class="px-btn small ghost" type="button" id="adm-prologue">Показать пролог</button><button class="px-btn small ghost" type="button" id="adm-thunder">Гром</button></div>' +
        '<div class="admin-row"><button class="px-btn small ghost" type="button" id="adm-trials">Испытания у врат: ' + ((store.get('trials', []) || []).length >= GODS.length ? 'вернуть' : 'пройти все') + '</button><button class="px-btn small ghost" type="button" id="adm-sphinx">Показать капчу Сфинкса</button></div>' +
        '<p class="seal-dev">Прогресс хранится в браузере именно того устройства, на котором играет Юля.</p>' +
      '</div>';
    const sel = $('#adm-n', page);
    for (let i = 0; i <= GODS.length; i++) { const o = el('option', '', String(i)); o.value = i; if (!SETUP && i === state.done.length) o.selected = true; sel.appendChild(o); }
    $('.back', page).addEventListener('click', () => go('#/', { color: '#1a1536', label: 'Олимп' }));
    $('#adm-set', page).addEventListener('click', () => { if (SETUP) return toast('Сначала задай ORDER'); state.done = ORDER.slice(0, +sel.value); store.set('done', state.done); toast('Готово'); renderAdmin(); });
    $('#adm-reset', page).addEventListener('click', () => { state.done = []; state.gateOpen = false; store.set('done', []); store.set('gateOpen', false); store.set('trials', []); store.set('spoken', []); store.set('sphinx', false); store.set('nike', null); store.set('atlas', null); toast('Прогресс сброшен'); renderAdmin(); });
    $('#adm-trials', page).addEventListener('click', () => { const all = (store.get('trials', []) || []).length >= GODS.length; store.set('trials', all ? [] : GODS.map((g) => g.id)); toast(all ? 'Испытания вернулись' : 'Все испытания пройдены'); renderAdmin(); });
    $('#adm-sphinx', page).addEventListener('click', () => { Sound.init(); Trials.runSphinx(); });
    $('#adm-gate', page).addEventListener('click', () => { state.gateOpen = !state.gateOpen; store.set('gateOpen', state.gateOpen); renderAdmin(); });
    $('#adm-prologue', page).addEventListener('click', () => { Sound.init(); showPrologue(true); });
    $('#adm-thunder', page).addEventListener('click', () => { Sound.init(); FX.lightning(); setTimeout(() => Sound.thunder(), 400); });
    mount(page);
    /* какие видео уже лежат на месте (работает при открытии по http/https) */
    GODS.forEach((g) => {
      if (g.video === false) return;
      const cell = $('.vid[data-v="' + g.id + '"]', page); if (!cell) return;
      if (location.protocol === 'file:') { cell.textContent = '?'; return; }
      const exts = ['mp4', 'webm', 'mov'];
      Promise.all(exts.map((x) => fetch('gods/' + g.slug + '/video.' + x, { method: 'HEAD' }).then((r) => r.ok).catch(() => false)))
        .then((r) => { cell.textContent = r.some(Boolean) ? 'есть' : 'нет'; cell.classList.add(r.some(Boolean) ? 'yes' : 'no'); });
    });
  }

  /* ───────────── ПРОЛОГ ───────────── */
  function showPrologue(replay) {
    return new Promise((resolve) => {
      const lines = (CFG.PROLOGUE || []).map(sub);
      const ov = el('div', 'prologue');
      ov.innerHTML = '<div class="prologue-box pxbox"><div class="greek">ΠΡΟΛΟΓΟΣ</div><div class="prologue-text"></div><div class="prologue-hint">нажми, чтобы продолжить</div><button class="px-btn gold" type="button" hidden>Начать подвиги</button></div>';
      $('#overlay-root').appendChild(ov);
      requestAnimationFrame(() => ov.classList.add('on'));
      const text = $('.prologue-text', ov), hint = $('.prologue-hint', ov), btn = $('button', ov);
      let i = -1, typing = false, timer = 0, full = '', p = null;
      function lastDone() { if (i >= lines.length - 1) { hint.hidden = true; btn.hidden = false; } }
      function finishLine() { clearInterval(timer); typing = false; if (p) p.textContent = full; lastDone(); }
      function next() {
        if (typing) return finishLine();
        i++;
        if (i >= lines.length) return;
        p = el('p', i === 0 ? 'first' : ''); text.appendChild(p);
        full = lines[i]; let n = 0; typing = true;
        timer = setInterval(() => {
          n++; p.textContent = full.slice(0, n);
          if (n % 3 === 0) Sound.type();
          if (n >= full.length) { clearInterval(timer); typing = false; lastDone(); }
        }, 26);
      }
      function close() {
        clearInterval(timer); store.set('prologue', true);
        ov.classList.remove('on'); setTimeout(() => ov.remove(), 450); resolve();
      }
      ov.addEventListener('click', (e) => { if (e.target === btn) return; next(); });
      btn.addEventListener('click', () => { Sound.click(); close(); });
      setTimeout(next, 500);
    });
  }

  /* ───────────── ВХОД В ХРАМ ───────────── */
  async function enterTemple() {
    if (state.entered) return;
    state.entered = true;
    Sound.init();
    const e = $('#enter'); e.classList.add('leaving');
    FX.lightning(innerWidth * 0.55); setTimeout(() => Sound.thunder(0.9), 250);
    await sleep(900);
    e.remove(); body.classList.remove('pre'); body.classList.add('in');
    if (body.dataset.route === 'hub' && (!store.get('prologue', false) || CFG.PROLOGUE_EVERY_TIME)) { await sleep(900); await showPrologue(); }
    /* капча Сфинкса — один раз на устройстве */
    if (body.dataset.route === 'hub' && window.Trials && !store.get('sphinx', false)) {
      await sleep(500); await Trials.runSphinx(); store.set('sphinx', true);
    }
  }
  $('#enter-name').textContent = NAME_GEN;
  $('#enter-btn').addEventListener('click', enterTemple);
  $('.enter-sprite').appendChild(Sprites.clone('prometheus', '#C1443B', 'enter-torch'));

  /* кнопка звука */
  const sbtn = $('#sound-btn');
  sbtn.innerHTML = '<span>♪</span>';
  function paintSound() { sbtn.classList.toggle('off', !Sound.enabled); sbtn.setAttribute('aria-pressed', String(!Sound.enabled)); }
  sbtn.addEventListener('click', () => { Sound.init(); Sound.setEnabled(!Sound.enabled); paintSound(); if (Sound.enabled) Sound.click(); });
  paintSound();

  route();
})();
