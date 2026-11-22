'use client';

import { useState, useTransition } from 'react';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Item = { id: string; node: React.ReactNode };

function Row({ item }: { item: Item }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`card flex items-center gap-3 p-3 ${isDragging ? 'z-10 border-violet shadow-glow' : ''}`}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        className="cursor-grab touch-none select-none px-1 text-lg text-ink-muted active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <div className="min-w-0 flex-1">{item.node}</div>
    </li>
  );
}

/** Drag-and-drop list. Saves the new order (array of ids) with ONE server action call when you drop. */
export function SortableList({
  items, onSave,
}: { items: Item[]; onSave: (ids: string[]) => Promise<{ ok?: boolean; error?: string }> }) {
  const [order, setOrder] = useState(items);
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // keep in sync when the server sends new data (after add / edit)
  const key = items.map((i) => i.id).join(',');
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setOrder(items);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = order.findIndex((i) => i.id === active.id);
    const to = order.findIndex((i) => i.id === over.id);
    const next = arrayMove(order, from, to);
    setOrder(next);
    setMsg('Saving…');
    start(async () => {
      const res = await onSave(next.map((i) => i.id));
      if (res.error) { setOrder(order); setMsg(res.error); } else setMsg('Order saved ✓');
    });
  }

  return (
    <div>
      <p className="mb-2 h-4 text-xs text-ink-muted" aria-live="polite">{pending ? 'Saving…' : msg}</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {order.map((i) => <Row key={i.id} item={i} />)}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
