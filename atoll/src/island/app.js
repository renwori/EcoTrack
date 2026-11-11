'use strict';
/* global atoll, Weather */

// ==================== Утилиты ====================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (id) => `<svg><use href="#i-${id}"/></svg>`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad2 = (n) => String(n).padStart(2, '0');
function fmtDur(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}
const hhmm = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

// ==================== Состояние ====================
const DEFAULTS = {
  settings: {
    theme: 'dark',
    accent: '#ffb238',
    city: { name: 'Москва', region: 'Россия', lat: 55.7558, lon: 37.6173 },
    visualizer: true,
    coverGlow: true,
    trackToast: true,
    yandexPreload: true,
  },
  notes: [{ id: 'n1', title: 'Заметка', text: '', updated: Date.now() }],
  tasks: [],
  quickNote: '',
  reminders: [],
  radioFavs: [],
  localFolder: '',
  timer: { total: 300, remaining: 300, running: false, endAt: 0 },
  volume: 0.8,
  shuffle: false,
  repeat: 'off',
};
let S = JSON.parse(JSON.stringify(DEFAULTS));
const save = (key) => atoll.set(key, S[key]);

const islandEl = $('#island');
const player = $('#player');

// ==================== Форма острова ====================
const UI = {
  mode: 'collapsed',      // collapsed | expanded | alerting
  pinned: false,
  hover: false,
  sticky: false,          // открыт горячей клавишей — не сворачивать, пока мышь не зайдёт и не уйдёт
  tab: 'home',
  hoverTimer: null,
  leaveTimer: null,
};

function pillWidth() {
  const kids = $$('#pill > *').filter((el) => getComputedStyle(el).display !== 'none' && el.offsetWidth > 0);
  const w = kids.reduce((a, el) => a + el.offsetWidth, 0) + Math.max(0, kids.length - 1) * 9 + 28;
  return clamp(Math.ceil(w), 120, 420);
}

function applySize() {
  let w; let h; let r;
  if (UI.mode === 'expanded') { w = 720; h = 410; r = 28; }
  else if (UI.mode === 'alerting') { w = 440; h = 64; r = 32; }
  else { w = pillWidth(); h = 38; r = 19; }
  islandEl.style.setProperty('--w', w + 'px');
  islandEl.style.setProperty('--h', h + 'px');
  islandEl.style.setProperty('--r', r + 'px');
  islandEl.classList.toggle('collapsed', UI.mode === 'collapsed');
  islandEl.classList.toggle('expanded', UI.mode === 'expanded');
  islandEl.classList.toggle('alerting', UI.mode === 'alerting');
  Viz.resize();
}

function setMode(mode) {
  if (UI.mode === mode) return;
  UI.mode = mode;
  if (mode === 'expanded') renderTab();
  if (mode === 'collapsed') {
    UI.sticky = false;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  applySize();
}

function expand() { clearTimeout(UI.leaveTimer); if (UI.mode !== 'alerting') setMode('expanded'); }
function collapse() { if (UI.pinned) return; setMode('collapsed'); if (!UI.hover) atoll.setInteractive(false); }

function typingInside() {
  const a = document.activeElement;
  return a && islandEl.contains(a) && /^(INPUT|TEXTAREA)$/.test(a.tagName) && UI.hover;
}

islandEl.addEventListener('mouseenter', () => {
  UI.hover = true;
  UI.sticky = false;
  atoll.setInteractive(true);
  clearTimeout(UI.leaveTimer);
  if (UI.mode === 'collapsed') UI.hoverTimer = setTimeout(expand, 220);
});
islandEl.addEventListener('mouseleave', () => {
  UI.hover = false;
  clearTimeout(UI.hoverTimer);
  if (UI.mode === 'expanded' && !UI.pinned && !UI.sticky) {
    UI.leaveTimer = setTimeout(() => { if (!UI.hover && !typingInside()) collapse(); }, 500);
  }
  if (UI.mode !== 'expanded' || (!UI.pinned && !UI.sticky)) {
    // Отпускаем мышь, чтобы клики проходили на рабочий стол.
    setTimeout(() => { if (!UI.hover && !UI.pinned && !UI.sticky) atoll.setInteractive(false); }, 60);
  }
});
islandEl.addEventListener('mousedown', () => atoll.focus());
$('#pill').addEventListener('click', expand);

atoll.onToggle((forceOpen) => {
  if (UI.mode === 'expanded' && !forceOpen) { UI.pinned = false; $('#pinBtn').classList.remove('on'); setMode('collapsed'); atoll.setInteractive(false); return; }
  UI.sticky = true;
  atoll.setInteractive(true);
  atoll.focus();
  expand();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { UI.pinned = false; $('#pinBtn').classList.remove('on'); UI.sticky = false; setMode('collapsed'); atoll.setInteractive(false); atoll.blur(); }
});
$('#pinBtn').addEventListener('click', () => {
  UI.pinned = !UI.pinned;
  $('#pinBtn').classList.toggle('on', UI.pinned);
});

// Вкладки
$$('#tabs [data-tab]').forEach((b) => b.addEventListener('click', () => { UI.tab = b.dataset.tab; renderTab(); }));
function renderTab() {
  islandEl.dataset.tab = UI.tab;
  $$('#tabs [data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === UI.tab));
  $$('.page').forEach((p) => p.classList.toggle('active', p.dataset.page === UI.tab));
  ({ home: renderHome, music: renderMusic, weather: renderWeatherPage, notes: renderNotes, timer: renderTimerPage, settings: renderSettings }[UI.tab] || (() => {}))();
}

// ==================== Всплывающие события ====================
let alertTimer = null;
let alertPrevMode = 'collapsed';
function showAlert({ emoji = '', img = '', title = '', sub = '', actions = [], duration = 0, shake = false }) {
  const ic = $('#alertIcon');
  ic.innerHTML = img ? `<img src="${esc(img)}" alt="">` : esc(emoji);
  $('#alertTitle').textContent = title;
  $('#alertSub').textContent = sub;
  const box = $('#alertActions');
  box.innerHTML = '';
  actions.forEach((a) => {
    const b = document.createElement('button');
    b.className = a.primary ? 'icon-btn' : 'btn ghost';
    if (a.primary) { b.innerHTML = icon('check'); b.style.background = 'var(--text)'; b.style.color = 'var(--bg)'; b.style.borderRadius = '50%'; } else b.textContent = a.label;
    b.addEventListener('click', (e) => { e.stopPropagation(); hideAlert(); if (a.fn) a.fn(); });
    box.appendChild(b);
  });
  if (UI.mode !== 'alerting') alertPrevMode = UI.mode === 'expanded' ? 'expanded' : 'collapsed';
  setMode('alerting');
  if (actions.length) atoll.setInteractive(true);
  if (shake) {
    islandEl.classList.remove('shake');
    void islandEl.offsetWidth;
    islandEl.classList.add('shake');
  }
  clearTimeout(alertTimer);
  if (duration) alertTimer = setTimeout(hideAlert, duration);
}
function hideAlert() {
  clearTimeout(alertTimer);
  islandEl.classList.remove('shake');
  if (UI.mode !== 'alerting') return;
  setMode(alertPrevMode === 'expanded' && UI.hover ? 'expanded' : 'collapsed');
  if (!UI.hover) atoll.setInteractive(false);
}
$('#alert').addEventListener('click', () => { if (!$('#alertActions').children.length) hideAlert(); });

function chime(times = 3) {
  try {
    const ctx = Viz.audioCtx();
    const now = ctx.currentTime;
    const notes = [880, 1174.66, 1567.98];
    for (let k = 0; k < times; k++) {
      notes.forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        const t = now + k * 0.9 + i * 0.13;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.18, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        o.connect(g).connect(ctx.destination);
        o.start(t);
        o.stop(t + 0.65);
      });
    }
  } catch (e) { /* без звука */ }
}

