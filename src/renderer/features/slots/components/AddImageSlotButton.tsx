import React, { useRef } from 'react';
import type { SlotOwnerKind } from '@shared/types/domain';
import { ipc } from '@/ipc-client';

export function AddImageSlotButton(props: {
  ownerKind: SlotOwnerKind;
  ownerId: string;
  existingNames: string[];
  onAdded: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    const baseName = `image${String.fromCharCode(65 + props.existingNames.length)}`;
    let variableName = baseName;
    let i = 1;
    while (props.existingNames.includes(variableName)) variableName = `${baseName}${i++}`;

    const buf = await file.arrayBuffer();
    await ipc.slot.create({
      ownerKind: props.ownerKind, ownerId: props.ownerId,
      variableName, description: '',
      imageBytes: buf, originalFilename: file.name, mimeType: file.type || 'image/png',
    });
    props.onAdded();
  };

  return (
    <>
      <button onClick={() => ref.current?.click()}>+ 이미지 추가</button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ''; }}
      />
    </>
  );
}
