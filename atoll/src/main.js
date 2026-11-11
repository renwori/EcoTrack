'use strict';
// Atoll — главный процесс Electron.
// Окно-остров сверху экрана + скрытое окно Яндекс Музыки + трей.

const {
  app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage, dialog,
  session, globalShortcut, shell, Notification, desktopCapturer,
} = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const APP_NAME = 'Atoll';
const ISLAND_W = 780;   // окно чуть больше самого острова: под волну, тень и уведомления
const ISLAND_H = 580;
const YANDEX_URL = 'https://music.yandex.ru/';
const AUDIO_EXT = new Set(['.mp3', '.flac', '.ogg', '.oga', '.opus', '.m4a', '.aac', '.wav', '.webm']);

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}
app.setAppUserModelId('com.atoll.island');
// Звук должен играть сразу, без клика по странице.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// ---------- Хранилище настроек (простой JSON в папке пользователя) ----------
let store = {};
const storeFile = () => path.join(app.getPath('userData'), 'atoll-data.json');
function loadStore() {
  try { store = JSON.parse(fs.readFileSync(storeFile(), 'utf8')) || {}; } catch { store = {}; }
}
let saveTimer = null;
function saveStore(now = false) {
  clearTimeout(saveTimer);
  const write = () => {
    try { fs.writeFileSync(storeFile(), JSON.stringify(store, null, 1)); } catch (e) { console.error('store', e); }
  };
  if (now) write(); else saveTimer = setTimeout(write, 300);
}
const settings = () => store.settings || {};

// ---------- Окна ----------
let island = null;
let yandex = null;
let tray = null;
let quitting = false;

const iconPath = (name) => path.join(__dirname, '..', 'assets', name);

function islandBounds() {
  const d = screen.getPrimaryDisplay();
  const b = d.bounds;
  return {
    width: ISLAND_W,
    height: ISLAND_H,
    x: Math.round(b.x + (b.width - ISLAND_W) / 2),
    y: b.y,
  };
}

function createIsland() {
  island = new BrowserWindow({
    ...islandBounds(),
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000',
    title: APP_NAME,
    icon: iconPath('icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Окно грузит только локальные файлы; отключаем проверку origin,
      // чтобы анализировать звук интернет-радио и цвет обложек.
      webSecurity: false,
      backgroundThrottling: false,
    },
  });
  island.setAlwaysOnTop(true, 'screen-saver');
  island.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Прозрачные области пропускают клики на рабочий стол.
  island.setIgnoreMouseEvents(true, { forward: true });
  island.loadFile(path.join(__dirname, 'island', 'index.html'));
  island.once('ready-to-show', () => island.showInactive());
  island.on('closed', () => { island = null; });
}

function repositionIsland() {
  if (island && !island.isDestroyed()) island.setBounds(islandBounds());
}

function sendToIsland(channel, ...args) {
  if (island && !island.isDestroyed()) island.webContents.send(channel, ...args);
}

// ---------- Яндекс Музыка: официальный сайт в отдельном окне ----------
function chromeUserAgent(ua) {
  return ua.replace(/\sElectron\/\S+/i, '').replace(/\satoll\/\S+/i, '');
}

function ensureYandex() {
  if (yandex && !yandex.isDestroyed()) return yandex;
  const ses = session.fromPartition('persist:yandex');
  ses.setUserAgent(chromeUserAgent(app.userAgentFallback));

  yandex = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    title: 'Яндекс Музыка — Atoll',
    autoHideMenuBar: true,
    icon: iconPath('icon.png'),
    backgroundColor: '#121212',
    webPreferences: {
      partition: 'persist:yandex',
      preload: path.join(__dirname, 'yandex-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  yandex.webContents.setWindowOpenHandler(({ url }) => {
    // Вход в аккаунт и прочие страницы Яндекса открываем внутри приложения.
    if (/^https:\/\/([a-z0-9-]+\.)*(yandex\.(ru|com|by|kz|uz)|ya\.ru)(\/|$)/i.test(url)) {
      return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true } };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  yandex.on('close', (e) => {
    // Закрытие окна не останавливает музыку — окно просто прячется.
    if (!quitting) { e.preventDefault(); yandex.hide(); }
  });
  yandex.on('closed', () => { yandex = null; sendToIsland('ym:state', null); });
  yandex.webContents.on('did-fail-load', (_e, code, desc, url, isMain) => {
    if (isMain) sendToIsland('ym:error', `${desc} (${code})`);
  });

  yandex.loadURL(YANDEX_URL);
  return yandex;
}

function showYandex() {
  const w = ensureYandex();
  w.show();
  w.focus();
}

// ---------- Трей ----------
function buildTrayMenu() {
  const auto = app.getLoginItemSettings().openAtLogin;
  return Menu.buildFromTemplate([
    { label: 'Показать / скрыть остров', click: toggleIslandVisible },
    { label: 'Развернуть остров  (Ctrl+Alt+Пробел)', click: () => sendToIsland('island:toggle') },
    { type: 'separator' },
    { label: 'Открыть Яндекс Музыку', click: showYandex },
    { type: 'separator' },
    { label: 'Запускать вместе с Windows', type: 'checkbox', checked: auto, click: (i) => setAutostart(i.checked) },
    { type: 'separator' },
    { label: 'Выход', click: () => { quitting = true; app.quit(); } },
  ]);
}

function createTray() {
  let img = nativeImage.createFromPath(iconPath('tray.png'));
  if (img.isEmpty()) img = nativeImage.createFromPath(iconPath('icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => sendToIsland('island:toggle'));
}

function toggleIslandVisible() {
  if (!island) return;
  if (island.isVisible()) island.hide(); else island.showInactive();
}

function setAutostart(on) {
  app.setLoginItemSettings({ openAtLogin: !!on, args: ['--autostart'] });
  if (tray) tray.setContextMenu(buildTrayMenu());
}

// ---------- Локальная музыка ----------
function scanFolder(dir, limit = 5000) {
  const out = [];
  const walk = (d, depth) => {
    if (out.length >= limit || depth > 6) return;
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name, 'ru', { numeric: true }));
    for (const e of entries) {
      if (out.length >= limit) return;
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (!e.name.startsWith('.')) walk(full, depth + 1);
      } else if (AUDIO_EXT.has(path.extname(e.name).toLowerCase())) {
        out.push({
          url: pathToFileURL(full).href,
          name: path.basename(e.name, path.extname(e.name)),
          folder: path.basename(d),
        });
      }
    }
  };
  walk(dir, 0);
  return out;
}

