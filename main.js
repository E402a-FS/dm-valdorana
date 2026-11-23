// Circolazione Simulatore — applicazione desktop (Electron)
// - ogni pannello sganciato è una finestra nativa: posizione, dimensione e monitor vengono ricordati
// - la simulazione non rallenta con la finestra principale in secondo piano
// - salvataggi su file in Documenti\Circolazione Simulatore (manuali e automatici a rotazione)
// - aggiornamenti automatici da GitHub Releases (electron-updater)
const { app, BrowserWindow, ipcMain, dialog, Menu, shell, screen, session } = require('electron');
const path = require('path');
const fs = require('fs');
// su portatili con due schede grafiche usa sempre quella potente (NVIDIA/AMD) invece dell'integrata
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');

let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch (e) { /* in sviluppo può mancare */ }

if (!app.requestSingleInstanceLock()) app.quit();

const SAVES = path.join(app.getPath('documents'), 'Circolazione Simulatore');
const OLD_SAVES = path.join(app.getPath('documents'), 'DM Valdorana'); // cartella delle versioni precedenti
const AUTO = path.join(SAVES, 'automatici');
const STATE = path.join(app.getPath('userData'), 'finestre.json');
const ICON = path.join(__dirname, 'build', 'icon.png');

function readJSON(f, d) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } }
let winState = readJSON(STATE, {});
let stateTimer = null;
function saveState() {
  clearTimeout(stateTimer);
  stateTimer = setTimeout(() => { try { fs.writeFileSync(STATE, JSON.stringify(winState, null, 1)); } catch (e) { } }, 300);
}
// la finestra torna dov'era solo se quel monitor è ancora collegato
function onScreen(b) {
  return screen.getAllDisplays().some(d => {
    const a = d.workArea;
    return b.x < a.x + a.width - 50 && b.x + b.width > a.x + 50 && b.y >= a.y - 20 && b.y < a.y + a.height - 50;
  });
}
function track(win, key) {
  const st = winState[key];
  if (st && st.bounds && onScreen(st.bounds)) win.setBounds(st.bounds);
  if (st && st.max) win.maximize();
  const upd = () => {
    if (win.isDestroyed()) return;
    const prev = winState[key] || {};
    winState[key] = Object.assign(prev, { max: win.isMaximized(), full: win.isFullScreen() });
    if (!win.isMaximized() && !win.isFullScreen() && !win.isMinimized()) winState[key].bounds = win.getBounds();
    saveState();
  };
  for (const ev of ['move', 'resize', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) win.on(ev, upd);
}

let mainWin = null;
function createMain() {
  mainWin = new BrowserWindow({
    width: 1600, height: 1000, minWidth: 900, minHeight: 600,
    backgroundColor: '#0e1012', title: 'Circolazione Simulatore', icon: ICON, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, backgroundThrottling: false },
  });
  track(mainWin, 'main');
  mainWin.once('ready-to-show', () => mainWin.show());
  // pannelli sganciati: finestre native, senza menu, non rallentate
  mainWin.webContents.setWindowOpenHandler(() => ({
    action: 'allow',
    overrideBrowserWindowOptions: {
      backgroundColor: '#0e1012', autoHideMenuBar: true, icon: ICON, minWidth: 320, minHeight: 200,
      webPreferences: { backgroundThrottling: false },
    },
  }));
  mainWin.webContents.on('did-create-window', (child, { frameName }) => {
    track(child, frameName || 'pannello');
    child.setMenuBarVisibility(false);
  });
  // i link esterni si aprono nel browser
  mainWin.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); } });
  // YouTube nel PC della sala: l'incorporamento da file:// manca del referer e dà l'errore 153; si aggiunge l'intestazione e si consente l'avvio automatico
  try { session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['https://www.youtube.com/*', 'https://www.youtube-nocookie.com/*', 'https://*.googlevideo.com/*'] }, (d, cb) => { const h = d.requestHeaders; if (!h['Referer'] && !h['referer']) h['Referer'] = 'https://circolazione-simulatore.app/'; cb({ requestHeaders: h }); }); } catch (e) { }
  mainWin.loadFile(path.join(__dirname, 'app', 'index.html'));
  mainWin.on('closed', () => { mainWin = null; app.quit(); });
}

