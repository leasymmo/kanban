import { startTransition, useEffect, useState } from 'react';

/**
 * Monte progressivement de grandes listes en petits lots via requestAnimationFrame
 * + startTransition afin d'éviter les tâches longues (>50 ms) et optimiser le TBT.
 */
export function useProgressiveRenderLimit(
  totalCount: number,
  initialCount: number,
  stepCount: number,
  forceAll: boolean = false
): number {
  const [limit, setLimit] = useState<number>(() =>
    forceAll || totalCount <= initialCount ? Number.POSITIVE_INFINITY : initialCount
  );

  useEffect(() => {
    if (forceAll || totalCount <= initialCount) {
      setLimit(Number.POSITIVE_INFINITY);
      return;
    }

    if (limit >= totalCount) {
      if (limit !== Number.POSITIVE_INFINITY) {
        setLimit(Number.POSITIVE_INFINITY);
      }
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      startTransition(() => {
        setLimit((prev) => {
          const next = prev + stepCount;
          return next >= totalCount ? Number.POSITIVE_INFINITY : next;
        });
      });
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [totalCount, initialCount, stepCount, forceAll, limit]);

  return forceAll || totalCount <= initialCount ? Number.POSITIVE_INFINITY : limit;
}
