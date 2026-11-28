import type { CSSProperties } from 'react';

export interface PopoverStylePosition {
  top?: number;
  bottom?: number;
  left: number;
  maxHeight: number;
  width?: number;
}

export type PopoverHorizontalAlign = 'left' | 'right' | 'lg-right';

export interface ComputePopoverPositionOptions {
  width: number;
  preferredPlacement?: 'above' | 'below';
  align?: PopoverHorizontalAlign;
  minSpaceNeeded?: number;
  gap?: number;
  viewportPadding?: number;
}

/**
 * Retourne le rectangle de mise en page du déclencheur sans décalage dû à un éventuel
 * `transform: scale(...)` actif pendant le clic.
 */
function getTriggerLayoutRect(triggerEl: HTMLElement) {
  const rect = triggerEl.getBoundingClientRect();
  const dx = triggerEl.offsetWidth > 0 ? (rect.width - triggerEl.offsetWidth) / 2 : 0;
  const dy = triggerEl.offsetHeight > 0 ? (rect.height - triggerEl.offsetHeight) / 2 : 0;
  return {
    left: rect.left + dx,
    right: rect.right - dx,
    top: rect.top + dy,
    bottom: rect.bottom - dy
  };
}

/**
 * Calcule une position fixe homogène pour un popover :
 * ancré au-dessus (bottom) ou en dessous (top) du déclencheur, aligné sur son bord gauche ou droit.
 */
export function computePopoverPosition(
  triggerEl: HTMLElement | null,
  {
    width,
    preferredPlacement = 'above',
    align = 'left',
    minSpaceNeeded = 200,
    gap = 8,
    viewportPadding = 8
  }: ComputePopoverPositionOptions
): PopoverStylePosition {
  if (!triggerEl || typeof window === 'undefined') {
    return { bottom: viewportPadding, left: viewportPadding, maxHeight: 320, width };
  }

  const effectiveWidth = Math.min(width, Math.max(160, window.innerWidth - viewportPadding * 2));
  const rect = getTriggerLayoutRect(triggerEl);
  const spaceAbove = rect.top - gap - viewportPadding;
  const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;

  const openAbove =
    preferredPlacement === 'above'
      ? spaceAbove >= minSpaceNeeded || spaceAbove >= spaceBelow
      : spaceBelow < minSpaceNeeded && spaceAbove > spaceBelow;

  const resolvedAlign =
    align === 'lg-right' ? (window.innerWidth >= 1024 ? 'right' : 'left') : align;
  const anchorLeft = resolvedAlign === 'right' ? rect.right - effectiveWidth : rect.left;

  const left = Math.round(
    Math.max(viewportPadding, Math.min(anchorLeft, window.innerWidth - effectiveWidth - viewportPadding))
  );

  if (openAbove) {
    return {
      bottom: Math.round(window.innerHeight - rect.top + gap),
      left,
      maxHeight: Math.max(120, Math.floor(spaceAbove)),
      width: effectiveWidth
    };
  }

  return {
    top: Math.round(rect.bottom + gap),
    left,
    maxHeight: Math.max(120, Math.floor(spaceBelow)),
    width: effectiveWidth
  };
}

/**
 * Convertit une position calculée en objet `style` inline pour un conteneur `position: fixed`.
 */
export function toPopoverStyle(pos: PopoverStylePosition, width: number): CSSProperties {
  return {
    ...(pos.top !== undefined ? { top: pos.top } : {}),
    ...(pos.bottom !== undefined ? { bottom: pos.bottom } : {}),
    left: pos.left,
    maxHeight: pos.maxHeight,
    width: pos.width ?? width
  };
}
