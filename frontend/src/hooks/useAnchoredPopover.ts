import { CSSProperties, RefObject, useCallback, useEffect, useLayoutEffect, useState } from 'react';
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
 * le repositionnement au scroll/redimensionnement, la fermeture au clic extérieur et à la touche Échap.
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
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, { passive: true, capture: true });

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, onClose, triggerRef, popoverRef, updatePosition]);

  return toPopoverStyle(pos, width);
}