// ---------- salvataggi ----------
function ensureDirs() { fs.mkdirSync(AUTO, { recursive: true }); }
const stamp = () => new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
ipcMain.handle('version', () => app.getVersion());
ipcMain.handle('autosave', (e, json) => {
  ensureDirs();
  const f = path.join(AUTO, `autosalvataggio-${stamp()}.json`);
  fs.writeFileSync(f, json);
  const files = fs.readdirSync(AUTO).filter(x => x.startsWith('autosalvataggio-')).sort();
  while (files.length > 20) fs.unlinkSync(path.join(AUTO, files.shift()));
  return f;
});
ipcMain.handle('quicksave', (e, json) => {
  ensureDirs();
  const f = path.join(SAVES, `turno-${stamp()}.json`);
  fs.writeFileSync(f, json);
  return f;
});
ipcMain.handle('latest', () => {
  ensureDirs();
  const all = [];
  for (const dir of [SAVES, AUTO, OLD_SAVES, path.join(OLD_SAVES, 'automatici')]) { if (!fs.existsSync(dir)) continue; for (const x of fs.readdirSync(dir)) if (x.endsWith('.json')) { const f = path.join(dir, x); all.push({ f, t: fs.statSync(f).mtimeMs }); } }
  all.sort((a, b) => b.t - a.t);
  return all.length ? fs.readFileSync(all[0].f, 'utf8') : null;
});
ipcMain.handle('open-game', async () => {
  ensureDirs();
  const r = await dialog.showOpenDialog(mainWin, { title: 'Carica turno', defaultPath: SAVES, filters: [{ name: 'Turno Circolazione Simulatore', extensions: ['json'] }], properties: ['openFile'] });
  return r.canceled || !r.filePaths[0] ? null : fs.readFileSync(r.filePaths[0], 'utf8');
});
ipcMain.handle('export-game', async (e, json, name) => {
  ensureDirs();
  const r = await dialog.showSaveDialog(mainWin, { title: 'Esporta turno', defaultPath: path.join(SAVES, name || 'turno.json'), filters: [{ name: 'Turno Circolazione Simulatore', extensions: ['json'] }] });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, json);
  return r.filePath;
});
ipcMain.handle('layout-get', () => winState.panels || []);
ipcMain.handle('layout-set', (e, list) => { winState.panels = list; saveState(); return true; });

// ---------- aggiornamenti ----------
function checkUpdates(manual) {
  if (!autoUpdater || !app.isPackaged) { if (manual) dialog.showMessageBox(mainWin, { message: 'Aggiornamenti disponibili solo nella versione installata.' }); return; }
  autoUpdater.checkForUpdates().then(r => {
    if (manual && (!r || !r.updateInfo || r.updateInfo.version === app.getVersion())) dialog.showMessageBox(mainWin, { message: `Nessun aggiornamento: hai già la versione ${app.getVersion()}.` });
  }).catch(err => { if (manual) dialog.showMessageBox(mainWin, { type: 'warning', message: 'Impossibile verificare gli aggiornamenti.', detail: String(err) }); });
}
function setupUpdater() {
  if (!autoUpdater) return;
  autoUpdater.autoDownload = true;
  autoUpdater.on('update-downloaded', info => {
    dialog.showMessageBox(mainWin, {
      type: 'info', buttons: ['Riavvia e aggiorna', 'Più tardi'], defaultId: 0,
      message: `È pronta la versione ${info.version} di Circolazione Simulatore.`,
      detail: 'Il turno in corso viene salvato automaticamente. Se scegli "Più tardi" l\'aggiornamento verrà installato alla chiusura.',
    }).then(r => { if (r.response === 0) { mainWin && mainWin.webContents.executeJavaScript('try{saveLocal(true)}catch(e){}').finally(() => autoUpdater.quitAndInstall()); } });
  });
}