// ==================== Часы ====================
function tickClock() {
  $('#pillTime').textContent = hhmm(new Date());
}

// ==================== Визуализация звука ====================
const Viz = (() => {
  let ctx = null;
  let loopAnalyser = null;
  let elAnalyser = null;
  let elSource = null;
  let freq = null;
  let raf = 0;
  let amp = 0;
  const N = 56;
  const vals = new Float32Array(N + 1);
  const bars = new Float32Array(4);
  const cv = $('#wave');
  const g = cv.getContext('2d');
  let fill = '#0b0b0e';
  let fakePhase = 0;

  function audioCtx() {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  async function startLoopback() {
    if (loopAnalyser || !S.settings.visualizer) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      stream.getVideoTracks().forEach((t) => t.stop());
      const track = stream.getAudioTracks()[0];
      if (!track) throw new Error('нет звуковой дорожки');
      const c = audioCtx();
      const src = c.createMediaStreamSource(new MediaStream([track]));
      loopAnalyser = c.createAnalyser();
      loopAnalyser.fftSize = 256;
      loopAnalyser.smoothingTimeConstant = 0.72;
      src.connect(loopAnalyser);
      track.addEventListener('ended', () => { loopAnalyser = null; });
    } catch (e) {
      loopAnalyser = null; // остаётся анализ встроенного плеера или мягкая имитация
    }
  }

  function attachElement() {
    if (elSource) return;
    try {
      const c = audioCtx();
      elSource = c.createMediaElementSource(player);
      elAnalyser = c.createAnalyser();
      elAnalyser.fftSize = 256;
      elAnalyser.smoothingTimeConstant = 0.72;
      elSource.connect(elAnalyser);
      elAnalyser.connect(c.destination);
    } catch (e) { /* ignore */ }
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(cv.clientWidth * dpr));
    const h = Math.max(1, Math.round(cv.clientHeight * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    fill = getComputedStyle(islandEl).backgroundColor;
  }

  function sample(playing) {
    const analyser = loopAnalyser || (Music.active === 'builtin' ? elAnalyser : null);
    if (analyser && playing) {
      if (!freq || freq.length !== analyser.frequencyBinCount) freq = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freq);
      const half = N / 2;
      for (let i = 0; i <= N; i++) {
        const d = Math.abs(i - half) / half;           // басы в центре, верха по краям
        const bin = Math.min(freq.length - 1, Math.floor(Math.pow(d, 1.6) * 60) + 1);
        const v = freq[bin] / 255;
        vals[i] += (v * v * 1.25 - vals[i]) * 0.35;
      }
      for (let b = 0; b < 4; b++) {
        const v = freq[2 + b * 6] / 255;
        bars[b] += (v - bars[b]) * 0.4;
      }
    } else if (playing) {
      // Имитация, если системный звук недоступен
      fakePhase += 0.09;
      const beat = Math.pow(Math.max(0, Math.sin(fakePhase * 1.9)), 6);
      for (let i = 0; i <= N; i++) {
        const v = 0.25 + 0.35 * beat + 0.18 * Math.sin(fakePhase * 2.3 + i * 0.55) * Math.sin(fakePhase * 0.7 + i * 0.21);
        vals[i] += (clamp(v, 0, 1) - vals[i]) * 0.25;
      }
      for (let b = 0; b < 4; b++) bars[b] += ((0.3 + 0.6 * Math.abs(Math.sin(fakePhase * (1.3 + b * 0.37) + b))) - bars[b]) * 0.3;
    } else {
      for (let i = 0; i <= N; i++) vals[i] *= 0.85;
      for (let b = 0; b < 4; b++) bars[b] *= 0.8;
    }
  }

  function draw() {
    const np = Music.nowPlaying();
    const playing = !!(np && np.playing) && S.settings.visualizer;
    const target = playing ? (UI.mode === 'expanded' ? 13 : UI.mode === 'alerting' ? 6 : 8) : 0;
    amp += (target - amp) * 0.12;
    sample(playing);

    const pb = $$('#pillBars i');
    pb.forEach((el, i) => { el.style.height = Math.round(25 + bars[i] * 75) + '%'; });

    const dpr = window.devicePixelRatio || 1;
    const w = cv.width;
    const h = cv.height;
    g.clearRect(0, 0, w, h);
    if (amp > 0.15) {
      const top = 2 * dpr;
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const x = (i / N) * w;
        const env = Math.pow(Math.sin(Math.PI * i / N), 0.9);
        pts.push([x, top + vals[i] * env * amp * dpr]);
      }
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        const mx = (pts[i - 1][0] + pts[i][0]) / 2;
        const my = (pts[i - 1][1] + pts[i][1]) / 2;
        g.quadraticCurveTo(pts[i - 1][0], pts[i - 1][1], mx, my);
      }
      g.lineTo(w, pts[N][1]);
      g.lineTo(w, 0);
      g.closePath();
      g.fillStyle = fill;
      g.fill();

      // Светящаяся кромка цветом обложки
      const glow = getComputedStyle(islandEl).getPropertyValue('--glow').trim() || '255,178,56';
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        const mx = (pts[i - 1][0] + pts[i][0]) / 2;
        const my = (pts[i - 1][1] + pts[i][1]) / 2;
        g.quadraticCurveTo(pts[i - 1][0], pts[i - 1][1], mx, my);
      }
      g.strokeStyle = `rgba(${glow}, 0.85)`;
      g.lineWidth = 1.4 * dpr;
      g.shadowColor = `rgba(${glow}, 0.9)`;
      g.shadowBlur = 8 * dpr;
      g.stroke();
      g.shadowBlur = 0;
    }
    raf = requestAnimationFrame(draw);
  }

  function start() { if (!raf) raf = requestAnimationFrame(draw); }

  return { audioCtx, startLoopback, attachElement, resize, start };
})();

// ==================== Музыка ====================
const RB_HOSTS = ['https://de1.api.radio-browser.info', 'https://de2.api.radio-browser.info', 'https://fi1.api.radio-browser.info', 'https://nl1.api.radio-browser.info'];
const RADIO_CHIPS = [
  { id: 'fav', label: '★ Избранное' },
  { id: 'ru', label: 'Топ России', path: '/json/stations/search?countrycode=RU&order=clickcount&reverse=true&limit=60&hidebroken=true' },
  { id: 'pop', label: 'Поп', path: '/json/stations/bytag/pop?order=clickcount&reverse=true&limit=60&hidebroken=true' },
  { id: 'rock', label: 'Рок', path: '/json/stations/bytag/rock?order=clickcount&reverse=true&limit=60&hidebroken=true' },
  { id: 'lofi', label: 'Lo-fi', path: '/json/stations/bytag/lofi?order=clickcount&reverse=true&limit=60&hidebroken=true' },
  { id: 'jazz', label: 'Джаз', path: '/json/stations/bytag/jazz?order=clickcount&reverse=true&limit=60&hidebroken=true' },
  { id: 'classical', label: 'Классика', path: '/json/stations/bytag/classical?order=clickcount&reverse=true&limit=60&hidebroken=true' },
  { id: 'electronic', label: 'Электроника', path: '/json/stations/bytag/electronic?order=clickcount&reverse=true&limit=60&hidebroken=true' },
  { id: 'hiphop', label: 'Хип-хоп', path: '/json/stations/bytag/hip-hop?order=clickcount&reverse=true&limit=60&hidebroken=true' },
  { id: 'world', label: 'Мировой топ', path: '/json/stations/search?order=clickcount&reverse=true&limit=60&hidebroken=true' },
];

