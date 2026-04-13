import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { openDatabase } from './db/connection';
import { loadMigrations, runMigrations } from './db/migrate';
import { buildAppContext } from './app-context';
import { registerIpc } from './ipc/register';

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    await win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    await win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  const userDataDir = app.getPath('userData');
  const db = openDatabase(path.join(userDataDir, 'app.db'));
  const migrationsDir = app.isPackaged
    ? path.join(process.resourcesPath, 'migrations')
    : path.join(__dirname, '../../src/main/db/migrations');
  runMigrations(db, loadMigrations(migrationsDir));

  const ctx = buildAppContext(db, userDataDir);
  registerIpc(ctx);

  await createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
