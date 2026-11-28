import { useEffect, useLayoutEffect, useRef } from 'react';

let openModalCounter = 0;
let previousBodyOverflow = '';
let previousHtmlOverflow = '';
let previousHtmlOverscroll = '';
const modalStack: symbol[] = [];

const FIRST_FIELD_SELECTOR = [
  'input:not([disabled]):not([type="hidden"])',
  'textarea:not([disabled])',
  'select:not([disabled])',
].join(', ');

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

interface UseModalDialogOptions {
  isOpen: boolean;
  onClose: () => void;
  canClose?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Gère l'accessibilité et l'ergonomie d'une modale :
 * - Fermeture via Échap (strictement sur la modale au sommet de la pile)
 * - Verrouillage du scroll du body (compatible modales empilées)
 * - Focus initial à l'ouverture, piège Tab/Shift+Tab interne et restauration du focus à la fermeture
 */
export function useModalDialog<T extends HTMLElement = HTMLDivElement>({
  isOpen,
  onClose,
  canClose = true,
  initialFocusRef,
}: UseModalDialogOptions) {
  const dialogRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  const canCloseRef = useRef(canClose);

  useLayoutEffect(() => {
    onCloseRef.current = onClose;
    canCloseRef.current = canClose;
  });

  useEffect(() => {
    if (!isOpen) return;

    const modalToken = Symbol('modal');
    modalStack.push(modalToken);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialogElSnapshot = dialogRef.current;

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

    let focusScrollTimer: number | null = null;

    const scrollFocusedFieldInModal = () => {
      const dialogEl = dialogRef.current;
      const activeEl = document.activeElement;
      if (
        !dialogEl ||
        !(activeEl instanceof HTMLElement) ||
        !dialogEl.contains(activeEl) ||
        !activeEl.matches('input, textarea, select')
      ) {
        return;
      }

      let scrollParent: HTMLElement | null = activeEl.parentElement;
      while (scrollParent && scrollParent !== dialogEl) {
        const style = window.getComputedStyle(scrollParent);
        const isScrollableY =
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          scrollParent.scrollHeight > scrollParent.clientHeight + 2;
        if (isScrollableY) break;
        scrollParent = scrollParent.parentElement;
      }

      if (!scrollParent || scrollParent === dialogEl) return;

      const containerRect = scrollParent.getBoundingClientRect();
      const fieldRect = activeEl.getBoundingClientRect();
      const isOutOfComfortZone =
        fieldRect.top < containerRect.top + 12 || fieldRect.bottom > containerRect.bottom - 16;

      if (!isOutOfComfortZone) return;

      const offsetInContainer = fieldRect.top - containerRect.top + scrollParent.scrollTop;
      const targetTop = Math.max(
        0,
        offsetInContainer - (containerRect.height - fieldRect.height) / 2
      );
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      scrollParent.scrollTo({
        top: targetTop,
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
    };

    const syncVisualViewport = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const keyboardBottom = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
      document.documentElement.style.setProperty('--cdh-vv-bottom', `${keyboardBottom}px`);
      document.documentElement.style.setProperty('--cdh-vv-height', `${Math.round(vv.height)}px`);

      if (keyboardBottom > 40) {
        window.requestAnimationFrame(scrollFocusedFieldInModal);
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLElement) || !target.matches('input, textarea, select')) return;
      window.requestAnimationFrame(scrollFocusedFieldInModal);
      if (focusScrollTimer !== null) {
        window.clearTimeout(focusScrollTimer);
      }
      focusScrollTimer = window.setTimeout(scrollFocusedFieldInModal, 280);
    };

    syncVisualViewport();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', syncVisualViewport);
    vv?.addEventListener('scroll', syncVisualViewport);
    dialogElSnapshot?.addEventListener('focusin', handleFocusIn);

    const isTopModal = () => modalStack[modalStack.length - 1] === modalToken;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTopModal()) return;

      if (e.key === 'Escape') {
        if (canCloseRef.current) {
          e.preventDefault();
          e.stopImmediatePropagation();
          onCloseRef.current();
        }
        return;
      }

      if (e.key !== 'Tab') return;
      const dialogEl = dialogRef.current;
      if (!dialogEl) return;

      const focusables = Array.from(dialogEl.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.getClientRects().length > 0 || el === document.activeElement
      );

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
      if (!isTopModal()) return;
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
      const idx = modalStack.lastIndexOf(modalToken);
      if (idx !== -1) modalStack.splice(idx, 1);

      window.cancelAnimationFrame(rafId);
      if (focusScrollTimer !== null) {
        window.clearTimeout(focusScrollTimer);
      }
      vv?.removeEventListener('resize', syncVisualViewport);
      vv?.removeEventListener('scroll', syncVisualViewport);
      dialogElSnapshot?.removeEventListener('focusin', handleFocusIn);
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