const Music = {
  active: null,         // 'yandex' | 'builtin'
  ym: null,             // состояние из окна Яндекс Музыки
  ymError: '',
  item: null,           // текущий элемент встроенного плеера
  queue: [],
  index: -1,
  src: 'yandex',        // открытая вкладка в разделе «Музыка»
  radioChip: 'ru',
  radioResults: [],
  localTracks: [],
  lastKey: '',

  nowPlaying() {
    if (this.active === 'builtin' && this.item) {
      return {
        source: this.item.type === 'radio' ? 'Радио' : 'Мои файлы',
        kind: 'builtin',
        title: this.item.title,
        artist: this.item.artist,
        cover: this.item.cover,
        playing: !player.paused,
        position: player.currentTime,
        duration: Number.isFinite(player.duration) ? player.duration : 0,
        live: this.item.type === 'radio',
      };
    }
    const y = this.ym;
    if (y && (y.title || y.playing)) {
      return { source: 'Яндекс Музыка', kind: 'yandex', title: y.title || 'Яндекс Музыка', artist: y.artist, cover: y.cover, playing: y.playing, position: y.position, duration: y.duration };
    }
    if (this.item) {
      return { source: this.item.type === 'radio' ? 'Радио' : 'Мои файлы', kind: 'builtin', title: this.item.title, artist: this.item.artist, cover: this.item.cover, playing: false, position: player.currentTime, duration: Number.isFinite(player.duration) ? player.duration : 0, live: this.item.type === 'radio' };
    }
    return null;
  },

  ymView() {
    const y = this.ym;
    if (!y) return null;
    return { source: 'Яндекс Музыка', kind: 'yandex', title: y.title || 'Ничего не играет', artist: y.title ? y.artist : 'Включите трек или «Мою волну»', cover: y.cover, playing: y.playing, position: y.position, duration: y.duration };
  },

  // ---- команды ----
  playPause(kind) {
    const k = kind || (this.nowPlaying() || {}).kind || 'yandex';
    if (k === 'yandex') {
      atoll.ym.cmd('playpause');
      if (this.ym && !this.ym.playing && !player.paused) player.pause();
    } else if (this.item) {
      if (player.paused) this.resumeBuiltin(); else player.pause();
    }
  },
  next(kind) {
    const k = kind || (this.nowPlaying() || {}).kind;
    if (k === 'yandex') atoll.ym.cmd('next'); else this.step(1);
  },
  prev(kind) {
    const k = kind || (this.nowPlaying() || {}).kind;
    if (k === 'yandex') atoll.ym.cmd('prev');
    else if (player.currentTime > 4 && this.item && this.item.type === 'local') player.currentTime = 0;
    else this.step(-1);
  },
  seek(kind, frac) {
    if (kind === 'yandex' && this.ym && this.ym.duration) atoll.ym.cmd('seek', frac * this.ym.duration);
    else if (Number.isFinite(player.duration)) player.currentTime = frac * player.duration;
  },

  // ---- встроенный плеер ----
  playQueue(queue, index) {
    this.queue = queue;
    this.index = index;
    this.load(queue[index]);
  },
  load(item) {
    if (!item) return;
    this.item = item;
    Viz.attachElement();
    player.src = item.url;
    this.resumeBuiltin();
    refreshMusicViews(true);
  },
  resumeBuiltin() {
    this.active = 'builtin';
    if (this.ym && this.ym.playing) atoll.ym.cmd('pause');
    Viz.audioCtx();
    player.volume = S.volume;
    player.play().catch((e) => {
      if (e && e.name === 'AbortError') return;
      showAlert({ emoji: '⚠️', title: 'Не получилось включить', sub: this.item ? this.item.title : '', duration: 3500 });
    });
  },
  step(dir) {
    if (!this.queue.length) return;
    let i;
    if (S.shuffle && this.item && this.item.type === 'local' && this.queue.length > 1) {
      do { i = Math.floor(Math.random() * this.queue.length); } while (i === this.index);
    } else {
      i = this.index + dir;
      if (i >= this.queue.length) i = (S.repeat === 'all' || this.item.type === 'radio') ? 0 : -1;
      if (i < 0) i = dir < 0 ? this.queue.length - 1 : -1;
    }
    if (i < 0) { player.pause(); return; }
    this.index = i;
    this.load(this.queue[i]);
  },
};

player.addEventListener('ended', () => {
  if (S.repeat === 'one') { player.currentTime = 0; player.play(); } else Music.step(1);
});
player.addEventListener('play', () => { Music.active = 'builtin'; refreshMusicViews(); });
player.addEventListener('pause', () => refreshMusicViews());
player.addEventListener('error', () => {
  if (!Music.item) return;
  showAlert({ emoji: '⚠️', title: 'Не удалось воспроизвести', sub: Music.item.title, duration: 3500 });
});

atoll.ym.onState((st) => {
  const wasPlaying = Music.ym && Music.ym.playing;
  Music.ym = st;
  Music.ymError = '';
  if (st && st.playing && !wasPlaying) {
    Music.active = 'yandex';
    if (!player.paused) player.pause();
  }
  refreshMusicViews();
});
atoll.ym.onError((msg) => { Music.ymError = msg; refreshMusicViews(true); });

// Цвет свечения по обложке
let lastCoverForGlow = '';
function updateGlow(cover) {
  if (!S.settings.coverGlow || !cover) {
    islandEl.style.setProperty('--glow', hexToRgb(S.settings.accent));
    islandEl.classList.toggle('glow', false);
    lastCoverForGlow = '';
    return;
  }
  if (cover === lastCoverForGlow) return;
  lastCoverForGlow = cover;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 16;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0, 16, 16);
      const d = x.getImageData(0, 0, 16, 16).data;
      let best = null;
      let bestScore = -1;
      let r = 0; let g = 0; let b = 0;
      for (let i = 0; i < d.length; i += 4) {
        const mx = Math.max(d[i], d[i + 1], d[i + 2]);
        const mn = Math.min(d[i], d[i + 1], d[i + 2]);
        const score = (mx - mn) * (mx / 255);
        r += d[i]; g += d[i + 1]; b += d[i + 2];
        if (score > bestScore) { bestScore = score; best = [d[i], d[i + 1], d[i + 2]]; }
      }
      const n = d.length / 4;
      let col = bestScore > 40 ? best : [r / n, g / n, b / n];
      const mx = Math.max(...col) || 1;
      if (mx < 170) col = col.map((v) => v * (170 / mx));        // осветляем тёмные обложки
      islandEl.style.setProperty('--glow', col.map((v) => Math.round(clamp(v, 0, 255))).join(', '));
      islandEl.classList.add('glow');
    } catch (e) { /* ignore */ }
  };
  img.src = cover;
}
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : '255, 178, 56';
}

