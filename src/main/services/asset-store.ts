import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Asset, UUID } from '@shared/types/domain';
import type { AssetRepo } from '../db/repositories/asset-repo';

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function extFor(mime: string): string {
  return MIME_TO_EXT[mime] ?? 'bin';
}

export class AssetStore {
  constructor(private repo: AssetRepo, private userDataDir: string) {
    fs.mkdirSync(this.dir(), { recursive: true });
  }

  private dir() { return path.join(this.userDataDir, 'assets'); }
  private fileFor(asset: Asset) { return path.join(this.dir(), `${asset.contentHash}.${extFor(asset.mimeType)}`); }

  async save(bytes: Buffer, mimeType: string, originalFilename: string | null): Promise<Asset> {
    const contentHash = crypto.createHash('sha256').update(bytes).digest('hex');
    const asset = this.repo.findOrCreate({ contentHash, mimeType, byteSize: bytes.length, originalFilename });
    const target = this.fileFor(asset);
    if (!fs.existsSync(target)) fs.writeFileSync(target, bytes);
    return asset;
  }

  readBytes(assetId: UUID): { bytes: Buffer; mimeType: string; filename: string } {
    const asset = this.repo.getById(assetId);
    if (!asset) throw new Error(`Asset not found: ${assetId}`);
    const bytes = fs.readFileSync(this.fileFor(asset));
    return { bytes, mimeType: asset.mimeType, filename: this.fileFor(asset) };
  }

  dataUrl(assetId: UUID): string {
    const { bytes, mimeType } = this.readBytes(assetId);
    return `data:${mimeType};base64,${bytes.toString('base64')}`;
  }

  deleteFileIfPresent(assetId: UUID): void {
    const asset = this.repo.getById(assetId);
    if (!asset) return;
    const f = this.fileFor(asset);
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}
