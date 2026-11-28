import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, isAbortError, isNetworkError } from '../api/client';
import {
  PaginatedQuestionsResponse,
  PaginationMeta,
  Question,
  QuestionAnswersFilter,
  QuestionDecisionFilter,
  QuestionFacets,
  QuestionSortKey,
} from '../types';
import {
  buildQuestionQueryParams,
  QuestionQueryCriteria,
  serializeQuestionCriteriaSignature,
} from '../utils/paginationParams';

const EMPTY_FACETS: QuestionFacets = {
  counts_by_user_id: {},
  summary: { total: 0, decided: 0, undecided: 0 },
};

const EMPTY_PAGINATION: PaginationMeta = {
  limit: 20,
  has_more: false,
  has_previous: false,
  next_cursor: null,
  previous_cursor: null,
  total: 0,
};

function mergeUniqueQuestions(existing: Question[], incoming: Question[]): Question[] {
  if (incoming.length === 0) return existing;
  const byId = new Map<number, Question>();
  for (const q of incoming) {
    byId.set(q.id, q);
  }
  const seen = new Set<number>();
  const next: Question[] = [];
  for (const q of existing) {
    seen.add(q.id);
    next.push(byId.get(q.id) ?? q);
  }
  for (const q of incoming) {
    if (!seen.has(q.id)) {
      seen.add(q.id);
      next.push(q);
    }
  }
  return next;
}

interface UsePaginatedQuestionsOptions {
  sprintId: number | null;
  enabled: boolean;
  onError?: (msg: string) => void;
}

