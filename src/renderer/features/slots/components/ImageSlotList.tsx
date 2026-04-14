import React, { useCallback, useEffect, useState } from 'react';
import type { Asset, ImageSlot, SlotOwnerKind } from '@shared/types/domain';
import { ipc } from '@/ipc-client';
import { ImageSlotCard } from './ImageSlotCard';
import { AddImageSlotButton } from './AddImageSlotButton';
import { ImageSlotEditDialog } from './ImageSlotEditDialog';

type SlotWithAsset = ImageSlot & { asset: Asset };

export function ImageSlotList({ ownerKind, ownerId, readOnly = false }: {
  ownerKind: SlotOwnerKind;
  ownerId: string;
  readOnly?: boolean;
}) {
  const [slots, setSlots] = useState<SlotWithAsset[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setSlots(await ipc.slot.listByOwner(ownerKind, ownerId));
  }, [ownerKind, ownerId]);

  useEffect(() => { void reload(); }, [reload]);

  const editing = editingId ? slots.find(s => s.id === editingId) ?? null : null;
  const otherNames = editing ? slots.filter(s => s.id !== editing.id).map(s => s.variableName) : [];

  return (
    <div>
      {slots.map(s => readOnly
        ? (
          <div key={s.id} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {`{${s.variableName}}`} {s.description && `— ${s.description}`}
          </div>
        )
        : <ImageSlotCard key={s.id} slot={s} onClick={() => setEditingId(s.id)} />
      )}
      {!readOnly && (
        <AddImageSlotButton
          ownerKind={ownerKind}
          ownerId={ownerId}
          existingNames={slots.map(s => s.variableName)}
          onAdded={reload}
        />
      )}
      {!readOnly && (
        <ImageSlotEditDialog
          slot={editing}
          existingNames={otherNames}
          onClose={() => setEditingId(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}