// ---- Карточка «Сейчас играет» ----
function npCard(container, view, opts = {}) {
  if (!container) return;
  const key = view ? `${view.kind}|${view.title}|${view.artist}|${view.cover}|${!!view.live}` : 'empty';
  if (container.dataset.key !== key) {
    container.dataset.key = key;
    if (!view) {
      container.innerHTML = `
        <div class="np-top">
          <div class="np-cover">${icon('music')}</div>
          <div class="np-info">
            <div class="np-src">Музыка</div>
            <div class="np-title">Ничего не играет</div>
            <div class="np-artist">Откройте Яндекс Музыку, радио или свою папку</div>
          </div>
        </div>
        <div class="np-actions">
          <button class="btn" data-act="open-ym">${icon('external')}Яндекс Музыка</button>
          <button class="btn" data-act="goto-radio">${icon('radio')}Радио</button>
          <button class="btn" data-act="goto-local">${icon('folder')}Мои файлы</button>
        </div>`;
      return;
    }
    const cover = view.cover ? `style="background-image:url('${esc(view.cover)}')"` : '';
    container.innerHTML = `
      <div class="np-top">
        <div class="np-cover" ${cover}>${view.cover ? '' : icon(view.live ? 'radio' : 'music')}</div>
        <div class="np-info">
          <div class="np-src">${esc(view.source)}</div>
          <div class="np-title">${esc(view.title)}</div>
          <div class="np-artist">${esc(view.artist || '')}</div>
        </div>
      </div>
      <div class="np-progress">
        <span class="cur"></span>
        <div class="bar" data-act="seek" data-kind="${view.kind}"><i></i></div>
        <span class="dur"></span>
      </div>
      <div class="np-controls">
        ${view.kind === 'yandex' ? `<button class="icon-btn" data-act="like" title="Нравится">${icon('heart')}</button>` : `<span style="width:38px"></span>`}
        <button class="icon-btn" data-act="prev" data-kind="${view.kind}" title="Назад">${icon('prev')}</button>
        <button class="main" data-act="playpause" data-kind="${view.kind}" title="Пауза / играть"></button>
        <button class="icon-btn" data-act="next" data-kind="${view.kind}" title="Дальше">${icon('next')}</button>
        ${view.kind === 'yandex' ? `<button class="icon-btn" data-act="open-ym" title="Открыть окно Яндекс Музыки">${icon('external')}</button>` : `<span style="width:38px"></span>`}
      </div>
      ${opts.volume && view.kind === 'builtin' ? `<div class="vol">${icon('music')}<input type="range" min="0" max="1" step="0.01" value="${S.volume}" data-act="volume"></div>` : ''}`;
  }
  if (!view) return;
  const main = container.querySelector('.main');
  const want = view.playing ? 'pause' : 'play';
  if (main && main.dataset.icon !== want) { main.dataset.icon = want; main.innerHTML = icon(want); }
  const cur = container.querySelector('.cur');
  const dur = container.querySelector('.dur');
  const bar = container.querySelector('.bar i');
  if (view.live) {
    cur.textContent = '';
    dur.textContent = 'В ЭФИРЕ';
    bar.style.width = '100%';
  } else {
    cur.textContent = fmtDur(view.position);
    dur.textContent = view.duration ? fmtDur(view.duration) : '';
    bar.style.width = (view.duration ? clamp(view.position / view.duration, 0, 1) * 100 : 0) + '%';
  }
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'INPUT') return;
  const kind = el.dataset.kind;
  switch (el.dataset.act) {
    case 'playpause': Music.playPause(kind); break;
    case 'next': Music.next(kind); break;
    case 'prev': Music.prev(kind); break;
    case 'like': atoll.ym.cmd('like'); break;
    case 'open-ym': atoll.ym.open(); break;
    case 'goto-radio': UI.tab = 'music'; Music.src = 'radio'; renderTab(); break;
    case 'goto-local': UI.tab = 'music'; Music.src = 'local'; renderTab(); break;
    case 'goto-weather': UI.tab = 'weather'; renderTab(); break;
    case 'goto-timer': UI.tab = 'timer'; renderTab(); break;
    case 'seek': {
      const r = el.getBoundingClientRect();
      Music.seek(kind, clamp((e.clientX - r.left) / r.width, 0, 1));
      break;
    }
    default:
  }
});
document.addEventListener('input', (e) => {
  if (e.target.dataset.act === 'volume') {
    S.volume = Number(e.target.value);
    player.volume = S.volume;
    save('volume');
  }
});

function refreshMusicViews(force) {
  const np = Music.nowPlaying();
  // Капсула
  const hasMusic = !!(np && (np.playing || np.title));
  islandEl.classList.toggle('has-music', !!(np && np.playing));
  const pc = $('#pillCover');
  if (np && np.playing && np.cover) { if (pc.getAttribute('src') !== np.cover) pc.src = np.cover; pc.style.display = ''; }
  else if (np && np.playing) { pc.removeAttribute('src'); pc.style.display = 'none'; }
  updateGlow(np && np.playing ? np.cover : '');

  // Уведомление о новом треке
  const key = np && np.playing ? `${np.kind}|${np.title}|${np.artist}` : '';
  if (key && key !== Music.lastKey && Music.lastKey !== '' && S.settings.trackToast && UI.mode === 'collapsed') {
    showAlert({ img: np.cover, emoji: '🎵', title: np.title, sub: np.artist || np.source, duration: 3200 });
  }
  if (key) Music.lastKey = key;
  else if (!hasMusic) Music.lastKey = '';

  if (UI.mode === 'collapsed') applySize();
  if (UI.mode !== 'expanded') return;
  if (UI.tab === 'home') npCard($('#homeNp'), np, { volume: true });
  if (UI.tab === 'music') {
    if (Music.src === 'yandex') renderYandexPane(force);
    else {
      const pane = $(`.music-pane[data-pane="${Music.src}"]`);
      $$('.row', pane).forEach((r) => r.classList.toggle('playing', !!Music.item && r.dataset.url === Music.item.url));
    }
  }
}

// ---- Раздел «Музыка» ----
$$('#musicSeg button').forEach((b) => b.addEventListener('click', () => { Music.src = b.dataset.src; renderMusic(); }));

function renderMusic() {
  $$('#musicSeg button').forEach((b) => b.classList.toggle('active', b.dataset.src === Music.src));
  $$('.music-pane').forEach((p) => p.classList.toggle('active', p.dataset.pane === Music.src));
  if (Music.src === 'yandex') renderYandexPane(true);
  if (Music.src === 'radio') renderRadio();
  if (Music.src === 'local') renderLocal();
}

function renderYandexPane(force) {
  const pane = $('#paneYandex');
  if (force || !$('.ym-grid', pane)) {
    pane.innerHTML = `
      <div class="ym-grid">
        <div class="card np" id="ymNp"></div>
        <div class="card ym-help">
          <div class="h3"><span class="status-dot" id="ymDot"></span><span id="ymStatus"></span></div>
          <ol>
            <li>Нажмите «Открыть Яндекс Музыку» и один раз войдите в свой аккаунт Яндекса.</li>
            <li>Включите любой трек, плейлист или «Мою волну».</li>
            <li>Закройте окно — музыка продолжит играть, а управлять ею можно отсюда и из капсулы.</li>
          </ol>
          <div class="hint">Работает с бесплатным аккаунтом и с Плюсом. Это официальный сайт music.yandex.ru внутри приложения — VPN не нужен.</div>
          <button class="btn accent" data-act="open-ym">${icon('external')}Открыть Яндекс Музыку</button>
        </div>
      </div>`;
  }
  const y = Music.ym;
  $('#ymDot', pane).classList.toggle('ok', !!y);
  $('#ymStatus', pane).textContent = Music.ymError ? `Нет связи: ${Music.ymError}` : y ? (y.title ? 'Подключено' : 'Подключено — ничего не играет') : 'Загружается…';
  npCard($('#ymNp', pane), Music.ymView() || { source: 'Яндекс Музыка', kind: 'yandex', title: 'Ещё не открыта', artist: 'Нажмите «Открыть Яндекс Музыку»', playing: false, position: 0, duration: 0 });
}

