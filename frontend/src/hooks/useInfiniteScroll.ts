import { RefObject, useEffect, useRef } from 'react';

interface UseInfiniteScrollOptions {
  /** Conteneur scrollable parent (null = viewport document). */
  rootRef?: RefObject<HTMLElement | null>;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void | Promise<unknown>;
  enabled?: boolean;
  /** Marge de préchargement anticipé avant le bas visible. */
  rootMargin?: string;
}

/**
 * Hook réutilisable d'infinite scroll basé sur IntersectionObserver :
 * précharge automatiquement la page suivante à l'approche du bas du conteneur
 * et empêche les déclenchements simultanés en double.
 */
export function useInfiniteScroll({
  rootRef,
  hasMore,
  isLoading,
  onLoadMore,
  enabled = true,
  rootMargin = '260px 0px',
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  const inFlightRef = useRef(false);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    if (!isLoading) {
      inFlightRef.current = false;
    }
  }, [isLoading]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!enabled || !hasMore || !sentinel || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const triggerLoad = () => {
      if (isLoading || inFlightRef.current) return;
      inFlightRef.current = true;
      Promise.resolve(onLoadMoreRef.current()).finally(() => {
        inFlightRef.current = false;
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            triggerLoad();
            break;
          }
        }
      },
      {
        root: rootRef?.current ?? null,
        rootMargin,
        threshold: 0,
      }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [enabled, hasMore, isLoading, rootRef, rootMargin]);

  return sentinelRef;
}