// ---------- menu ----------
let ui = {}, uiKey = '';
ipcMain.on('ui-state', (e, st) => { const k = JSON.stringify(st); if (k === uiKey) return; uiKey = k; ui = st || {}; buildMenu(); });
const send = (id, val) => () => { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('menu-cmd', id, val); };
function buildMenu() {
  const it = (label, id, val, extra) => Object.assign({ label, click: send(id, val) }, extra || {});
  const chk = (label, id, on) => ({ label, type: 'checkbox', checked: !!on, click: send(id) });
  const rad = (label, id, val, on) => ({ label, type: 'radio', checked: !!on, click: send(id, val) });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'File', submenu: [
      it('Menu principale', 'click', 'bMenu'), { type: 'separator' },
      it('Salva', 'click', 'bSave', { accelerator: 'CmdOrCtrl+S' }), it('Carica ultimo salvataggio', 'click', 'bLoad'),
      it('Esporta su file…', 'click', 'bExp'), it('Importa da file…', 'importFile'), { type: 'separator' },
      it('Nuovo turno…', 'newTurn'), { type: 'separator' },
      { label: 'Apri cartella dei salvataggi', click: () => { ensureDirs(); shell.openPath(SAVES); } },
      { role: 'quit', label: 'Esci' },
    ] },
    { label: 'Viste', submenu: [
      it(ui.view3d ? 'Vista 2D' : 'Vista 3D', 'click', 'b3d'), { type: 'separator' },
      it('Banco', 'v3', 'seat'), it('Quadro luminoso', 'v3', 'ql'), it('Pulsantiera', 'v3', 'puls'),
      it('Monitor 1', 'v3', 'r3m1'), it('Monitor 2', 'v3', 'r3m2'), it('Finestra', 'v3', 'win'),
      it('Panoramica', 'v3', 'pano'), it('Panoramica 2', 'v3', 'pano2'), it('Inquadratura precedente', 'v3', 'back'),
      { type: 'separator' }, chk('Orologio flottante', 'clockWin', ui.clock),
    ] },
    { label: 'Meteo', submenu: [
      rad('Casuale (cambia ogni 1 h 30)', 'wxMode', 'random', ui.wxMode !== 'manual'),
      rad('Manuale', 'wxMode', 'manual', ui.wxMode === 'manual'), { type: 'separator' },
      ...[['sereno', 'Sereno'], ['variabile', 'Variabile'], ['nuvoloso', 'Nuvoloso'], ['pioggia', 'Pioggia'], ['temporale', 'Temporale']].map(([v, l]) => rad(l, 'wxKind', v, ui.wxMode === 'manual' && ui.wxKind === v)),
      { type: 'separator' }, chk('Nebbia', 'wxFog', ui.wxFog),
      { type: 'separator' }, { label: ui.wxNow ? 'Ora: ' + ui.wxNow : 'Ora: —', enabled: false },
    ] },
    { label: 'Grafica', submenu: [
      ...['bassa', 'media', 'alta', 'ultra'].map(q => rad('Qualità ' + q, 'gQ', q, ui.q === q)),
      { type: 'separator' }, chk('Mostra gli fps', 'gFps', ui.fps),
      it('Torcia', 'gTorch', null, { accelerator: 'F' , registerAccelerator: false }), it('Diagnosi prestazioni', 'gBench'),
    ] },
    { label: 'Tempo', submenu: [
      it('Ora reale', 'click', 'bSync'), { type: 'separator' },
      rad('Pausa', 'speed', 0, ui.speed === 0), ...[1, 2, 5, 10, 30].map(v => rad('×' + v, 'speed', v, ui.speed === v)),
    ] },
    { label: 'Impostazioni', submenu: [chk('Guasti casuali', 'faults', ui.faults !== false), chk('Suoni', 'sound', ui.sound !== false)] },
    { label: 'Visualizza', submenu: [
      { role: 'togglefullscreen', label: 'Schermo intero' },
      { role: 'zoomIn', label: 'Ingrandisci' }, { role: 'zoomOut', label: 'Riduci' }, { role: 'resetZoom', label: 'Zoom 100%' },
      { type: 'separator' },
      { label: 'Ripristina disposizione finestre', click: () => { winState = {}; saveState(); dialog.showMessageBox(mainWin, { message: 'La disposizione verrà ripristinata al prossimo avvio.' }); } },
      { role: 'reload', label: 'Ricarica' },
      { role: 'toggleDevTools', label: 'Strumenti sviluppatore' },
    ] },
    { label: '?', submenu: [
      { label: 'Controlla aggiornamenti', click: () => checkUpdates(true) },
      { label: 'Informazioni', click: () => dialog.showMessageBox(mainWin, { title: 'Circolazione Simulatore', message: `Circolazione Simulatore\nVersione ${app.getVersion()}`, detail: `Salvataggi: ${SAVES}` }) },
    ] },
  ]));
}

app.on('second-instance', () => { if (mainWin) { if (mainWin.isMinimized()) mainWin.restore(); mainWin.focus(); } });
app.whenReady().then(() => {
  buildMenu();
  createMain();
  setupUpdater();
  setTimeout(() => checkUpdates(false), 5000);
});
app.on('window-all-closed', () => app.quit());
