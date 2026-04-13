import React, { useCallback, useEffect, useState } from 'react';
import type { Asset, ImageSlot, SlotOwnerKind } from '@shared/types/domain';
import { ipc } from '@/ipc-client';
import { ImageSlotCard } from './ImageSlotCard';
import { AddImageSlotButton } from './AddImageSlotButton';

export function ImageSlotList({ ownerKind, ownerId, readOnly = false }: {
  ownerKind: SlotOwnerKind;
  ownerId: string;
  readOnly?: boolean;
}) {
  const [slots, setSlots] = useState<Array<ImageSlot & { asset: Asset }>>([]);

  const reload = useCallback(async () => {
    setSlots(await ipc.slot.listByOwner(ownerKind, ownerId));
  }, [ownerKind, ownerId]);

  useEffect(() => { void reload(); }, [reload]);

  return (
    <div>
      {slots.map(s => readOnly
        ? (
          <div key={s.id} style={{ fontSize: 12, opacity: 0.8 }}>
            {`{${s.variableName}}`} {s.description && `— ${s.description}`}
          </div>
        )
        : <ImageSlotCard key={s.id} slot={s} onChange={reload} />
      )}
      {!readOnly && (
        <AddImageSlotButton
          ownerKind={ownerKind}
          ownerId={ownerId}
          existingNames={slots.map(s => s.variableName)}
          onAdded={reload}
        />
      )}
    </div>
  );
}
