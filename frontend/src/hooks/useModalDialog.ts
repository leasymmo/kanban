import { useEffect, useRef } from 'react';

let openModalCounter = 0;
let previousBodyOverflow = '';
let previousHtmlOverflow = '';
let previousHtmlOverscroll = '';

const FIRST_FIELD_SELECTOR = [
  'input:not([disabled]):not([type="hidden"])',
  'textarea:not([disabled])',
  'select:not([disabled])'
].join(', ');

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

interface UseModalDialogOptions {
  isOpen: boolean;
  onClose: () => void;
  canClose?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Gère l'accessibilité et l'ergonomie d'une modale :
 * - Fermeture via Échap
 * - Verrouillage du scroll du body (compatible modales empilées)
 * - Focus initial à l'ouverture, piège Tab/Shift+Tab interne et restauration du focus à la fermeture
 */
export function useModalDialog<T extends HTMLElement = HTMLDivElement>({
  isOpen,
  onClose,
  canClose = true,
  initialFocusRef
}: UseModalDialogOptions) {
  const dialogRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  const canCloseRef = useRef(canClose);

  onCloseRef.current = onClose;
  canCloseRef.current = canClose;

  useEffect(() => {
    if (!isOpen) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (openModalCounter === 0) {
      previousBodyOverflow = document.body.style.overflow;
      previousHtmlOverflow = document.documentElement.style.overflow;
      previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.overscrollBehavior = 'none';
    }
    openModalCounter += 1;

    const rafId = window.requestAnimationFrame(() => {
      const dialogEl = dialogRef.current;
      if (!dialogEl) return;
      if (dialogEl.contains(document.activeElement) && document.activeElement !== dialogEl) {
        return;
      }
      const target = initialFocusRef?.current;
      if (target && document.contains(target)) {
        target.focus({ preventScroll: true });
        return;
      }
      const firstField = dialogEl.querySelector<HTMLElement>(FIRST_FIELD_SELECTOR);
      if (firstField) {
        firstField.focus({ preventScroll: true });
        return;
      }
      const firstFocusable = dialogEl.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (firstFocusable) {
        firstFocusable.focus({ preventScroll: true });
      } else {
        dialogEl.focus({ preventScroll: true });
      }
    });

    const syncVisualViewport = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const keyboardBottom = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
      document.documentElement.style.setProperty('--cdh-vv-bottom', `${keyboardBottom}px`);
      document.documentElement.style.setProperty('--cdh-vv-height', `${Math.round(vv.height)}px`);

      if (keyboardBottom > 40) {
        const dialogEl = dialogRef.current;
        const activeEl = document.activeElement;
        if (
          dialogEl &&
          activeEl instanceof HTMLElement &&
          dialogEl.contains(activeEl) &&
          activeEl.matches('input, textarea, select')
        ) {
          activeEl.scrollIntoView({ block: 'nearest' });
        }
      }
    };

    syncVisualViewport();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', syncVisualViewport);
    vv?.addEventListener('scroll', syncVisualViewport);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (canCloseRef.current) {
          e.preventDefault();
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }

      if (e.key !== 'Tab') return;
      const dialogEl = dialogRef.current;
      if (!dialogEl) return;

      const focusables = Array.from(
        dialogEl.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (focusables.length === 0) {
        e.preventDefault();
        dialogEl.focus({ preventScroll: true });
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !dialogEl.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !dialogEl.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    const handleBackgroundScroll = (e: WheelEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const dialogEl = dialogRef.current;
      if (dialogEl && dialogEl.contains(target)) return;
      if (target.closest('.cdh-glass-overlay, [role="listbox"]')) return;
      e.preventDefault();
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('wheel', handleBackgroundScroll, { passive: false });
    document.addEventListener('touchmove', handleBackgroundScroll, { passive: false });

    return () => {
      window.cancelAnimationFrame(rafId);
      vv?.removeEventListener('resize', syncVisualViewport);
      vv?.removeEventListener('scroll', syncVisualViewport);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('wheel', handleBackgroundScroll);
      document.removeEventListener('touchmove', handleBackgroundScroll);
      openModalCounter = Math.max(0, openModalCounter - 1);
      if (openModalCounter === 0) {
        document.body.style.overflow = previousBodyOverflow;
        document.documentElement.style.overflow = previousHtmlOverflow;
        document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
        document.documentElement.style.removeProperty('--cdh-vv-bottom');
        document.documentElement.style.removeProperty('--cdh-vv-height');
      }
      if (opener && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [isOpen, initialFocusRef]);

  return dialogRef;
}