// Радио
async function rbFetch(pathQ) {
  let lastErr;
  for (const host of RB_HOSTS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 7000);
      const r = await fetch(host + pathQ, { signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) return await r.json();
      lastErr = new Error('HTTP ' + r.status);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('нет связи');
}
function stationToItem(s) {
  return {
    type: 'radio',
    id: s.stationuuid,
    url: s.url_resolved || s.url,
    title: (s.name || 'Радио').trim(),
    artist: [s.country, (s.tags || '').split(',').slice(0, 2).join(', ')].filter(Boolean).join(' · '),
    cover: s.favicon || '',
    bitrate: s.bitrate,
  };
}
let radioReq = 0;
async function loadRadio(pathQ) {
  const my = ++radioReq;
  $('#radioList').innerHTML = '<div class="empty">Загрузка…</div>';
  try {
    const list = await rbFetch(pathQ);
    if (my !== radioReq) return;
    const seen = new Set();
    Music.radioResults = list
      .filter((s) => !s.hls && (s.url_resolved || s.url) && !seen.has(s.name) && seen.add(s.name))
      .map(stationToItem);
    drawRadioList();
  } catch (e) {
    if (my !== radioReq) return;
    $('#radioList').innerHTML = '<div class="empty">Не удалось загрузить список станций. Проверьте интернет.</div>';
  }
}
function drawRadioList() {
  const items = Music.radioChip === 'fav' && !$('#radioSearch').value.trim() ? S.radioFavs : Music.radioResults;
  if (!items.length) {
    $('#radioList').innerHTML = `<div class="empty">${Music.radioChip === 'fav' ? 'Нажмите ★ у станции, чтобы добавить её сюда' : 'Ничего не нашлось'}</div>`;
    return;
  }
  const favIds = new Set(S.radioFavs.map((f) => f.id));
  $('#radioList').innerHTML = items.map((s, i) => `
    <div class="row ${Music.item && Music.item.url === s.url ? 'playing' : ''}" data-i="${i}" data-url="${esc(s.url)}">
      <div class="thumb" ${s.cover ? `style="background-image:url('${esc(s.cover)}')"` : ''}>${s.cover ? '' : icon('radio')}</div>
      <div class="meta"><div class="t1">${esc(s.title)}</div><div class="t2">${esc(s.artist)}${s.bitrate ? ' · ' + s.bitrate + ' кбит/с' : ''}</div></div>
      <button class="icon-btn star ${favIds.has(s.id) ? 'on' : ''}" data-fav="${i}" title="В избранное">${icon('star')}</button>
    </div>`).join('');
  $('#radioList').onclick = (e) => {
    const fav = e.target.closest('[data-fav]');
    if (fav) {
      const s = items[Number(fav.dataset.fav)];
      const idx = S.radioFavs.findIndex((f) => f.id === s.id);
      if (idx >= 0) S.radioFavs.splice(idx, 1); else S.radioFavs.unshift(s);
      save('radioFavs');
      drawRadioList();
      return;
    }
    const row = e.target.closest('.row');
    if (row) Music.playQueue(items.slice(), Number(row.dataset.i));
  };
}
function renderRadio() {
  const chips = $('#radioChips');
  chips.innerHTML = RADIO_CHIPS.map((c) => `<button class="chip ${c.id === Music.radioChip ? 'active' : ''}" data-chip="${c.id}">${esc(c.label)}</button>`).join('');
  chips.onclick = (e) => {
    const b = e.target.closest('[data-chip]');
    if (!b) return;
    Music.radioChip = b.dataset.chip;
    $('#radioSearch').value = '';
    renderRadio();
  };
  const chip = RADIO_CHIPS.find((c) => c.id === Music.radioChip);
  if (chip && chip.path) loadRadio(chip.path); else drawRadioList();
}
let radioSearchT = null;
$('#radioSearch').addEventListener('input', (e) => {
  clearTimeout(radioSearchT);
  const q = e.target.value.trim();
  radioSearchT = setTimeout(() => {
    if (q.length < 2) { renderRadio(); return; }
    $$('#radioChips .chip').forEach((c) => c.classList.remove('active'));
    loadRadio(`/json/stations/search?name=${encodeURIComponent(q)}&order=clickcount&reverse=true&limit=60&hidebroken=true`);
  }, 350);
});

// Свои файлы
function trackToItem(t) {
  const parts = t.name.split(' - ');
  const artist = parts.length > 1 ? parts.shift().trim() : t.folder;
  return { type: 'local', id: t.url, url: t.url, title: parts.join(' - ').trim(), artist, cover: '' };
}
function renderLocal() {
  $('#folderName').textContent = S.localFolder ? `Папка: ${S.localFolder} · ${Music.localTracks.length} треков` : '';
  $('#shuffleBtn').classList.toggle('on', S.shuffle);
  $('#repeatBtn').classList.toggle('on', S.repeat !== 'off');
  $('#repeatBtn').title = { off: 'Повтор выключен', all: 'Повтор всех', one: 'Повтор трека' }[S.repeat];
  const q = $('#localSearch').value.trim().toLowerCase();
  const items = Music.localTracks.filter((t) => !q || (t.title + ' ' + t.artist).toLowerCase().includes(q));
  if (!S.localFolder) {
    $('#localList').innerHTML = '<div class="empty">Выберите папку с MP3, FLAC, M4A или OGG — треки появятся здесь</div>';
    return;
  }
  if (!items.length) { $('#localList').innerHTML = '<div class="empty">Треков не найдено</div>'; return; }
  $('#localList').innerHTML = items.slice(0, 1500).map((t, i) => `
    <div class="row ${Music.item && Music.item.url === t.url ? 'playing' : ''}" data-i="${i}" data-url="${esc(t.url)}">
      <div class="thumb">${icon('music')}</div>
      <div class="meta"><div class="t1">${esc(t.title)}</div><div class="t2">${esc(t.artist)}</div></div>
    </div>`).join('');
  $('#localList').onclick = (e) => {
    const row = e.target.closest('.row');
    if (row) Music.playQueue(items.slice(), Number(row.dataset.i));
  };
}
$('#localSearch').addEventListener('input', renderLocal);
$('#pickFolder').addEventListener('click', async () => {
  const r = await atoll.pickFolder();
  if (!r) return;
  S.localFolder = r.folder;
  save('localFolder');
  Music.localTracks = r.tracks.map(trackToItem);
  renderLocal();
});
$('#shuffleBtn').addEventListener('click', () => { S.shuffle = !S.shuffle; save('shuffle'); renderLocal(); });
$('#repeatBtn').addEventListener('click', () => {
  S.repeat = { off: 'all', all: 'one', one: 'off' }[S.repeat] || 'off';
  save('repeat');
  renderLocal();
});

// ==================== Погода ====================
const W = { data: null, error: '', loading: false };
async function loadWeather() {
  const c = S.settings.city;
  if (!c) return;
  W.loading = true;
  try {
    W.data = await Weather.forecast(c.lat, c.lon);
    W.error = '';
    atoll.set('weatherCache', { at: Date.now(), city: c.name, data: W.data });
  } catch (e) {
    W.error = 'Нет связи с сервером погоды';
  }
  W.loading = false;
  renderWeatherBits();
}
function renderWeatherBits() {
  const d = W.data;
  if (d && d.current) {
    const cur = Weather.describe(d.current.weather_code, d.current.is_day);
    $('#pillWeather').textContent = `${cur.icon} ${Math.round(d.current.temperature_2m)}°`;
  } else {
    $('#pillWeather').textContent = '';
  }
  if (UI.mode === 'collapsed') applySize();
  if (UI.mode === 'expanded' && UI.tab === 'home') renderHomeWeather();
  if (UI.mode === 'expanded' && UI.tab === 'weather') renderWeatherPage();
}
function renderHomeWeather() {
  const box = $('#homeWeather');
  const d = W.data;
  box.dataset.act = 'goto-weather';
  if (!d || !d.current) { box.innerHTML = `<div class="muted">${W.error || 'Загружаем погоду…'}</div>`; return; }
  const cur = Weather.describe(d.current.weather_code, d.current.is_day);
  box.innerHTML = `
    <div class="ico">${cur.icon}</div>
    <div style="flex:1;min-width:0">
      <div class="muted" style="font-weight:600">${esc(S.settings.city.name)}</div>
      <div>${esc(cur.text)}</div>
      <div class="hint">Ощущается как ${Math.round(d.current.apparent_temperature)}° · ${Math.round(d.daily.temperature_2m_min[0])}…${Math.round(d.daily.temperature_2m_max[0])}°</div>
    </div>
    <div class="big">${Math.round(d.current.temperature_2m)}°</div>`;
}
function renderWeatherPage() {
  const box = $('#weatherPage');
  const d = W.data;
  if (!d || !d.current) {
    box.innerHTML = `<div class="w-err">${W.error || 'Загружаем погоду…'}<br><br><button class="btn" id="wRetry">Обновить</button></div>`;
    const b = $('#wRetry'); if (b) b.onclick = loadWeather;
    return;
  }
  const c = d.current;
  const cur = Weather.describe(c.weather_code, c.is_day);
  const nowIdx = Math.max(0, d.hourly.time.findIndex((t) => new Date(t) >= new Date(Date.now() - 3600e3)));
  const hours = d.hourly.time.slice(nowIdx, nowIdx + 24).map((t, k) => {
    const i = nowIdx + k;
    const w = Weather.describe(d.hourly.weather_code[i], d.hourly.is_day[i]);
    return `<div class="w-hour"><div class="tm">${k === 0 ? 'Сейчас' : t.slice(11, 16)}</div><div class="e">${w.icon}</div><div>${Math.round(d.hourly.temperature_2m[i])}°</div></div>`;
  }).join('');
  const days = d.daily.time.map((t, i) => {
    const w = Weather.describe(d.daily.weather_code[i], 1);
    const name = i === 0 ? 'Сегодня' : new Date(t + 'T12:00').toLocaleDateString('ru-RU', { weekday: 'short' });
    return `<div class="w-day"><div class="d">${name}</div><div class="e">${w.icon}</div><div><b>${Math.round(d.daily.temperature_2m_max[i])}°</b> <span class="muted">${Math.round(d.daily.temperature_2m_min[i])}°</span></div></div>`;
  }).join('');
  const mm = Math.round(c.pressure_msl * 0.750062);
  const sunrise = (d.daily.sunrise[0] || '').slice(11, 16);
  const sunset = (d.daily.sunset[0] || '').slice(11, 16);
  box.innerHTML = `
    <div class="card w-now">
      <div class="w-city">📍 ${esc(S.settings.city.name)}</div>
      <div class="hint">${esc(S.settings.city.region || '')}</div>
      <div style="display:flex;align-items:center;gap:10px"><div class="w-temp">${Math.round(c.temperature_2m)}°</div><div class="w-ico">${cur.icon}</div></div>
      <div class="w-desc">${esc(cur.text)}</div>
      <div class="muted">Ощущается как ${Math.round(c.apparent_temperature)}°</div>
      <div class="muted">Днём ${Math.round(d.daily.temperature_2m_max[0])}°, ночью ${Math.round(d.daily.temperature_2m_min[0])}°</div>
      <div style="flex:1"></div>
      <button class="btn ghost" id="wCity">Сменить город</button>
    </div>
    <div class="w-right">
      <div class="card w-hours">${hours}</div>
      <div class="w-tiles">
        <div class="w-tile"><div class="k">Ветер</div><div class="v"><span class="compass"><i style="transform:rotate(${(c.wind_direction_10m + 180) % 360}deg)"></i></span>${Math.round(c.wind_speed_10m)} м/с</div><div class="s">${Weather.windDir(c.wind_direction_10m)}, порывы ${Math.round(c.wind_gusts_10m)}</div></div>
        <div class="w-tile"><div class="k">Влажность</div><div class="v">${Math.round(c.relative_humidity_2m)}%</div><div class="s">Осадки ${d.daily.precipitation_sum[0]} мм за сутки</div></div>
        <div class="w-tile"><div class="k">Давление</div><div class="v">${mm}</div><div class="s">мм рт. ст.</div></div>
        <div class="w-tile"><div class="k">Солнце</div><div class="v" style="font-size:13px;white-space:nowrap">↑ ${sunrise} ↓ ${sunset}</div><div class="s">УФ-индекс ${Math.round(d.daily.uv_index_max[0] || 0)}</div></div>
      </div>
      <div class="w-days">${days}</div>
    </div>`;
  $('#wCity').onclick = () => { UI.tab = 'settings'; renderTab(); setTimeout(() => { const i = $('#cityInput'); if (i) i.focus(); }, 50); };
}

// ==================== Заметки ====================
const N = { mode: 'notes', sel: null };
$$('#notesSeg button').forEach((b) => b.addEventListener('click', () => { N.mode = b.dataset.mode; renderNotes(); }));
$('#addNote').addEventListener('click', () => {
  const n = { id: uid(), title: 'Новая заметка', text: '', updated: Date.now() };
  S.notes.unshift(n);
  N.sel = n.id;
  save('notes');
  renderNotes();
  setTimeout(() => { const t = $('#notesMain textarea'); if (t) t.focus(); }, 30);
});
function renderNotes() {
  $$('#notesSeg button').forEach((b) => b.classList.toggle('active', b.dataset.mode === N.mode));
  const list = $('#notesList');
  const main = $('#notesMain');
  $('#addNote').style.display = N.mode === 'notes' ? '' : 'none';
  if (N.mode === 'tasks') {
    const open = S.tasks.filter((t) => !t.done).length;
    list.innerHTML = `<div class="empty" style="padding:16px 6px">Открыто задач: ${open}<br>Выполнено: ${S.tasks.length - open}</div>`;
    main.innerHTML = `
      <div class="search-row" style="margin-bottom:6px"><input id="taskInput" type="text" placeholder="Новая задача и Enter"></div>
      <div class="list" id="taskList"></div>
      <div class="foot"><span></span><button class="btn ghost" id="clearDone" style="height:26px">Убрать выполненные</button></div>`;
    const draw = () => {
      $('#taskList').innerHTML = S.tasks.length ? S.tasks.map((t) => `
        <div class="task ${t.done ? 'done' : ''}" data-id="${t.id}">
          <button class="box" data-t="toggle">${icon('check')}</button>
          <div class="txt">${esc(t.text)}</div>
          <button class="icon-btn del" data-t="del">${icon('x')}</button>
        </div>`).join('') : '<div class="empty">Задач пока нет</div>';
    };
    draw();
    $('#taskInput').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !e.target.value.trim()) return;
      S.tasks.unshift({ id: uid(), text: e.target.value.trim(), done: false });
      e.target.value = '';
      save('tasks');
      draw();
    });
    $('#taskList').onclick = (e) => {
      const b = e.target.closest('[data-t]');
      if (!b) return;
      const id = b.closest('.task').dataset.id;
      const i = S.tasks.findIndex((t) => t.id === id);
      if (i < 0) return;
      if (b.dataset.t === 'toggle') S.tasks[i].done = !S.tasks[i].done; else S.tasks.splice(i, 1);
      save('tasks');
      draw();
    };
    $('#clearDone').onclick = () => { S.tasks = S.tasks.filter((t) => !t.done); save('tasks'); draw(); };
    return;
  }
  if (!S.notes.length) S.notes.push({ id: uid(), title: 'Заметка', text: '', updated: Date.now() });
  if (!S.notes.find((n) => n.id === N.sel)) N.sel = S.notes[0].id;
  list.innerHTML = S.notes.map((n) => `
    <div class="row ${n.id === N.sel ? 'playing' : ''}" data-id="${n.id}">
      <div class="meta"><div class="t1">${esc(n.title || 'Без названия')}</div><div class="t2">${esc((n.text || '').split('\n')[0] || 'Пусто')}</div></div>
    </div>`).join('');
  list.onclick = (e) => { const r = e.target.closest('.row'); if (r) { N.sel = r.dataset.id; renderNotes(); } };
  const note = S.notes.find((n) => n.id === N.sel);
  main.innerHTML = `
    <input class="title-input" id="noteTitle" type="text" value="${esc(note.title)}" placeholder="Название">
    <textarea id="noteText" placeholder="Пишите здесь — всё сохраняется само">${esc(note.text)}</textarea>
    <div class="foot"><span id="noteSaved">Изменено ${new Date(note.updated).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
    <button class="btn ghost" id="delNote" style="height:26px">Удалить</button></div>`;
  const upd = () => {
    note.title = $('#noteTitle').value;
    note.text = $('#noteText').value;
    note.updated = Date.now();
    save('notes');
    const row = $(`#notesList .row[data-id="${note.id}"]`);
    if (row) {
      row.querySelector('.t1').textContent = note.title || 'Без названия';
      row.querySelector('.t2').textContent = note.text.split('\n')[0] || 'Пусто';
    }
  };
  $('#noteTitle').addEventListener('input', upd);
  $('#noteText').addEventListener('input', upd);
  $('#delNote').onclick = () => {
    S.notes = S.notes.filter((n) => n.id !== note.id);
    save('notes');
    renderNotes();
  };
}

