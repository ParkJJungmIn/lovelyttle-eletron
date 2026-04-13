import type { AppContext } from '../app-context';
import { handle } from './register';

export function registerAssetIpc(ctx: AppContext): void {
  handle('asset:getDataUrl', ({ assetId }) => ({ dataUrl: ctx.assetStore.dataUrl(assetId) }));
}
