import { TaskStatus } from '../types';

export type TaskHaloTone = 'accent' | 'todo' | 'progress' | 'success' | 'warning' | 'danger';
export type TaskTransitionMode = 'appear' | 'move' | 'update' | 'disappear';

const HALO_CLASSES = [
  'cdh-task-halo',
  'cdh-task-halo--accent',
  'cdh-task-halo--todo',
  'cdh-task-halo--progress',
  'cdh-task-halo--success',
  'cdh-task-halo--warning',
  'cdh-task-halo--danger',
] as const;

const haloTimers = new WeakMap<HTMLElement, number>();
const enterTimers = new WeakMap<HTMLElement, number>();

export function getToneForStatus(status?: TaskStatus | 'pending' | null): TaskHaloTone {
  switch (status) {
    case 'done':
      return 'success';
    case 'in_progress':
      return 'progress';
    case 'blocked':
      return 'danger';
    case 'todo':
    case 'pending':
      return 'todo';
    default:
      return 'accent';
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
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

/**
 * Capture synchrone O(1) de la position et d'un clone léger avant mutation DOM.
 */
export interface TaskDepartureSnapshot {
  rect: DOMRect;
  clone: HTMLElement | null;
}

export function captureTaskSnapshot(taskId: number): TaskDepartureSnapshot | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector<HTMLElement>(`[data-task-card-id="${taskId}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (!isRectInViewport(rect)) return null;

  let clone: HTMLElement | null = null;
  if (!prefersReducedMotion()) {
    clone = el.cloneNode(true) as HTMLElement;
    clone.removeAttribute('data-task-card-id');
    clone.setAttribute('aria-hidden', 'true');
  }
  return { rect, clone };
}

/**
 * Déclenche un halo lumineux Liquid Glass GPU-only sur un élément cible (ré-entrant).
 */
export function triggerHaloOnElement(el: HTMLElement, tone: TaskHaloTone = 'accent'): void {
  const prevTimer = haloTimers.get(el);
  if (prevTimer !== undefined) {
    window.clearTimeout(prevTimer);
  }

  el.classList.remove(...HALO_CLASSES);
  // Reflow ciblé sur un seul nœud pour permettre le redémarrage propre lors de clics rapides
  void el.offsetWidth;
  el.classList.add('cdh-task-halo', `cdh-task-halo--${tone}`);

  const durationMs = prefersReducedMotion() ? 480 : 980;
  const timer = window.setTimeout(() => {
    el.classList.remove(...HALO_CLASSES);
    haloTimers.delete(el);
  }, durationMs);
  haloTimers.set(el, timer);
}

function triggerEnterOnElement(el: HTMLElement): void {
  if (prefersReducedMotion()) return;
  const prevTimer = enterTimers.get(el);
  if (prevTimer !== undefined) {
    window.clearTimeout(prevTimer);
  }
  el.classList.remove('cdh-task-enter');
  void el.offsetWidth;
  el.classList.add('cdh-task-enter');

  const timer = window.setTimeout(() => {
    el.classList.remove('cdh-task-enter');
    enterTimers.delete(el);
  }, 240);
  enterTimers.set(el, timer);
}

/**
 * Affiche un bref écho sortant GPU à la position quittée lorsque la carte disparaît ou change de conteneur.
 */
function spawnDepartureGhost(snapshot: TaskDepartureSnapshot, tone: TaskHaloTone): void {
  if (prefersReducedMotion() || !snapshot.clone || typeof document === 'undefined') return;
  const { rect, clone } = snapshot;

  clone.classList.remove(...HALO_CLASSES, 'cdh-task-enter');
  clone.classList.add('cdh-task-ghost', 'cdh-task-halo', `cdh-task-halo--${tone}`);
  clone.style.top = `${rect.top}px`;
  clone.style.left = `${rect.left}px`;
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;

  document.body.appendChild(clone);
  window.setTimeout(() => {
    clone.remove();
  }, 240);
}

export function pulseTargetSelector(selector: string, tone: TaskHaloTone = 'accent'): void {
  if (typeof document === 'undefined') return;
  window.requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) {
      triggerHaloOnElement(el, tone);
    }
  });
}

/**
 * Orchestre le retour visuel après commit React :
 * - FLIP O(1) si la carte reste visible et glisse dans la même colonne/liste
 * - Écho sortant + entrée douce si la carte change de conteneur ou disparaît
 * - Halo lumineux Liquid Glass sur la cible (ou sur le repli si accordéon/colonne masqué)
 */
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
        spawnDepartureGhost(snapshot, tone);
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
      const nextRect = el.getBoundingClientRect();
      const dx = snapshot.rect.left - nextRect.left;
      const dy = snapshot.rect.top - nextRect.top;
      const sameColumnVerticalMove =
        Math.abs(dx) < 60 && Math.abs(dy) > 3 && Math.abs(dy) < 700;

      if (sameColumnVerticalMove && !prefersReducedMotion() && typeof el.animate === 'function') {
        el.animate(
          [
            { transform: `translate3d(${dx}px, ${dy}px, 0)` },
            { transform: 'translate3d(0, 0, 0)' },
          ],
          {
            duration: 220,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          }
        );
      } else if (Math.abs(dx) >= 60 || Math.abs(dy) >= 700) {
        spawnDepartureGhost(snapshot, tone);
        triggerEnterOnElement(el);
      }
      triggerHaloOnElement(el, tone);
      return;
    }

    triggerHaloOnElement(el, tone);
  });
}