// ==================== Таймер и напоминания ====================
const PRESETS = [1, 3, 5, 10, 15, 25, 45, 60];
function timerRemaining() {
  const t = S.timer;
  return t.running ? Math.max(0, (t.endAt - Date.now()) / 1000) : t.remaining;
}
function timerStartPause() {
  const t = S.timer;
  if (t.running) { t.remaining = timerRemaining(); t.running = false; }
  else {
    if (t.remaining <= 0) t.remaining = t.total;
    t.endAt = Date.now() + t.remaining * 1000;
    t.running = true;
    Viz.audioCtx();
  }
  save('timer');
  renderTimerBits();
}
function timerSet(min) {
  S.timer = { total: min * 60, remaining: min * 60, running: false, endAt: 0 };
  save('timer');
  renderTimerBits();
}
function timerDone() {
  const total = S.timer.total;
  S.timer.running = false;
  S.timer.remaining = 0;
  save('timer');
  chime(3);
  atoll.notify('Время вышло', `Таймер · ${fmtDur(total)}`);
  showAlert({
    emoji: '⏰',
    title: 'Время вышло',
    sub: `Таймер · ${Math.round(total / 60)} мин`,
    shake: true,
    actions: [
      { label: 'Ещё раз', fn: () => { timerSet(total / 60); timerStartPause(); } },
      { primary: true, fn: () => { S.timer.remaining = S.timer.total; save('timer'); renderTimerBits(); } },
    ],
  });
}
function renderTimerBits() {
  const t = S.timer;
  const rem = timerRemaining();
  const running = t.running;
  islandEl.classList.toggle('has-timer', running || (rem > 0 && rem < t.total));
  $('#pillTimer').textContent = '⏱ ' + fmtDur(Math.ceil(rem));
  if (UI.mode === 'collapsed') applySize();
  if (UI.mode !== 'expanded') return;
  if (UI.tab === 'timer') {
    $('#ringTime').textContent = fmtDur(Math.ceil(rem));
    $('#ringFg').style.strokeDashoffset = String(326.7 * (1 - (t.total ? rem / t.total : 0)));
    $('#timerStart').textContent = running ? 'Пауза' : (rem < t.total && rem > 0 ? 'Продолжить' : 'Старт');
  }
  if (UI.tab === 'home') {
    const box = $('#homeTimer');
    if (!box.firstChild) {
      box.innerHTML = `<div style="font-size:22px">⏱</div><div class="tm" data-act="goto-timer" style="cursor:pointer"></div>
        <button class="btn accent" id="hTimerBtn" style="height:30px"></button>`;
      $('#hTimerBtn').onclick = timerStartPause;
    }
    box.querySelector('.tm').textContent = fmtDur(Math.ceil(rem));
    $('#hTimerBtn').textContent = running ? 'Пауза' : 'Старт';
  }
}
function renderTimerPage() {
  $('#timerPresets').innerHTML = PRESETS.map((m) => `<button class="chip ${S.timer.total === m * 60 ? 'active' : ''}" data-min="${m}">${m} мин</button>`).join('');
  $('#timerPresets').onclick = (e) => { const b = e.target.closest('[data-min]'); if (b) { timerSet(Number(b.dataset.min)); renderTimerPage(); } };
  renderTimerBits();
  renderReminders();
}
$('#timerStart').addEventListener('click', timerStartPause);
$('#timerReset').addEventListener('click', () => timerSet(S.timer.total / 60));
$('#timerCustomSet').addEventListener('click', () => {
  const v = Number($('#timerCustom').value);
  if (v > 0 && v <= 600) { timerSet(v); renderTimerPage(); $('#timerCustom').value = ''; }
});

