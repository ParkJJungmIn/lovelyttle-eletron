import type { AppContext } from '../app-context';
import { handle } from './register';
import type { Asset, ImageSlot } from '@shared/types/domain';

export function registerSlotIpc(ctx: AppContext): void {
  handle('slot:listByOwner', ({ ownerKind, ownerId }) => {
    const rows = ctx.slots.listByOwner(ownerKind, ownerId);
    return rows.map(s => ({ ...s, asset: ctx.assets.getById(s.assetId)! })) as Array<ImageSlot & { asset: Asset }>;
  });

  handle('slot:create', async ({ ownerKind, ownerId, variableName, description, imageBytes, originalFilename, mimeType }) => {
    const asset = await ctx.assetStore.save(Buffer.from(imageBytes), mimeType, originalFilename);
    const existing = ctx.slots.listByOwner(ownerKind, ownerId);
    const position = existing.length;
    const slot = ctx.slots.create({ ownerKind, ownerId, assetId: asset.id, variableName, description, position });
    return { ...slot, asset };
  });

  handle('slot:update', ({ id, patch }) => ctx.slots.update(id, patch));
  handle('slot:delete', ({ id }) => { ctx.slots.delete(id); });
}
