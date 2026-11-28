import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, isAbortError, isNetworkError } from '../api/client';
import {
  GroupedTasksResponse,
  PaginatedQuestionsResponse,
  PaginatedTasksResponse,
  PaginationMeta,
  Question,
  SprintMeetingSummary,
  Task,
  TaskGroupPage,
} from '../types';

export const EMPTY_MEETING_SUMMARY: SprintMeetingSummary = {
  active_total: 0,
  done_count: 0,
  carry_over_count: 0,
  pending_assigned_count: 0,
  pending_unassigned_count: 0,
  questions_total: 0,
  decided_questions_count: 0,
  undecided_questions_count: 0,
  per_user_tasks: {},
  per_user_questions: {},
};

const EMPTY_PAGINATION: PaginationMeta = {
  limit: 30,
  has_more: false,
  has_previous: false,
  next_cursor: null,
  previous_cursor: null,
  total: 0,
};

function mergeById<T extends { id: number }>(existing: T[], incoming: T[]): T[] {
  if (incoming.length === 0) return existing;
  const map = new Map<number, T>();
  for (const item of incoming) map.set(item.id, item);
  const seen = new Set<number>();
  const out: T[] = [];
  for (const item of existing) {
    seen.add(item.id);
    out.push(map.get(item.id) ?? item);
  }
  for (const item of incoming) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

interface UseMeetingDataOptions {
  sprintId: number | null;
  enabled: boolean;
  onError?: (msg: string) => void;
}

/**
 * Charge les données paginées de l'onglet Réunion à la demande (Rétrospective par associé,
 * Questions du sprint, Plan d'action pending) et maintient le résumé serveur exact.
 */
export function useMeetingData({ sprintId, enabled, onError }: UseMeetingDataOptions) {
  const [meetingSummary, setMeetingSummary] = useState<SprintMeetingSummary>(EMPTY_MEETING_SUMMARY);
  const [retroGroups, setRetroGroups] = useState<Record<string, TaskGroupPage>>({});
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [pendingPagination, setPendingPagination] = useState<PaginationMeta>(EMPTY_PAGINATION);
  const [meetingQuestions, setMeetingQuestions] = useState<Question[]>([]);
  const [questionsPagination, setQuestionsPagination] = useState<PaginationMeta>(EMPTY_PAGINATION);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingRetroUsers, setLoadingRetroUsers] = useState<Record<string, boolean>>({});
  const [isLoadingMorePending, setIsLoadingMorePending] = useState<boolean>(false);
  const [isLoadingMoreQuestions, setIsLoadingMoreQuestions] = useState<boolean>(false);

  const abortRef = useRef<AbortController | null>(null);
  const loadedSprintRef = useRef<number | null>(null);
  const sprintIdRef = useRef(sprintId);
  sprintIdRef.current = sprintId;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const retroGroupsRef = useRef(retroGroups);
  retroGroupsRef.current = retroGroups;
  const pendingPagRef = useRef(pendingPagination);
  pendingPagRef.current = pendingPagination;
  const questionsPagRef = useRef(questionsPagination);
  questionsPagRef.current = questionsPagination;

  const inFlightRetroRef = useRef<Set<string>>(new Set());
  const inFlightPendingRef = useRef(false);
  const inFlightQuestionsRef = useRef(false);

  const fetchMeetingSnapshot = useCallback(
    async (targetSprintId: number) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoading(true);

      try {
        const [retroRes, pendingRes, questionsRes] = await Promise.all([
          api.getTasks<GroupedTasksResponse>(
            {
              sprint_id: targetSprintId,
              scope: 'board',
              group_by: 'assignee',
              sort_by: 'status',
              sort_direction: 'asc',
              limit: 25,
              include_empty: 1,
            },
            controller.signal
          ),
          api.getTasks<PaginatedTasksResponse>(
            {
              sprint_id: targetSprintId,
              scope: 'meeting',
              status: ['pending'],
              sort_by: 'position',
              sort_direction: 'asc',
              limit: 40,
              include_facets: 0,
            },
            controller.signal
          ),
          api.getQuestions(
            {
              sprint_id: targetSprintId,
              user_id: 'all',
              sort_by: 'user',
              sort_direction: 'asc',
              limit: 40,
              include_facets: 0,
            },
            controller.signal
          ),
        ]);

        if (controller.signal.aborted || sprintIdRef.current !== targetSprintId) return;

        setRetroGroups(retroRes.groups || {});
        setPendingTasks(pendingRes.data || []);
        setPendingPagination(pendingRes.pagination || EMPTY_PAGINATION);
        setMeetingQuestions(questionsRes.data || []);
        setQuestionsPagination(questionsRes.pagination || EMPTY_PAGINATION);
        loadedSprintRef.current = targetSprintId;
      } catch (err: any) {
        if (isAbortError(err)) return;
        if (!isNetworkError(err)) {
          onErrorRef.current?.(err?.message || 'Impossible de charger les données de la réunion.');
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setIsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!enabled || !sprintId) return;
    fetchMeetingSnapshot(sprintId);
    return () => {
      abortRef.current?.abort();
    };
  }, [enabled, sprintId, fetchMeetingSnapshot]);

  const refreshSummary = useCallback(async (targetSprintId?: number) => {
    const sid = targetSprintId ?? sprintIdRef.current;
    if (!sid) return;
    try {
      const res = await api.getSprintSummary(sid);
      if (res.success && sprintIdRef.current === sid) {
        setMeetingSummary(res.meeting_summary);
      }
    } catch {
      // Ignore silent refresh failure
    }
  }, []);

  const loadMoreRetroForUser = useCallback(
    async (userId: number) => {
      const sid = sprintIdRef.current;
      const key = String(userId);
      const grp = retroGroupsRef.current[key];
      if (!sid || !grp || !grp.pagination.has_more || !grp.pagination.next_cursor) return;
      if (inFlightRetroRef.current.has(key)) return;

      inFlightRetroRef.current.add(key);
      setLoadingRetroUsers((p) => ({ ...p, [key]: true }));
      try {
        const res = await api.getTasks<PaginatedTasksResponse>({
          sprint_id: sid,
          scope: 'board',
          assignee_id: userId,
          sort_by: 'status',
          sort_direction: 'asc',
          limit: 25,
          cursor: grp.pagination.next_cursor,
          include_facets: 0,
        });
        if (sprintIdRef.current !== sid) return;
        setRetroGroups((prev) => {
          const cur = prev[key];
          if (!cur) return prev;
          return {
            ...prev,
            [key]: {
              ...cur,
              data: mergeById(cur.data, res.data || []),
              pagination: { ...res.pagination, total: cur.pagination.total },
            },
          };
        });
      } catch (err: any) {
        if (!isNetworkError(err)) {
          onErrorRef.current?.(err?.message || 'Erreur lors du chargement des tâches suivantes.');
        }
      } finally {
        inFlightRetroRef.current.delete(key);
        setLoadingRetroUsers((p) => {
          if (!p[key]) return p;
          const next = { ...p };
          delete next[key];
          return next;
        });
      }
    },
    []
  );

  const loadMorePending = useCallback(async () => {
    const sid = sprintIdRef.current;
    const pag = pendingPagRef.current;
    if (!sid || !pag.has_more || !pag.next_cursor || inFlightPendingRef.current) return;

    inFlightPendingRef.current = true;
    setIsLoadingMorePending(true);
    try {
      const res = await api.getTasks<PaginatedTasksResponse>({
        sprint_id: sid,
        scope: 'meeting',
        status: ['pending'],
        sort_by: 'position',
        sort_direction: 'asc',
        limit: 40,
        cursor: pag.next_cursor,
        include_facets: 0,
      });
      if (sprintIdRef.current !== sid) return;
      setPendingTasks((prev) => mergeById(prev, res.data || []));
      setPendingPagination(res.pagination || EMPTY_PAGINATION);
    } catch (err: any) {
      if (!isNetworkError(err)) {
        onErrorRef.current?.(err?.message || 'Erreur lors du chargement des tâches en attente.');
      }
    } finally {
      inFlightPendingRef.current = false;
      setIsLoadingMorePending(false);
    }
  }, []);

  const loadMoreMeetingQuestions = useCallback(async () => {
    const sid = sprintIdRef.current;
    const pag = questionsPagRef.current;
    if (!sid || !pag.has_more || !pag.next_cursor || inFlightQuestionsRef.current) return;

    inFlightQuestionsRef.current = true;
    setIsLoadingMoreQuestions(true);
    try {
      const res = await api.getQuestions({
        sprint_id: sid,
        user_id: 'all',
        sort_by: 'user',
        sort_direction: 'asc',
        limit: 40,
        cursor: pag.next_cursor,
        include_facets: 0,
      });
      if (sprintIdRef.current !== sid) return;
      setMeetingQuestions((prev) => mergeById(prev, res.data || []));
      setQuestionsPagination(res.pagination || EMPTY_PAGINATION);
    } catch (err: any) {
      if (!isNetworkError(err)) {
        onErrorRef.current?.(err?.message || 'Erreur lors du chargement des questions suivantes.');
      }
    } finally {
      inFlightQuestionsRef.current = false;
      setIsLoadingMoreQuestions(false);
    }
  }, []);

  const activeSprintTasks = useMemo(() => {
    const out: Task[] = [];
    for (const grp of Object.values(retroGroups)) {
      out.push(...grp.data);
    }
    return out;
  }, [retroGroups]);

  const allMeetingTasks = useMemo(
    () => mergeById(activeSprintTasks, pendingTasks),
    [activeSprintTasks, pendingTasks]
  );

  const patchMeetingTask = useCallback((taskId: number, updater: (t: Task) => Task) => {
    setPendingTasks((prev) => prev.map((t) => (t.id === taskId ? updater(t) : t)));
    setRetroGroups((prev) => {
      let touched = false;
      const next: Record<string, TaskGroupPage> = {};
      for (const [k, grp] of Object.entries(prev)) {
        const idx = grp.data.findIndex((t) => t.id === taskId);
        if (idx === -1) {
          next[k] = grp;
        } else {
          touched = true;
          const copy = [...grp.data];
          copy[idx] = updater(copy[idx]);
          next[k] = { ...grp, data: copy };
        }
      }
      return touched ? next : prev;
    });
  }, []);

  const removeMeetingTask = useCallback((taskId: number) => {
    setPendingTasks((prev) => prev.filter((t) => t.id !== taskId));
    setRetroGroups((prev) => {
      let touched = false;
      const next: Record<string, TaskGroupPage> = {};
      for (const [k, grp] of Object.entries(prev)) {
        if (!grp.data.some((t) => t.id === taskId)) {
          next[k] = grp;
        } else {
          touched = true;
          next[k] = { ...grp, data: grp.data.filter((t) => t.id !== taskId) };
        }
      }
      return touched ? next : prev;
    });
  }, []);

  const insertMeetingTasks = useCallback((createdTasks: Task[]) => {
    const pendingCreated = createdTasks.filter((t) => t.status === 'pending');
    if (pendingCreated.length > 0) {
      setPendingTasks((prev) => mergeById(prev, pendingCreated));
    }
    const activeCreated = createdTasks.filter((t) => t.status !== 'pending' && !!t.assigned_to);
    if (activeCreated.length > 0) {
      setRetroGroups((prev) => {
        const next = { ...prev };
        for (const t of activeCreated) {
          const key = String(t.assigned_to);
          const cur = next[key];
          if (cur) {
            next[key] = { ...cur, data: mergeById(cur.data, [t]) };
          }
        }
        return next;
      });
    }
  }, []);

  const patchMeetingQuestion = useCallback((questionId: number, updater: (q: Question) => Question) => {
    setMeetingQuestions((prev) => prev.map((q) => (q.id === questionId ? updater(q) : q)));
  }, []);

  const insertMeetingQuestion = useCallback((created: Question) => {
    setMeetingQuestions((prev) => mergeById(prev, [created]));
  }, []);

  const removeMeetingQuestion = useCallback((questionId: number) => {
    setMeetingQuestions((prev) => prev.filter((q) => q.id !== questionId));
  }, []);

  const reloadIfActive = useCallback(() => {
    if (enabledRef.current && sprintIdRef.current) {
      fetchMeetingSnapshot(sprintIdRef.current);
    }
  }, [fetchMeetingSnapshot]);

  const resetStore = useCallback(() => {
    abortRef.current?.abort();
    loadedSprintRef.current = null;
    setMeetingSummary(EMPTY_MEETING_SUMMARY);
    setRetroGroups({});
    setPendingTasks([]);
    setPendingPagination(EMPTY_PAGINATION);
    setMeetingQuestions([]);
    setQuestionsPagination(EMPTY_PAGINATION);
  }, []);

  return useMemo(
    () => ({
      meetingSummary,
      setMeetingSummary,
      retroGroups,
      pendingTasks,
      pendingPagination,
      meetingQuestions,
      questionsPagination,
      allMeetingTasks,
      isLoading,
      loadingRetroUsers,
      isLoadingMorePending,
      isLoadingMoreQuestions,
      refreshSummary,
      loadMoreRetroForUser,
      loadMorePending,
      loadMoreMeetingQuestions,
      patchMeetingTask,
      removeMeetingTask,
      insertMeetingTasks,
      patchMeetingQuestion,
      insertMeetingQuestion,
      removeMeetingQuestion,
      reloadIfActive,
      resetStore,
    }),
    [
      meetingSummary,
      retroGroups,
      pendingTasks,
      pendingPagination,
      meetingQuestions,
      questionsPagination,
      allMeetingTasks,
      isLoading,
      loadingRetroUsers,
      isLoadingMorePending,
      isLoadingMoreQuestions,
      refreshSummary,
      loadMoreRetroForUser,
      loadMorePending,
      loadMoreMeetingQuestions,
      patchMeetingTask,
      removeMeetingTask,
      insertMeetingTasks,
      patchMeetingQuestion,
      insertMeetingQuestion,
      removeMeetingQuestion,
      reloadIfActive,
      resetStore,
    ]
  );
}