function parseReminder(text, time) {
  let at = null;
  let msg = text.trim();
  if (time) {
    const [h, m] = time.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    at = d.getTime();
  } else {
    const r = /через\s+(\d+)\s*(минут[уы]?|мин|час(?:а|ов)?|ч)\b\s*/i.exec(msg);
    if (r) {
      const n = Number(r[1]);
      at = Date.now() + n * (/^ч|^час/i.test(r[2]) ? 3600e3 : 60e3);
      msg = (msg.slice(0, r.index) + msg.slice(r.index + r[0].length)).trim();
    }
  }
  return at ? { id: uid(), text: msg || 'Напоминание', at, done: false } : null;
}
function addReminder() {
  const rem = parseReminder($('#remText').value, $('#remTime').value);
  if (!rem) {
    showAlert({ emoji: '🕑', title: 'Укажите время', sub: 'Выберите время или напишите «через 15 минут …»', duration: 3000 });
    return;
  }
  S.reminders.push(rem);
  S.reminders.sort((a, b) => a.at - b.at);
  save('reminders');
  $('#remText').value = '';
  $('#remTime').value = '';
  renderReminders();
}
$('#remAdd').addEventListener('click', addReminder);
$('#remText').addEventListener('keydown', (e) => { if (e.key === 'Enter') addReminder(); });
function renderReminders() {
  const list = $('#remList');
  if (!S.reminders.length) { list.innerHTML = '<div class="empty">Напоминаний нет</div>'; return; }
  list.innerHTML = S.reminders.map((r) => {
    const d = new Date(r.at);
    const today = new Date().toDateString() === d.toDateString();
    return `<div class="task ${r.done ? 'done' : ''}" data-id="${r.id}">
      <div class="box">${icon('check')}</div>
      <div class="txt">${esc(r.text)}</div>
      <span class="muted">${today ? '' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ', '}${hhmm(d)}</span>
      <button class="icon-btn del" data-del="1">${icon('x')}</button>
    </div>`;
  }).join('');
  list.onclick = (e) => {
    if (!e.target.closest('[data-del]')) return;
    const id = e.target.closest('.task').dataset.id;
    S.reminders = S.reminders.filter((r) => r.id !== id);
    save('reminders');
    renderReminders();
  };
}
function checkReminders() {
  const now = Date.now();
  let changed = false;
  S.reminders.forEach((r) => {
    if (!r.done && r.at <= now) {
      r.done = true;
      changed = true;
      chime(2);
      atoll.notify('Напоминание', r.text);
      showAlert({ emoji: '🔔', title: r.text, sub: `Напоминание · ${hhmm(new Date(r.at))}`, shake: true, actions: [{ primary: true }] });
    }
  });
  // Выполненные старше суток убираем
  const before = S.reminders.length;
  S.reminders = S.reminders.filter((r) => !r.done || now - r.at < 86400e3);
  if (changed || before !== S.reminders.length) {
    save('reminders');
    if (UI.mode === 'expanded' && UI.tab === 'timer') renderReminders();
  }
}

