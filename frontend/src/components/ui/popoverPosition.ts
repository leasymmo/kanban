import type { CSSProperties } from 'react';

export interface PopoverStylePosition {
  top?: number;
  bottom?: number;
  left: number;
  maxHeight: number;
}

export interface ComputePopoverPositionOptions {
  width: number;
  preferredPlacement?: 'above' | 'below';
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
    top: rect.top + dy,
    bottom: rect.bottom - dy
  };
}

/**
 * Calcule une position fixe homogène pour un popover :
 * ancré au-dessus (bottom) ou en dessous (top) du déclencheur, aligné sur son bord gauche.
 */
export function computePopoverPosition(
  triggerEl: HTMLElement | null,
  {
    width,
    preferredPlacement = 'above',
    minSpaceNeeded = 200,
    gap = 8,
    viewportPadding = 8
  }: ComputePopoverPositionOptions
): PopoverStylePosition {
  if (!triggerEl || typeof window === 'undefined') {
    return { bottom: viewportPadding, left: viewportPadding, maxHeight: 320 };
  }

  const rect = getTriggerLayoutRect(triggerEl);
  const spaceAbove = rect.top - gap - viewportPadding;
  const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;

  const openAbove =
    preferredPlacement === 'above'
      ? spaceAbove >= minSpaceNeeded || spaceAbove >= spaceBelow
      : spaceBelow < minSpaceNeeded && spaceAbove > spaceBelow;

  const left = Math.round(
    Math.max(viewportPadding, Math.min(rect.left, window.innerWidth - width - viewportPadding))
  );

  if (openAbove) {
    return {
      bottom: Math.round(window.innerHeight - rect.top + gap),
      left,
      maxHeight: Math.max(120, Math.floor(spaceAbove))
    };
  }

  return {
    top: Math.round(rect.bottom + gap),
    left,
    maxHeight: Math.max(120, Math.floor(spaceBelow))
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
    width
  };
}
