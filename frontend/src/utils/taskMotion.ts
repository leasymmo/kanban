import { TaskStatus } from '../types';

export type TaskHaloTone = 'accent';
export type TaskTransitionMode = 'appear' | 'move' | 'update' | 'disappear';

const haloTimers = new WeakMap<HTMLElement, number>();
const flipAnimations = new WeakMap<HTMLElement, Animation>();
const enterAnimations = new WeakMap<HTMLElement, Animation>();

/**
 * Conserve un point d'extension unique ; le halo reste volontairement bleu Liquid Glass
 * afin de ne jamais entrer en conflit visuel avec l'or des étoiles ou les statuts.
 */
export function getToneForStatus(_status?: TaskStatus | 'pending' | null): TaskHaloTone {
  return 'accent';
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function getScrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}

function isRectInViewport(rect: DOMRect): boolean {
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom >= 0 &&
    rect.right >= 0 &&
    rect.top <= window.innerHeight &&
    rect.left <= window.innerWidth
  );
}

function isVisibleInScrollAncestors(el: HTMLElement, rect: DOMRect): boolean {
  if (!isRectInViewport(rect)) return false;

  let parent = el.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const style = window.getComputedStyle(parent);
    const clipsY =
      style.overflowY === 'auto' ||
      style.overflowY === 'scroll' ||
      style.overflowY === 'hidden' ||
      style.overflowY === 'clip';
    const clipsX =
      style.overflowX === 'auto' ||
      style.overflowX === 'scroll' ||
      style.overflowX === 'hidden' ||
      style.overflowX === 'clip';

    if (clipsY || clipsX) {
      const pRect = parent.getBoundingClientRect();
      if (clipsY && (rect.bottom <= pRect.top || rect.top >= pRect.bottom)) return false;
      if (clipsX && (rect.right <= pRect.left || rect.left >= pRect.right)) return false;
    }
    parent = parent.parentElement;
  }

  return true;
}

export interface TaskDepartureSnapshot {
  rect: DOMRect;
  clone: HTMLElement | null;
}

/**
 * Capture synchrone O(1) de la position et d'un clone visuel si la carte est visible à l'écran.
 */
export function captureTaskSnapshot(taskId: number): TaskDepartureSnapshot | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector<HTMLElement>(`[data-task-card-id="${taskId}"]`);
  if (!el) return null;

  const rect = el.getBoundingClientRect();
  if (!isVisibleInScrollAncestors(el, rect)) return null;

  let clone: HTMLElement | null = null;
  if (!prefersReducedMotion()) {
    clone = el.cloneNode(true) as HTMLElement;
    clone.removeAttribute('data-task-card-id');
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
    clone.setAttribute('aria-hidden', 'true');
  }
  return { rect, clone };
}

/**
 * Déclenche une onde lumineuse Liquid Glass interne sans double bordure ni reflow forcé.
 */
export function triggerHaloOnElement(el: HTMLElement, _tone: TaskHaloTone = 'accent'): void {
  const prevTimer = haloTimers.get(el);
  if (prevTimer !== undefined) {
    window.clearTimeout(prevTimer);
  }

  const wasActive = el.classList.contains('cdh-task-halo');
  el.classList.add('cdh-task-halo');

  if (wasActive) {
    const haloAnim =
      typeof el.getAnimations === 'function'
        ? el.getAnimations({ subtree: true }).find(
            (anim) => (anim as CSSAnimation).animationName === 'cdh-halo-fade'
          )
        : undefined;

    if (haloAnim) {
      haloAnim.currentTime = 0;
      haloAnim.play();
    } else {
      el.classList.remove('cdh-task-halo');
      window.requestAnimationFrame(() => {
        if (el.isConnected) el.classList.add('cdh-task-halo');
      });
    }
  }

  const durationMs = prefersReducedMotion() ? 450 : 750;
  const timer = window.setTimeout(() => {
    el.classList.remove('cdh-task-halo');
    haloTimers.delete(el);
  }, durationMs);
  haloTimers.set(el, timer);
}

