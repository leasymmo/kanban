import { CSSProperties, RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  computePopoverPosition,
  PopoverHorizontalAlign,
  PopoverStylePosition,
  toPopoverStyle,
} from '../components/ui/popoverPosition';

interface UseAnchoredPopoverOptions {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLElement>;
  popoverRef: RefObject<HTMLElement>;
  width: number;
  align?: PopoverHorizontalAlign;
  preferredPlacement?: 'above' | 'below';
  minSpaceNeeded?: number;
  gap?: number;
  viewportPadding?: number;
}

/**
 * Gère le positionnement fixe (compatible `createPortal` vers `document.body`),
 * le repositionnement throttlé via RAF au scroll/redimensionnement, la fermeture au clic extérieur et à Échap.
 */
export function useAnchoredPopover({
  isOpen,
  onClose,
  triggerRef,
  popoverRef,
  width,
  align = 'left',
  preferredPlacement = 'below',
  minSpaceNeeded = 200,
  gap = 6,
  viewportPadding = 16,
}: UseAnchoredPopoverOptions): CSSProperties {
  const [pos, setPos] = useState<PopoverStylePosition>({
    top: viewportPadding,
    left: viewportPadding,
    maxHeight: 360,
    width,
  });
  const rafRef = useRef<number | null>(null);

  const updatePosition = useCallback(() => {
    setPos(
      computePopoverPosition(triggerRef.current, {
        width,
        preferredPlacement,
        align,
        minSpaceNeeded,
        gap,
        viewportPadding,
      })
    );
  }, [triggerRef, width, preferredPlacement, align, minSpaceNeeded, gap, viewportPadding]);

  const schedulePositionUpdate = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      updatePosition();
    });
  }, [updatePosition]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', schedulePositionUpdate);
    window.addEventListener('scroll', schedulePositionUpdate, { passive: true, capture: true });

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', schedulePositionUpdate);
      window.removeEventListener('scroll', schedulePositionUpdate, true);
    };
  }, [isOpen, onClose, triggerRef, popoverRef, schedulePositionUpdate]);

  return toPopoverStyle(pos, width);
}
