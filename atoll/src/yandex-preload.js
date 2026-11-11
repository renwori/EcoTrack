'use strict';
// Подключается к официальному сайту music.yandex.ru внутри окна приложения.
// Ничего не взламывает: читает то, что сайт сам сообщает системе
// (navigator.mediaSession — название, исполнитель, обложка), и нажимает
// те же кнопки, что и медиаклавиши клавиатуры.
const { contextBridge, ipcRenderer } = require('electron');

function mainWorldBridge() {
  if (window.__atollBridge) return;
  window.__atollBridge = true;

  const handlers = {};
  let positionState = null;
  let lastMedia = null;

  const ms = navigator.mediaSession;
  if (ms) {
    const origSet = ms.setActionHandler.bind(ms);
    ms.setActionHandler = function (action, handler) {
      handlers[action] = handler;
      try { return origSet(action, handler); } catch (e) { /* неподдерживаемое действие */ }
    };
    if (typeof ms.setPositionState === 'function') {
      const origPos = ms.setPositionState.bind(ms);
      ms.setPositionState = function (s) {
        positionState = s ? { duration: s.duration, position: s.position, rate: s.playbackRate || 1, at: Date.now() } : null;
        return origPos(s);
      };
    }
  }

  // Запоминаем последний запущенный <audio>/<video>: из него точнее берётся время трека.
  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    lastMedia = this;
    return origPlay.apply(this, arguments);
  };

  function media() {
    if (lastMedia && (lastMedia.isConnected || lastMedia.src || lastMedia.srcObject)) return lastMedia;
    return document.querySelector('audio, video');
  }

  function isPlaying() {
    const m = media();
    if (m && !Number.isNaN(m.duration)) return !m.paused;
    return ms && ms.playbackState === 'playing';
  }

  function call(action, extra) {
    const h = handlers[action];
    if (typeof h === 'function') {
      try { h(Object.assign({ action }, extra || {})); return true; } catch (e) { /* ignore */ }
    }
    return false;
  }

  function clickByLabel(words) {
    const nodes = document.querySelectorAll('button[aria-label], [role="button"][aria-label]');
    for (const n of nodes) {
      const l = (n.getAttribute('aria-label') || '').toLowerCase();
      if (words.some((w) => l.includes(w))) { n.click(); return true; }
    }
    return false;
  }

  function command(cmd, arg) {
    const m = media();
    switch (cmd) {
      case 'play':
        if (!call('play')) { if (m) m.play(); else clickByLabel(['воспроизвести', 'play']); }
        break;
      case 'pause':
        if (!call('pause')) { if (m) m.pause(); else clickByLabel(['пауза', 'pause']); }
        break;
      case 'playpause':
        command(isPlaying() ? 'pause' : 'play');
        break;
      case 'next':
        if (!call('nexttrack')) clickByLabel(['следующ', 'next']);
        break;
      case 'prev':
        if (!call('previoustrack')) clickByLabel(['предыдущ', 'previous']);
        break;
      case 'seek': {
        const t = Number(arg) || 0;
        if (!call('seekto', { seekTime: t, fastSeek: false }) && m) m.currentTime = t;
        break;
      }
      case 'like':
        clickByLabel(['нравится', 'like', 'добавить в коллекцию']);
        break;
      case 'volume':
        if (m) m.volume = Math.max(0, Math.min(1, Number(arg)));
        break;
      default:
    }
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || typeof e.data.__atollCmd !== 'string') return;
    command(e.data.__atollCmd, e.data.arg);
  });

  setInterval(() => {
    const meta = ms && ms.metadata;
    const m = media();
    let position = 0;
    let duration = 0;
    if (m && Number.isFinite(m.duration) && m.duration > 0) {
      position = m.currentTime; duration = m.duration;
    } else if (positionState) {
      duration = positionState.duration || 0;
      position = positionState.position || 0;
      if (ms.playbackState === 'playing') position += (Date.now() - positionState.at) / 1000 * positionState.rate;
    }
    let cover = '';
    if (meta && meta.artwork && meta.artwork.length) {
      const art = Array.from(meta.artwork).sort((a, b) => parseInt(b.sizes || '0', 10) - parseInt(a.sizes || '0', 10));
      cover = art[0].src || '';
    }
    window.postMessage({
      __atollState: {
        title: meta ? meta.title : '',
        artist: meta ? meta.artist : '',
        album: meta ? meta.album : '',
        cover,
        playing: !!isPlaying(),
        position,
        duration: Math.min(duration, 24 * 3600),
        volume: m ? m.volume : 1,
      },
    }, '*');
  }, 500);
}

// Внедряем мост в «мир» страницы до её собственных скриптов.
contextBridge.executeInMainWorld({ func: mainWorldBridge });

const isMusicPage = () => /(^|\.)music\.yandex\./i.test(location.hostname);

window.addEventListener('message', (e) => {
  if (e.source === window && e.data && e.data.__atollState && isMusicPage()) {
    ipcRenderer.send('ym:state', e.data.__atollState);
  }
});

ipcRenderer.on('ym:cmd', (_e, cmd, arg) => {
  window.postMessage({ __atollCmd: cmd, arg }, '*');
});