function triggerEnterOnElement(el: HTMLElement): void {
  if (prefersReducedMotion() || typeof el.animate !== 'function') return;

  enterAnimations.get(el)?.cancel();
  const anim = el.animate(
    [
      { opacity: 0.35, transform: 'translate3d(0, 4px, 0) scale(0.975)' },
      { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
    ],
    {
      duration: 210,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    }
  );
  enterAnimations.set(el, anim);

  const cleanup = () => {
    if (enterAnimations.get(el) === anim) enterAnimations.delete(el);
  };
  anim.finished.then(cleanup, cleanup);
}

function spawnDepartureGhost(snapshot: TaskDepartureSnapshot): void {
  if (prefersReducedMotion() || !snapshot.clone || typeof document === 'undefined') return;
  const { rect, clone } = snapshot;

  clone.classList.remove('cdh-task-halo');
  clone.classList.add('cdh-task-ghost');
  clone.style.top = `${rect.top}px`;
  clone.style.left = `${rect.left}px`;
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;

  document.body.appendChild(clone);

  if (typeof clone.animate === 'function') {
    const anim = clone.animate(
      [
        { opacity: 0.72, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(0.96)' },
      ],
      {
        duration: 200,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'forwards',
      }
    );
    const removeClone = () => clone.remove();
    anim.finished.then(removeClone, removeClone);
  } else {
    window.setTimeout(() => clone.remove(), 210);
  }
}

export function scheduleTaskMotionFeedback(options: {
  taskId: number;
  tone?: TaskHaloTone;
  mode: TaskTransitionMode;
  snapshot?: TaskDepartureSnapshot | null;
  fallbackSelector?: string | null;
}): void {
  if (typeof window === 'undefined') return;
  const { taskId, tone = 'accent', mode, snapshot = null, fallbackSelector = null } = options;

  window.requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(`[data-task-card-id="${taskId}"]`);

    if (!el || mode === 'disappear') {
      if (snapshot) {
        spawnDepartureGhost(snapshot);
      }
      if (fallbackSelector) {
        const fallbackEl = document.querySelector<HTMLElement>(fallbackSelector);
        if (fallbackEl) {
          triggerHaloOnElement(fallbackEl, tone);
        }
      }
      return;
    }

    if (mode === 'appear') {
      triggerEnterOnElement(el);
      triggerHaloOnElement(el, tone);
      return;
    }

    if (mode === 'move' && snapshot) {
      const prevFlip = flipAnimations.get(el);
      if (prevFlip) {
        prevFlip.cancel();
        flipAnimations.delete(el);
      }

      const nextRect = el.getBoundingClientRect();
      const dx = snapshot.rect.left - nextRect.left;
      const dy = snapshot.rect.top - nextRect.top;
      const sameColumnVerticalMove =
        Math.abs(dx) < 60 && Math.abs(dy) > 3 && Math.abs(dy) < 900;

      if (sameColumnVerticalMove && !prefersReducedMotion() && typeof el.animate === 'function') {
        const anim = el.animate(
          [
            { transform: `translate3d(${dx}px, ${dy}px, 0)` },
            { transform: 'translate3d(0, 0, 0)' },
          ],
          {
            duration: 220,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          }
        );
        flipAnimations.set(el, anim);
        const cleanup = () => {
          if (flipAnimations.get(el) === anim) flipAnimations.delete(el);
        };
        anim.finished.then(cleanup, cleanup);
      } else if (Math.abs(dx) >= 60 || Math.abs(dy) >= 900) {
        spawnDepartureGhost(snapshot);
        triggerEnterOnElement(el);
      }
      triggerHaloOnElement(el, tone);
      return;
    }

    triggerHaloOnElement(el, tone);
  });
}
