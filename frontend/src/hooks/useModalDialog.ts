import { useEffect, useRef } from 'react';

let openModalCounter = 0;
let previousBodyOverflow = '';

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
      document.body.style.overflow = 'hidden';
    }
    openModalCounter += 1;

    const rafId = window.requestAnimationFrame(() => {
      const target = initialFocusRef?.current;
      if (target && document.contains(target)) {
        target.focus({ preventScroll: true });
        return;
      }
      const dialogEl = dialogRef.current;
      if (!dialogEl) return;
      const firstFocusable = dialogEl.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (firstFocusable) {
        firstFocusable.focus({ preventScroll: true });
      } else {
        dialogEl.focus({ preventScroll: true });
      }
    });

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

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', handleKeyDown, true);
      openModalCounter = Math.max(0, openModalCounter - 1);
      if (openModalCounter === 0) {
        document.body.style.overflow = previousBodyOverflow;
      }
      if (opener && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [isOpen, initialFocusRef]);

  return dialogRef;
}
