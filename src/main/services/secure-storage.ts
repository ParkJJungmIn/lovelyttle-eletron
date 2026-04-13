import { safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export class SecureStorage {
  constructor(private userDataDir: string) {}

  private file() { return path.join(this.userDataDir, 'secrets.bin'); }

  isAvailable(): boolean { return safeStorage.isEncryptionAvailable(); }

  hasApiKey(): boolean { return fs.existsSync(this.file()); }

  setApiKey(plain: string): void {
    if (!this.isAvailable()) throw new Error('OS encryption unavailable; cannot store API key.');
    const encrypted = safeStorage.encryptString(plain);
    fs.writeFileSync(this.file(), encrypted);
  }

  getApiKey(): string | null {
    if (!this.hasApiKey()) return null;
    const buf = fs.readFileSync(this.file());
    return safeStorage.decryptString(buf);
  }

  clearApiKey(): void {
    if (this.hasApiKey()) fs.unlinkSync(this.file());
  }
}