// ==================== Главная ====================
function renderHome() {
  npCard($('#homeNp'), Music.nowPlaying(), { volume: true });
  renderHomeWeather();
  $('#homeTimer').innerHTML = '';
  renderTimerBits();
  const nb = $('#homeNote');
  nb.innerHTML = `<div class="h3" style="margin-bottom:4px">Быстрая заметка</div><textarea id="quickNote" placeholder="Запишите мысль…">${esc(S.quickNote)}</textarea>`;
  $('#quickNote').addEventListener('input', (e) => { S.quickNote = e.target.value; save('quickNote'); });
}

// ==================== Настройки ====================
const ACCENTS = ['#ffb238', '#ff6b8b', '#4da3ff', '#3ad37a', '#a78bfa', '#ff7a45'];
function applyTheme() {
  document.documentElement.dataset.theme = S.settings.theme;
  document.documentElement.style.setProperty('--accent', S.settings.accent);
  if (!islandEl.classList.contains('glow')) islandEl.style.setProperty('--glow', hexToRgb(S.settings.accent));
  setTimeout(() => Viz.resize(), 50);
}
function setSetting(k, v) {
  S.settings[k] = v;
  save('settings');
}
async function renderSettings() {
  const st = S.settings;
  const auto = await atoll.getAutostart();
  const tog = (k, on) => `<button class="toggle ${on ? 'on' : ''}" data-set="${k}"></button>`;
  $('#settingsPage').innerHTML = `
    <div class="set-row" style="flex-direction:column;align-items:stretch">
      <div class="lbl"><b>Город для погоды</b><small>Сейчас: ${esc(st.city.name)}${st.city.region ? ', ' + esc(st.city.region) : ''}</small></div>
      <input id="cityInput" type="search" placeholder="Начните вводить название города">
      <div class="city-results" id="cityResults"></div>
    </div>
    <div class="set-row"><div class="lbl"><b>Тема</b><small>Тёмная или светлая</small></div>
      <div class="seg small" id="themeSeg"><button data-theme="dark" class="${st.theme === 'dark' ? 'active' : ''}">Тёмная</button><button data-theme="light" class="${st.theme === 'light' ? 'active' : ''}">Светлая</button></div></div>
    <div class="set-row"><div class="lbl"><b>Акцентный цвет</b><small>Кнопки, таймер, подсветка</small></div>
      <div class="swatches">${ACCENTS.map((c) => `<button class="swatch ${c === st.accent ? 'on' : ''}" data-accent="${c}" style="background:${c}"></button>`).join('')}</div></div>
    <div class="set-row"><div class="lbl"><b>Край танцует под музыку</b><small>Волна снизу острова в ритм звука</small></div>${tog('visualizer', st.visualizer)}</div>
    <div class="set-row"><div class="lbl"><b>Подсветка цветом обложки</b><small>Остров светится цветом текущего трека</small></div>${tog('coverGlow', st.coverGlow)}</div>
    <div class="set-row"><div class="lbl"><b>Показывать смену трека</b><small>Остров ненадолго показывает новый трек</small></div>${tog('trackToast', st.trackToast)}</div>
    <div class="set-row"><div class="lbl"><b>Готовить Яндекс Музыку при запуске</b><small>Кнопка ▶ работает сразу (применится после перезапуска)</small></div>${tog('yandexPreload', st.yandexPreload)}</div>
    <div class="set-row"><div class="lbl"><b>Запускать вместе с Windows</b><small>Остров появится сам после включения компьютера</small></div>${tog('autostart', auto)}</div>
    <div class="set-row"><div class="lbl"><b>Горячая клавиша</b><small>Ctrl + Alt + Пробел — открыть / закрыть остров, Esc — свернуть</small></div></div>
    <div class="set-row"><div class="lbl"><b>Atoll 0.1</b><small>Иконка в трее — меню приложения</small></div><button class="btn ghost" id="quitBtn">Выйти из приложения</button></div>`;

  $('#settingsPage').onclick = (e) => {
    const t = e.target.closest('[data-set]');
    if (t) {
      const k = t.dataset.set;
      const on = !t.classList.contains('on');
      t.classList.toggle('on', on);
      if (k === 'autostart') atoll.setAutostart(on);
      else {
        setSetting(k, on);
        if (k === 'visualizer' && on) Viz.startLoopback();
        if (k === 'coverGlow') { lastCoverForGlow = ''; refreshMusicViews(); }
      }
      return;
    }
    const th = e.target.closest('[data-theme]');
    if (th) { setSetting('theme', th.dataset.theme); applyTheme(); renderSettings(); return; }
    const ac = e.target.closest('[data-accent]');
    if (ac) { setSetting('accent', ac.dataset.accent); applyTheme(); lastCoverForGlow = ''; refreshMusicViews(); renderSettings(); return; }
    const city = e.target.closest('[data-city]');
    if (city) {
      setSetting('city', JSON.parse(city.dataset.city));
      W.data = null;
      loadWeather();
      renderSettings();
    }
  };
  $('#quitBtn').onclick = () => atoll.quit();
  let ct = null;
  $('#cityInput').addEventListener('input', (e) => {
    clearTimeout(ct);
    const q = e.target.value.trim();
    if (q.length < 2) { $('#cityResults').innerHTML = ''; return; }
    ct = setTimeout(async () => {
      try {
        const res = await Weather.search(q);
        $('#cityResults').innerHTML = res.length ? res.map((c) => `<div class="row" data-city='${esc(JSON.stringify(c))}'><div class="meta"><div class="t1">${esc(c.name)}</div><div class="t2">${esc(c.region)}</div></div></div>`).join('') : '<div class="hint">Не найдено</div>';
      } catch (err) {
        $('#cityResults').innerHTML = '<div class="hint">Нет связи с сервером</div>';
      }
    }, 300);
  });
}

// ==================== Запуск ====================
async function init() {
  const stored = await atoll.getStore();
  for (const k of Object.keys(DEFAULTS)) {
    if (stored[k] !== undefined) S[k] = stored[k];
  }
  S.settings = Object.assign({}, DEFAULTS.settings, stored.settings || {});
  if (stored.weatherCache && stored.weatherCache.city === S.settings.city.name && Date.now() - stored.weatherCache.at < 3 * 3600e3) {
    W.data = stored.weatherCache.data;
  }
  applyTheme();
  player.volume = S.volume;
  tickClock();
  setInterval(tickClock, 1000);
  applySize();
  renderWeatherBits();
  loadWeather();
  setInterval(loadWeather, 15 * 60e3);

  if (S.localFolder) {
    atoll.scanFolder(S.localFolder).then((tracks) => { Music.localTracks = tracks.map(trackToItem); });
  }

  setInterval(() => {
    if (S.timer.running && timerRemaining() <= 0) timerDone();
    renderTimerBits();
  }, 250);
  setInterval(checkReminders, 5000);
  checkReminders();

  setInterval(() => { if (Music.active === 'builtin' && !player.paused) refreshMusicViews(); }, 500);

  Viz.resize();
  Viz.start();
  if (S.settings.visualizer) Viz.startLoopback();
  window.addEventListener('resize', () => Viz.resize());
}

init();
