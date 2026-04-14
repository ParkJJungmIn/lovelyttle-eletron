import { app, BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { openDatabase } from './db/connection';
import { loadMigrations, runMigrations } from './db/migrate';
import { buildAppContext } from './app-context';
import { registerIpc } from './ipc/register';

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
}

function logPath(): string {
  return path.join(app.getPath('userData'), 'startup.log');
}

function log(message: string): void {
  try {
    fs.appendFileSync(logPath(), `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    /* ignore */
  }
}

function reportFatal(err: unknown): void {
  const message = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  log(`FATAL: ${message}`);
  try {
    dialog.showErrorBox('NanoBanana Factory 실행 오류', `${message}\n\n로그: ${logPath()}`);
  } catch {
    /* ignore */
  }
}

process.on('uncaughtException', reportFatal);
process.on('unhandledRejection', reportFatal);

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    center: true,
    show: false,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    log(`did-fail-load ${code} ${desc} ${url}`);
    dialog.showErrorBox('화면 로드 실패', `code=${code} desc=${desc}\nurl=${url}\n로그: ${logPath()}`);
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    await win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    const htmlPath = path.join(__dirname, '../renderer/index.html');
    log(`loading renderer from ${htmlPath}`);
    await win.loadFile(htmlPath);
  }
}

if (gotLock) {
  app.whenReady().then(async () => {
    try {
      log(`app ready; userData=${app.getPath('userData')}`);
      const userDataDir = app.getPath('userData');
      const db = openDatabase(path.join(userDataDir, 'app.db'));
      const migrationsDir = app.isPackaged
        ? path.join(process.resourcesPath, 'migrations')
        : path.join(__dirname, '../../src/main/db/migrations');
      log(`migrations from ${migrationsDir}`);
      runMigrations(db, loadMigrations(migrationsDir));

      const ctx = buildAppContext(db, userDataDir);
      registerIpc(ctx);

      await createWindow();
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) void createWindow();
      });
    } catch (err) {
      reportFatal(err);
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