export function usePaginatedQuestions({
  sprintId,
  enabled,
  onError,
}: UsePaginatedQuestionsOptions) {
  const [userFilter, setUserFilter] = useState<'me' | 'all' | number>('me');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [decisionStatus, setDecisionStatus] = useState<QuestionDecisionFilter>('all');
  const [hasAnswers, setHasAnswers] = useState<QuestionAnswersFilter>('all');
  const [answeredByMe, setAnsweredByMe] = useState<boolean | null>(null);
  const [sortBy, setSortBy] = useState<QuestionSortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(EMPTY_PAGINATION);
  const [facets, setFacets] = useState<QuestionFacets>(EMPTY_FACETS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed === debouncedSearch.trim()) return;
    if (trimmed === '') {
      setDebouncedSearch('');
      return;
    }
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [searchQuery, debouncedSearch]);

  const criteria = useMemo<QuestionQueryCriteria | null>(() => {
    if (!sprintId) return null;
    return {
      sprintId,
      userFilter,
      search: debouncedSearch,
      decisionStatus,
      hasAnswers,
      answeredByMe,
      sortBy,
      sortDir,
    };
  }, [sprintId, userFilter, debouncedSearch, decisionStatus, hasAnswers, answeredByMe, sortBy, sortDir]);

  const signature = useMemo(
    () => (criteria ? serializeQuestionCriteriaSignature(criteria) : ''),
    [criteria]
  );

  const activeSignatureRef = useRef('');
  const lastCompletedSignatureRef = useRef('');
  const mainAbortRef = useRef<AbortController | null>(null);
  const moreAbortRef = useRef<AbortController | null>(null);
  const inFlightMoreRef = useRef(false);

  const criteriaRef = useRef(criteria);
  criteriaRef.current = criteria;
  const paginationRef = useRef(pagination);
  paginationRef.current = pagination;
  activeSignatureRef.current = signature;

  const hydrateFromServerPayload = useCallback(
    (payload: PaginatedQuestionsResponse, usedCriteria: QuestionQueryCriteria) => {
      mainAbortRef.current?.abort();
      moreAbortRef.current?.abort();
      inFlightMoreRef.current = false;
      setIsLoadingMore(false);

      lastCompletedSignatureRef.current = serializeQuestionCriteriaSignature(usedCriteria);
      setQuestions(payload.data || []);
      setPagination(payload.pagination || EMPTY_PAGINATION);
      if (payload.facets) {
        setFacets(payload.facets);
      }
      setIsLoading(false);
    },
    []
  );

  const resetStore = useCallback(() => {
    mainAbortRef.current?.abort();
    moreAbortRef.current?.abort();
    inFlightMoreRef.current = false;
    lastCompletedSignatureRef.current = '';
    setQuestions([]);
    setPagination(EMPTY_PAGINATION);
    setFacets(EMPTY_FACETS);
    setIsLoading(false);
    setIsLoadingMore(false);
  }, []);

  const fetchFirstPage = useCallback(
    async (crit: QuestionQueryCriteria, sig: string) => {
      mainAbortRef.current?.abort();
      moreAbortRef.current?.abort();
      inFlightMoreRef.current = false;
      setIsLoadingMore(false);

      const controller = new AbortController();
      mainAbortRef.current = controller;
      setIsLoading(true);

      try {
        const res = await api.getQuestions(buildQuestionQueryParams(crit), controller.signal);
        if (activeSignatureRef.current !== sig) return;
        setQuestions(res.data || []);
        setPagination(res.pagination || EMPTY_PAGINATION);
        if (res.facets) {
          setFacets(res.facets);
        }
        lastCompletedSignatureRef.current = sig;
      } catch (err: any) {
        if (isAbortError(err)) return;
        if (!isNetworkError(err)) {
          onError?.(err?.message || 'Impossible de charger les questions.');
        }
      } finally {
        if (mainAbortRef.current === controller) {
          mainAbortRef.current = null;
          setIsLoading(false);
        }
      }
    },
    [onError]
  );

  useEffect(() => {
    if (!enabled || !criteria || !signature) return;
    if (lastCompletedSignatureRef.current === signature) {
      return;
    }
    fetchFirstPage(criteria, signature);
    return () => {
      mainAbortRef.current?.abort();
    };
  }, [enabled, criteria, signature, fetchFirstPage]);

  const reloadCurrent = useCallback(async () => {
    const crit = criteriaRef.current;
    if (!crit) return;
    await fetchFirstPage(crit, activeSignatureRef.current);
  }, [fetchFirstPage]);

  const loadMore = useCallback(async () => {
    const crit = criteriaRef.current;
    const sig = activeSignatureRef.current;
    const pag = paginationRef.current;
    if (!crit || !pag.has_more || !pag.next_cursor || inFlightMoreRef.current) return;

    inFlightMoreRef.current = true;
    setIsLoadingMore(true);

    const controller = new AbortController();
    moreAbortRef.current = controller;

    try {
      const res = await api.getQuestions(
        {
          ...buildQuestionQueryParams(crit),
          cursor: pag.next_cursor,
          include_facets: 0,
        },
        controller.signal
      );

      if (activeSignatureRef.current !== sig) return;

      setQuestions((prev) => mergeUniqueQuestions(prev, res.data || []));
      setPagination((prev) => ({
        ...res.pagination,
        total: res.pagination.total ?? prev.total,
      }));
    } catch (err: any) {
      if (isAbortError(err)) return;
      if (!isNetworkError(err)) {
        onError?.(err?.message || 'Erreur lors du chargement des questions suivantes.');
      }
    } finally {
      if (moreAbortRef.current === controller) {
        moreAbortRef.current = null;
      }
      inFlightMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [onError]);

  const refreshFacetsSilently = useCallback(async () => {
    const crit = criteriaRef.current;
    if (!crit) return;
    try {
      const res = await api.getQuestions({
        ...buildQuestionQueryParams(crit),
        limit: 1,
        include_facets: 1,
      });
      if (res.facets && activeSignatureRef.current === serializeQuestionCriteriaSignature(crit)) {
        setFacets(res.facets);
      }
    } catch {
      // Ignore silent background refresh errors
    }
  }, []);

  const insertCreatedQuestion = useCallback(
    (created: Question, currentUserId?: number) => {
      const crit = criteriaRef.current;
      const resolvedTargetUid =
        crit?.userFilter === 'me'
          ? currentUserId
          : typeof crit?.userFilter === 'number'
          ? crit.userFilter
          : null;
      const matchesUser =
        !crit || crit.userFilter === 'all' || (resolvedTargetUid != null && created.user_id === resolvedTargetUid);

      if (matchesUser) {
        setQuestions((prev) =>
          crit?.sortBy === 'created_at' && crit.sortDir === 'desc'
            ? mergeUniqueQuestions([created], prev)
            : mergeUniqueQuestions(prev, [created])
        );
      }
      refreshFacetsSilently();
    },
    [refreshFacetsSilently]
  );

  const patchQuestionInStore = useCallback(
    (questionId: number, updater: (q: Question) => Question) => {
      setQuestions((prev) => prev.map((q) => (q.id === questionId ? updater(q) : q)));
    },
    []
  );

  const removeQuestionFromStore = useCallback(
    (questionId: number) => {
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      refreshFacetsSilently();
    },
    [refreshFacetsSilently]
  );

  const handleSelectSort = useCallback(
    (nextKey: QuestionSortKey) => {
      if (sortBy === nextKey) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(nextKey);
        setSortDir(nextKey === 'answers_count' ? 'desc' : 'asc');
      }
    },
    [sortBy]
  );

  const handleToggleSortDir = useCallback(() => {
    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
  }, []);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setDebouncedSearch('');
    setDecisionStatus('all');
    setHasAnswers('all');
    setAnsweredByMe(null);
  }, []);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    decisionStatus !== 'all' ||
    hasAnswers !== 'all' ||
    answeredByMe !== null;

  return {
    questions,
    setQuestions,
    pagination,
    facets,
    isLoading,
    isLoadingMore,
    userFilter,
    setUserFilter,
    searchQuery,
    setSearchQuery,
    decisionStatus,
    setDecisionStatus,
    hasAnswers,
    setHasAnswers,
    answeredByMe,
    setAnsweredByMe,
    sortBy,
    sortDir,
    handleSelectSort,
    handleToggleSortDir,
    resetFilters,
    hasActiveFilters,
    hydrateFromServerPayload,
    resetStore,
    reloadCurrent,
    loadMore,
    refreshFacetsSilently,
    insertCreatedQuestion,
    patchQuestionInStore,
    removeQuestionFromStore,
  };
}
