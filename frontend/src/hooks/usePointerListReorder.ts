import { useCallback, useEffect, useRef, useState } from 'react';

export interface PointerDropTarget<Id> {
  id: Id;
  position: 'before' | 'after';
}

interface UsePointerListReorderOptions<Id> {
  itemIds: Id[];
  onReorder: (nextIds: Id[]) => void;
  getElementById: (id: Id) => HTMLElement | null;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Moteur partagé de réordonnancement vertical via Pointer Events (compatible souris + tactile).
 */
export function usePointerListReorder<Id extends string | number>({
  itemIds,
  onReorder,
  getElementById,
  scrollContainerRef,
}: UsePointerListReorderOptions<Id>) {
  const [draggingId, setDraggingId] = useState<Id | null>(null);
  const [dropTarget, setDropTarget] = useState<PointerDropTarget<Id> | null>(null);

  const itemIdsRef = useRef(itemIds);
  const onReorderRef = useRef(onReorder);
  const getElementByIdRef = useRef(getElementById);
  itemIdsRef.current = itemIds;
  onReorderRef.current = onReorder;
  getElementByIdRef.current = getElementById;

  const activeDragRef = useRef<{
    id: Id;
    startY: number;
    hasMoved: boolean;
  } | null>(null);
  const dropTargetRef = useRef<PointerDropTarget<Id> | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  const startPointerDrag = useCallback(
    (e: React.PointerEvent, id: Id) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.stopPropagation();

      cleanupRef.current?.();

      activeDragRef.current = {
        id,
        startY: e.clientY,
        hasMoved: false,
      };
      dropTargetRef.current = null;
      document.body.style.userSelect = 'none';

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const drag = activeDragRef.current;
        if (!drag) return;

        if (!drag.hasMoved) {
          if (Math.abs(moveEvent.clientY - drag.startY) < 4) return;
          drag.hasMoved = true;
          setDraggingId(drag.id);
        }

        const scrollEl = scrollContainerRef?.current;
        if (scrollEl) {
          const sRect = scrollEl.getBoundingClientRect();
          const edge = 44;
          if (moveEvent.clientY < sRect.top + edge) {
            scrollEl.scrollTop -= 8;
          } else if (moveEvent.clientY > sRect.bottom - edge) {
            scrollEl.scrollTop += 8;
          }
        }

        const otherIds = itemIdsRef.current.filter((candId) => candId !== drag.id);
        let nextTarget: PointerDropTarget<Id> | null = null;

        for (const candId of otherIds) {
          const el = getElementByIdRef.current(candId);
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          if (moveEvent.clientY <= rect.top + rect.height / 2) {
            nextTarget = { id: candId, position: 'before' };
            break;
          }
        }

        if (!nextTarget && otherIds.length > 0) {
          nextTarget = { id: otherIds[otherIds.length - 1], position: 'after' };
        }

        if (
          dropTargetRef.current?.id !== nextTarget?.id ||
          dropTargetRef.current?.position !== nextTarget?.position
        ) {
          dropTargetRef.current = nextTarget;
          setDropTarget(nextTarget);
        }
      };

      const finish = () => {
        cleanupRef.current?.();
      };

      const handlePointerUp = () => {
        const drag = activeDragRef.current;
        const target = dropTargetRef.current;

        if (drag?.hasMoved && target && drag.id !== target.id) {
          const remaining = itemIdsRef.current.filter((x) => x !== drag.id);
          const targetIdx = remaining.indexOf(target.id);
          if (targetIdx !== -1) {
            const insertIdx = target.position === 'after' ? targetIdx + 1 : targetIdx;
            remaining.splice(insertIdx, 0, drag.id);
            onReorderRef.current(remaining);
          }
        }
        finish();
      };

      window.addEventListener('pointermove', handlePointerMove, { passive: true });
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', finish);

      cleanupRef.current = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', finish);
        document.body.style.userSelect = '';
        activeDragRef.current = null;
        dropTargetRef.current = null;
        setDraggingId(null);
        setDropTarget(null);
        cleanupRef.current = null;
      };
    },
    [scrollContainerRef]
  );

  return {
    draggingId,
    dropTarget,
    startPointerDrag,
  };
}
