import React, { RefObject } from 'react';
import { Loader2 } from 'lucide-react';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';

interface InfiniteScrollSentinelProps {
  rootRef?: RefObject<HTMLElement | null>;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  loadedCount?: number;
  totalCount?: number | null;
  itemLabel?: string;
}

/**
 * Sentinelle discrète d'infinite scroll réutilisable (colonnes Kanban, logements, vue Tableau & Questions).
 */
export const InfiniteScrollSentinel: React.FC<InfiniteScrollSentinelProps> = React.memo(
  ({
    rootRef,
    hasMore,
    isLoadingMore,
    onLoadMore,
    loadedCount,
    totalCount,
    itemLabel = 'éléments',
  }) => {
    const sentinelRef = useInfiniteScroll({
      rootRef,
      hasMore,
      isLoading: isLoadingMore,
      onLoadMore,
      enabled: hasMore,
    });

    if (!hasMore && !isLoadingMore) {
      return null;
    }

    return (
      <div
        ref={sentinelRef}
        aria-live="polite"
        className="py-2.5 px-2 flex items-center justify-center gap-2 text-[11px] font-medium text-[var(--cdh-text-tertiary)] select-none"
      >
        {isLoadingMore ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--cdh-accent)] shrink-0" strokeWidth={2} />
            <span>Chargement…</span>
          </>
        ) : (
          <button
            type="button"
            onClick={onLoadMore}
            className="px-2.5 py-1 rounded-full bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-surface-control-hover)] text-[var(--cdh-text-secondary)] transition-colors cursor-pointer"
          >
            {typeof loadedCount === 'number' && typeof totalCount === 'number' && totalCount > loadedCount
              ? `Afficher la suite (${loadedCount}/${totalCount} ${itemLabel})`
              : 'Charger la suite'}
          </button>
        )}
      </div>
    );
  }
);

InfiniteScrollSentinel.displayName = 'InfiniteScrollSentinel';