// ---------- IPC ----------
// Команды острова принимаем только от окна острова; состояние плеера — только от окна Яндекса.
const fromIsland = (e) => island && !island.isDestroyed() && e.sender === island.webContents;
const fromYandex = (e) => yandex && !yandex.isDestroyed() && e.sender === yandex.webContents;

function registerIpc() {
  const on = (channel, fn) => ipcMain.on(channel, (e, ...a) => { if (fromIsland(e)) fn(e, ...a); });
  const handle = (channel, fn) => ipcMain.handle(channel, (e, ...a) => (fromIsland(e) ? fn(e, ...a) : null));

  handle('store:get', () => store);
  on('store:set', (_e, key, value) => {
    if (typeof key !== 'string') return;
    store[key] = value;
    saveStore();
  });

  on('island:mouse', (_e, interactive) => {
    if (!island) return;
    if (interactive) island.setIgnoreMouseEvents(false);
    else island.setIgnoreMouseEvents(true, { forward: true });
  });
  on('island:focus', () => { if (island) island.focus(); });
  on('island:blur', () => { if (island && island.isFocused()) island.blur(); });

  on('ym:open', showYandex);
  on('ym:load', () => ensureYandex());
  on('ym:cmd', (_e, cmd, arg) => {
    const w = ensureYandex();
    w.webContents.send('ym:cmd', cmd, arg);
  });
  ipcMain.on('ym:state', (e, state) => { if (fromYandex(e)) sendToIsland('ym:state', state); });

  handle('files:pickFolder', async () => {
    const r = await dialog.showOpenDialog(island, {
      title: 'Папка с музыкой',
      properties: ['openDirectory'],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    return { folder: r.filePaths[0], tracks: scanFolder(r.filePaths[0]) };
  });
  handle('files:scan', (_e, folder) => {
    if (typeof folder !== 'string' || !fs.existsSync(folder)) return [];
    return scanFolder(folder);
  });

  on('notify', (_e, title, body) => {
    if (Notification.isSupported()) {
      new Notification({ title: String(title || APP_NAME), body: String(body || ''), icon: iconPath('icon.png') }).show();
    }
  });

  handle('autostart:get', () => app.getLoginItemSettings().openAtLogin);
  on('autostart:set', (_e, on) => setAutostart(on));
  on('open-external', (_e, url) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  });
  on('app:quit', () => { quitting = true; app.quit(); });
}

// ---------- Запуск ----------
app.whenReady().then(() => {
  loadStore();
  registerIpc();

  // Захват всего звука компьютера (loopback) — чтобы край острова «танцевал» под любую музыку.
  session.defaultSession.setDisplayMediaRequestHandler((_req, callback) => {
    desktopCapturer.getSources({ types: ['screen'] })
      .then((sources) => callback({ video: sources[0], audio: 'loopback' }))
      .catch(() => callback({}));
  });

  createIsland();
  createTray();

  if (settings().yandexPreload !== false) {
    // Сайт грузится в фоне: кнопка ▶ в острове работает сразу.
    setTimeout(ensureYandex, 1500);
  }

  globalShortcut.register('Control+Alt+Space', () => sendToIsland('island:toggle'));

  screen.on('display-metrics-changed', repositionIsland);
  screen.on('display-added', repositionIsland);
  screen.on('display-removed', repositionIsland);
});

app.on('second-instance', () => {
  if (island) { island.showInactive(); sendToIsland('island:toggle', true); }
});

app.on('before-quit', () => { quitting = true; saveStore(true); });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { /* живём в трее */ });
