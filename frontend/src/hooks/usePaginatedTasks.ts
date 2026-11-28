import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, isAbortError, isNetworkError } from '../api/client';
import {
  GroupedTasksResponse,
  PaginatedTasksResponse,
  PaginationMeta,
  Task,
  TaskFacets,
  TaskGroupPage,
  TaskStatus,
  TasksApiResponse,
} from '../types';
import {
  buildTaskQueryParams,
  serializeTaskCriteriaSignature,
  TaskQueryCriteria,
} from '../utils/paginationParams';
import { TaskViewMode } from '../utils/cookies';

const EMPTY_FACETS: TaskFacets = {
  status_counts: { todo: 0, in_progress: 0, blocked: 0, done: 0, pending: 0 },
  property_counts: {},
  assignee_counts: { all: 0, unassigned: 0, by_user: {} },
  total_matching: 0,
};

const EMPTY_LIST_PAGINATION: PaginationMeta = {
  limit: 30,
  has_more: false,
  has_previous: false,
  next_cursor: null,
  previous_cursor: null,
  total: 0,
};

function mergeUniqueTasks(existing: Task[], incoming: Task[]): Task[] {
  if (incoming.length === 0) return existing;
  const byId = new Map<number, Task>();
  for (const t of incoming) {
    byId.set(t.id, t);
  }
  const seen = new Set<number>();
  const next: Task[] = [];
  for (const t of existing) {
    seen.add(t.id);
    next.push(byId.get(t.id) ?? t);
  }
  for (const t of incoming) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      next.push(t);
    }
  }
  return next;
}

function isGroupedResponse(res: TasksApiResponse): res is GroupedTasksResponse {
  return 'groups' in res && res.groups !== undefined;
}

interface UsePaginatedTasksOptions {
  sprintId: number | null;
  viewMode: TaskViewMode;
  criteria: Omit<TaskQueryCriteria, 'sprintId' | 'viewMode'>;
  enabled: boolean;
  onError?: (msg: string) => void;
}

export function usePaginatedTasks({
  sprintId,
  viewMode,
  criteria,
  enabled,
  onError,
}: UsePaginatedTasksOptions) {
  const [groups, setGroups] = useState<Record<string, TaskGroupPage>>({});
  const [listItems, setListItems] = useState<Task[]>([]);
  const [listPagination, setListPagination] = useState<PaginationMeta>(EMPTY_LIST_PAGINATION);
  const [facets, setFacets] = useState<TaskFacets>(EMPTY_FACETS);
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isLoadingMoreList, setIsLoadingMoreList] = useState<boolean>(false);
  const [loadingMoreColumns, setLoadingMoreColumns] = useState<Record<string, boolean>>({});

  // Debounce uniquement sur la saisie texte de recherche pour rester instantané sur tous les autres filtres
  const [debouncedSearch, setDebouncedSearch] = useState(criteria.search);
  useEffect(() => {
    const trimmed = criteria.search.trim();
    if (trimmed === debouncedSearch.trim()) return;
    if (trimmed === '') {
      setDebouncedSearch('');
      return;
    }
    const timer = window.setTimeout(() => {
      setDebouncedSearch(criteria.search);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [criteria.search, debouncedSearch]);

  const effectiveCriteria = useMemo<TaskQueryCriteria | null>(() => {
    if (!sprintId) return null;
    return {
      ...criteria,
      sprintId,
      viewMode,
      search: debouncedSearch,
    };
  }, [criteria, sprintId, viewMode, debouncedSearch]);

  const querySignature = useMemo(
    () => (effectiveCriteria ? serializeTaskCriteriaSignature(effectiveCriteria) : ''),
    [effectiveCriteria]
  );

  const activeSignatureRef = useRef<string>('');
  const lastCompletedSignatureRef = useRef<string>('');
  const lastLoadedSprintRef = useRef<number | null>(null);
  const mainAbortRef = useRef<AbortController | null>(null);
  const columnAbortRefs = useRef<Map<string, AbortController>>(new Map());
  const listAbortRef = useRef<AbortController | null>(null);
  const inFlightColumnsRef = useRef<Set<string>>(new Set());
  const inFlightListRef = useRef<boolean>(false);

  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const listItemsRef = useRef(listItems);
  listItemsRef.current = listItems;
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const listPaginationRef = useRef(listPagination);
  listPaginationRef.current = listPagination;
  const effectiveCriteriaRef = useRef(effectiveCriteria);
  effectiveCriteriaRef.current = effectiveCriteria;
  activeSignatureRef.current = querySignature;

  const cancelPendingMoreRequests = useCallback(() => {
    columnAbortRefs.current.forEach((ctrl) => ctrl.abort());
    columnAbortRefs.current.clear();
    inFlightColumnsRef.current.clear();
    setLoadingMoreColumns({});
    listAbortRef.current?.abort();
    listAbortRef.current = null;
    inFlightListRef.current = false;
    setIsLoadingMoreList(false);
  }, []);

  const applyResponsePayload = useCallback(
    (res: TasksApiResponse, targetViewMode: TaskViewMode) => {
      if (res.facets) {
        setFacets(res.facets);
      }
      if (isGroupedResponse(res)) {
        setGroups(res.groups || {});
        setListItems([]);
        setListPagination(EMPTY_LIST_PAGINATION);
      } else {
        setListItems(res.data || []);
        setListPagination(res.pagination || EMPTY_LIST_PAGINATION);
        if (targetViewMode === 'list') {
          setGroups({});
        }
      }
    },
    []
  );

  /**
   * Permet d'hydrater directement depuis /api/bootstrap ou /api/sprints/{id} sans relancer de fetch.
   */
  const hydrateFromServerPayload = useCallback(
    (payload: TasksApiResponse, usedCriteria: TaskQueryCriteria) => {
      mainAbortRef.current?.abort();
      cancelPendingMoreRequests();
      const sig = serializeTaskCriteriaSignature(usedCriteria);
      lastCompletedSignatureRef.current = sig;
      lastLoadedSprintRef.current = usedCriteria.sprintId;
      applyResponsePayload(payload, usedCriteria.viewMode);
      setIsLoadingInitial(false);
      setIsRefreshing(false);
    },
    [applyResponsePayload, cancelPendingMoreRequests]
  );

  const resetStore = useCallback(() => {
    mainAbortRef.current?.abort();
    cancelPendingMoreRequests();
    lastCompletedSignatureRef.current = '';
    lastLoadedSprintRef.current = null;
    setGroups({});
    setListItems([]);
    setListPagination(EMPTY_LIST_PAGINATION);
    setFacets(EMPTY_FACETS);
    setIsLoadingInitial(false);
    setIsRefreshing(false);
  }, [cancelPendingMoreRequests]);

  const fetchFirstPage = useCallback(
    async (crit: TaskQueryCriteria, sig: string, sprintChanged: boolean) => {
      mainAbortRef.current?.abort();
      cancelPendingMoreRequests();

      const controller = new AbortController();
      mainAbortRef.current = controller;

      if (sprintChanged) {
        setIsLoadingInitial(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const params = buildTaskQueryParams(crit);
        const res = await api.getTasks(params, controller.signal);
        if (activeSignatureRef.current !== sig) return;
        applyResponsePayload(res, crit.viewMode);
        lastLoadedSprintRef.current = crit.sprintId;
        lastCompletedSignatureRef.current = sig;
      } catch (err: any) {
        if (isAbortError(err)) return;
        if (!isNetworkError(err)) {
          onErrorRef.current?.(err?.message || 'Impossible de charger les tâches.');
        }
      } finally {
        if (mainAbortRef.current === controller) {
          mainAbortRef.current = null;
          setIsLoadingInitial(false);
          setIsRefreshing(false);
        }
      }
    },
    [applyResponsePayload, cancelPendingMoreRequests]
  );

  useEffect(() => {
    const crit = effectiveCriteriaRef.current;
    if (!enabled || !crit || !querySignature) return;

    if (lastCompletedSignatureRef.current === querySignature) {
      return;
    }

    const sprintChanged = lastLoadedSprintRef.current !== crit.sprintId;
    fetchFirstPage(crit, querySignature, sprintChanged);

    return () => {
      mainAbortRef.current?.abort();
    };
  }, [enabled, querySignature, fetchFirstPage]);

  const reloadCurrentView = useCallback(async () => {
    const crit = effectiveCriteriaRef.current;
    if (!crit) return;
    await fetchFirstPage(crit, activeSignatureRef.current, false);
  }, [fetchFirstPage]);

  const refreshFacetsSilently = useCallback(async () => {
    const crit = effectiveCriteriaRef.current;
    if (!crit) return;
    try {
      const res = await api.getTasks<PaginatedTasksResponse>({
        ...buildTaskQueryParams(crit),
        group_by: 'none',
        limit: 1,
        include_facets: 1,
      });
      if (res.facets && activeSignatureRef.current === serializeTaskCriteriaSignature(crit)) {
        setFacets(res.facets);
      }
    } catch {
      // Silencieux : les compteurs locaux restent affichés en cas d'échec réseau
    }
  }, []);

  /**
   * Scroll infini indépendant pour une colonne donnée (Kanban status ou Property id).
   */
  const loadMoreColumn = useCallback(
    async (columnKey: string) => {
      const crit = effectiveCriteriaRef.current;
      const sig = activeSignatureRef.current;
      if (!crit || crit.viewMode === 'list') return;

      const group = groupsRef.current[columnKey];
      if (!group || !group.pagination.has_more || !group.pagination.next_cursor) return;
      if (inFlightColumnsRef.current.has(columnKey)) return;

      inFlightColumnsRef.current.add(columnKey);
      setLoadingMoreColumns((prev) => ({ ...prev, [columnKey]: true }));

      const controller = new AbortController();
      columnAbortRefs.current.set(columnKey, controller);

      try {
        const baseParams = buildTaskQueryParams(crit);
        delete baseParams.group_by;
        delete baseParams.include_empty;

        const columnParams =
          crit.viewMode === 'kanban'
            ? { ...baseParams, status: columnKey }
            : { ...baseParams, property_id: columnKey };

        const res = await api.getTasks<PaginatedTasksResponse>(
          {
            ...columnParams,
            cursor: group.pagination.next_cursor,
            include_facets: 0,
          },
          controller.signal
        );

        if (activeSignatureRef.current !== sig) return;

        setGroups((prev) => {
          const current = prev[columnKey];
          if (!current) return prev;
          return {
            ...prev,
            [columnKey]: {
              ...current,
              data: mergeUniqueTasks(current.data, res.data || []),
              pagination: {
                ...res.pagination,
                total: current.pagination.total,
              },
            },
          };
        });
      } catch (err: any) {
        if (isAbortError(err)) return;
        if (!isNetworkError(err)) {
          onErrorRef.current?.(err?.message || 'Erreur lors du chargement de la suite de la colonne.');
        }
      } finally {
        columnAbortRefs.current.delete(columnKey);
        inFlightColumnsRef.current.delete(columnKey);
        setLoadingMoreColumns((prev) => {
          if (!prev[columnKey]) return prev;
          const next = { ...prev };
          delete next[columnKey];
          return next;
        });
      }
    },
    []
  );

  /**
   * Scroll infini global pour la vue Tableau (SprintListBoard).
   */
  const loadMoreList = useCallback(async () => {
    const crit = effectiveCriteriaRef.current;
    const sig = activeSignatureRef.current;
    const pag = listPaginationRef.current;
    if (!crit || crit.viewMode !== 'list') return;
    if (!pag.has_more || !pag.next_cursor || inFlightListRef.current) return;

    inFlightListRef.current = true;
    setIsLoadingMoreList(true);

    const controller = new AbortController();
    listAbortRef.current = controller;

    try {
      const baseParams = buildTaskQueryParams(crit);
      const res = await api.getTasks<PaginatedTasksResponse>(
        {
          ...baseParams,
          group_by: 'none',
          cursor: pag.next_cursor,
          include_facets: 0,
        },
        controller.signal
      );

      if (activeSignatureRef.current !== sig) return;

      setListItems((prev) => mergeUniqueTasks(prev, res.data || []));
      setListPagination((prev) => ({
        ...res.pagination,
        total: res.pagination.total ?? prev.total,
      }));
    } catch (err: any) {
      if (isAbortError(err)) return;
      if (!isNetworkError(err)) {
        onErrorRef.current?.(err?.message || 'Erreur lors du chargement de la page suivante.');
      }
    } finally {
      if (listAbortRef.current === controller) {
        listAbortRef.current = null;
      }
      inFlightListRef.current = false;
      setIsLoadingMoreList(false);
    }
  }, []);

  /**
   * Recherche rapide d'une tâche chargée (toutes colonnes ou liste confondues).
   */
  const loadedTasks = useMemo(() => {
    if (viewMode === 'list') return listItems;
    const merged: Task[] = [];
    const seen = new Set<number>();
    for (const grp of Object.values(groups)) {
      for (const t of grp.data) {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          merged.push(t);
        }
      }
    }
    return merged;
  }, [viewMode, listItems, groups]);

  const findLoadedTask = useCallback((taskId: number): Task | undefined => {
    if (viewModeRef.current === 'list') {
      return listItemsRef.current.find((t) => t.id === taskId);
    }
    for (const grp of Object.values(groupsRef.current)) {
      const hit = grp.data.find((t) => t.id === taskId);
      if (hit) return hit;
    }
    return undefined;
  }, []);

  /**
   * Met à jour une tâche en place dans la vue courante sans réinitialiser la pagination ni le scroll.
   */
  const patchTaskInStore = useCallback((taskId: number, updater: (prev: Task) => Task) => {
    setListItems((prev) => prev.map((t) => (t.id === taskId ? updater(t) : t)));
    setGroups((prev) => {
      let touched = false;
      const next: Record<string, TaskGroupPage> = {};
      for (const [key, grp] of Object.entries(prev)) {
        const idx = grp.data.findIndex((t) => t.id === taskId);
        if (idx === -1) {
          next[key] = grp;
        } else {
          touched = true;
          const updatedData = [...grp.data];
          updatedData[idx] = updater(updatedData[idx]);
          next[key] = { ...grp, data: updatedData };
        }
      }
      return touched ? next : prev;
    });
  }, []);

  /**
   * Déplace une tâche entre colonnes (statut ou logement) ou réordonne dans sa colonne
   * sans la faire disparaître temporairement et en maintenant les compteurs cohérents.
   */
  const moveTaskOptimistic = useCallback(
    (opts: {
      taskId: number;
      targetStatus?: TaskStatus;
      targetPropertyId?: number | null;
      propertyPatch?: { property_name?: string; property_color?: string; property_code?: string };
      orderedColumnIds?: number[];
    }) => {
      const { taskId, targetStatus, targetPropertyId, propertyPatch, orderedColumnIds } = opts;

      const patchTask = (t: Task): Task => ({
        ...t,
        ...(targetStatus !== undefined ? { status: targetStatus } : {}),
        ...(targetPropertyId !== undefined
          ? {
              property_id: targetPropertyId,
              property_name: propertyPatch?.property_name,
              property_color: propertyPatch?.property_color,
              property_code: propertyPatch?.property_code,
            }
          : {}),
      });

      setListItems((prev) => prev.map((t) => (t.id === taskId ? patchTask(t) : t)));

      const currentView = effectiveCriteriaRef.current?.viewMode ?? viewModeRef.current;
      if (currentView === 'list') {
        if (targetStatus !== undefined) {
          const prevTask = listItemsRef.current.find((t) => t.id === taskId);
          if (prevTask && prevTask.status !== targetStatus) {
            setFacets((f) => ({
              ...f,
              status_counts: {
                ...f.status_counts,
                [prevTask.status]: Math.max(0, (f.status_counts[prevTask.status] ?? 0) - 1),
                [targetStatus]: (f.status_counts[targetStatus] ?? 0) + 1,
              },
            }));
          }
        }
        return;
      }

      let foundTask: Task | null = null;
      let srcKey: string | null = null;

      setGroups((prev) => {
        const next: Record<string, TaskGroupPage> = { ...prev };
        for (const [k, grp] of Object.entries(prev)) {
          const hit = grp.data.find((t) => t.id === taskId);
          if (hit) {
            foundTask = hit;
            srcKey = k;
            break;
          }
        }
        if (!foundTask || srcKey === null) return prev;

        const updatedTask = patchTask(foundTask);
        const dstKey =
          currentView === 'kanban'
            ? targetStatus ?? (updatedTask.status as string)
            : targetPropertyId !== undefined
            ? String(targetPropertyId ?? 0)
            : String(updatedTask.property_id ?? 0);

        if (srcKey === dstKey) {
          const curGrp = next[srcKey];
          if (!curGrp) return prev;
          let reordered = curGrp.data.map((t) => (t.id === taskId ? updatedTask : t));
          if (orderedColumnIds && orderedColumnIds.length > 0) {
            const byId = new Map(reordered.map((t) => [t.id, t]));
            const orderedHead: Task[] = [];
            const seen = new Set<number>();
            for (const id of orderedColumnIds) {
              const item = byId.get(id);
              if (item) {
                orderedHead.push(item);
                seen.add(id);
              }
            }
            const rest = reordered.filter((t) => !seen.has(t.id));
            reordered = [...orderedHead, ...rest];
          }
          next[srcKey] = { ...curGrp, data: reordered };
          return next;
        }

        // Retrait de la colonne source
        const srcGrp = next[srcKey];
        if (srcGrp) {
          const prevTotal = srcGrp.pagination.total ?? srcGrp.data.length;
          const prevDone = srcGrp.done_count ?? 0;
          const wasDone = (foundTask as Task).status === 'done';
          next[srcKey] = {
            ...srcGrp,
            data: srcGrp.data.filter((t) => t.id !== taskId),
            done_count: currentView === 'property' ? Math.max(0, prevDone - (wasDone ? 1 : 0)) : srcGrp.done_count,
            pagination: {
              ...srcGrp.pagination,
              total: Math.max(0, prevTotal - 1),
            },
          };
        }

        // Insertion dans la colonne cible (toujours visible même si d'autres pages existent !)
        const dstGrp = next[dstKey];
        if (dstGrp) {
          const withoutDup = dstGrp.data.filter((t) => t.id !== taskId);
          let combined: Task[];
          if (orderedColumnIds && orderedColumnIds.length > 0) {
            const byId = new Map<number, Task>([
              ...withoutDup.map((t) => [t.id, t] as const),
              [taskId, updatedTask],
            ]);
            const orderedHead: Task[] = [];
            const seen = new Set<number>();
            for (const id of orderedColumnIds) {
              const item = byId.get(id);
              if (item) {
                orderedHead.push(item);
                seen.add(id);
              }
            }
            const rest = withoutDup.filter((t) => !seen.has(t.id));
            combined = [...orderedHead, ...rest];
          } else {
            combined = [updatedTask, ...withoutDup];
          }

          const dstPrevTotal = dstGrp.pagination.total ?? dstGrp.data.length;
          const dstPrevDone = dstGrp.done_count ?? 0;
          const isNowDone = updatedTask.status === 'done';
          next[dstKey] = {
            ...dstGrp,
            data: combined,
            done_count: currentView === 'property' ? dstPrevDone + (isNowDone ? 1 : 0) : dstGrp.done_count,
            pagination: {
              ...dstGrp.pagination,
              total: dstPrevTotal + 1,
            },
          };
        }

        return next;
      });

      // Synchroniser les compteurs de facettes locaux immédiatement
      setFacets((prevFacets) => {
        const prevTask = foundTask ?? listItems.find((t) => t.id === taskId);
        if (!prevTask) return prevFacets;
        const nextStatusCounts = { ...prevFacets.status_counts };
        const nextPropCounts = { ...prevFacets.property_counts };

        if (targetStatus !== undefined && prevTask.status !== targetStatus) {
          nextStatusCounts[prevTask.status] = Math.max(0, (nextStatusCounts[prevTask.status] ?? 0) - 1);
          nextStatusCounts[targetStatus] = (nextStatusCounts[targetStatus] ?? 0) + 1;

          const propKey = String(prevTask.property_id ?? 0);
          if (nextPropCounts[propKey]) {
            const deltaDone =
              (targetStatus === 'done' ? 1 : 0) - (prevTask.status === 'done' ? 1 : 0);
            nextPropCounts[propKey] = {
              ...nextPropCounts[propKey],
              done: Math.max(0, nextPropCounts[propKey].done + deltaDone),
            };
          }
        }

        if (targetPropertyId !== undefined && (prevTask.property_id ?? null) !== targetPropertyId) {
          const oldKey = String(prevTask.property_id ?? 0);
          const newKey = String(targetPropertyId ?? 0);
          const isDone = (targetStatus ?? prevTask.status) === 'done' ? 1 : 0;
          if (nextPropCounts[oldKey]) {
            nextPropCounts[oldKey] = {
              total: Math.max(0, nextPropCounts[oldKey].total - 1),
              done: Math.max(0, nextPropCounts[oldKey].done - isDone),
            };
          }
          const prevNew = nextPropCounts[newKey] ?? { total: 0, done: 0 };
          nextPropCounts[newKey] = {
            total: prevNew.total + 1,
            done: prevNew.done + isDone,
          };
        }

        return {
          ...prevFacets,
          status_counts: nextStatusCounts,
          property_counts: nextPropCounts,
        };
      });
    },
    []
  );

  const removeTaskFromStore = useCallback(
    (taskId: number) => {
      const removed = findLoadedTask(taskId);
      setListItems((prev) => prev.filter((t) => t.id !== taskId));
      setListPagination((prev) => ({
        ...prev,
        total: prev.total !== null ? Math.max(0, prev.total - 1) : null,
      }));
      setGroups((prev) => {
        let changed = false;
        const next: Record<string, TaskGroupPage> = {};
        for (const [k, grp] of Object.entries(prev)) {
          const had = grp.data.some((t) => t.id === taskId);
          if (!had) {
            next[k] = grp;
            continue;
          }
          changed = true;
          const prevTotal = grp.pagination.total ?? grp.data.length;
          const wasDone = removed?.status === 'done' ? 1 : 0;
          next[k] = {
            ...grp,
            data: grp.data.filter((t) => t.id !== taskId),
            done_count: grp.done_count !== undefined ? Math.max(0, grp.done_count - wasDone) : undefined,
            pagination: {
              ...grp.pagination,
              total: Math.max(0, prevTotal - 1),
            },
          };
        }
        return changed ? next : prev;
      });
      refreshFacetsSilently();
    },
    [findLoadedTask, refreshFacetsSilently]
  );

  const insertCreatedTasks = useCallback(
    (createdTasks: Task[]) => {
      const activeBoardTasks = createdTasks.filter((t) => t.status !== 'pending' && !!t.assigned_to);
      if (activeBoardTasks.length === 0) return;

      const crit = effectiveCriteriaRef.current;
      const matching = activeBoardTasks.filter((t) => {
        if (!crit) return true;
        if (crit.hiddenStatuses.includes(t.status as TaskStatus)) return false;
        if (crit.hiddenPriorities.includes(t.priority)) return false;
        if (crit.hiddenPropertyIds.includes(t.property_id ?? 0)) return false;
        if (crit.starredOnly && !t.is_starred) return false;
        if (crit.unplannedOnly && !t.is_unplanned) return false;
        if (typeof crit.taskFilter === 'number' && t.assigned_to !== crit.taskFilter) return false;
        return true;
      });

      if (matching.length > 0) {
        if (crit?.viewMode === 'list') {
          setListItems((prev) =>
            crit.listSortBy === 'created_at' && crit.listSortDir === 'desc'
              ? mergeUniqueTasks(matching, prev)
              : mergeUniqueTasks(prev, matching)
          );
        } else if (crit?.viewMode === 'kanban' || crit?.viewMode === 'property') {
          setGroups((prev) => {
            const next = { ...prev };
            for (const task of matching) {
              const key =
                crit.viewMode === 'kanban'
                  ? (task.status as string)
                  : String(task.property_id ?? 0);
              const existingGrp = next[key];
              if (existingGrp) {
                const updatedData = mergeUniqueTasks(existingGrp.data, [task]);
                next[key] = {
                  ...existingGrp,
                  data: updatedData,
                  done_count:
                    existingGrp.done_count !== undefined
                      ? existingGrp.done_count + (task.status === 'done' ? 1 : 0)
                      : undefined,
                  pagination: {
                    ...existingGrp.pagination,
                    total: (existingGrp.pagination.total ?? existingGrp.data.length) + 1,
                  },
                };
              } else if (crit.viewMode === 'property') {
                // Créer dynamiquement la colonne du logement si elle était masquée car vide
                next[key] = {
                  key,
                  label: task.property_name || 'Sans logement',
                  color: task.property_color,
                  code: task.property_code,
                  is_active: 1,
                  done_count: task.status === 'done' ? 1 : 0,
                  data: [task],
                  pagination: {
                    limit: 20,
                    has_more: false,
                    has_previous: false,
                    next_cursor: null,
                    previous_cursor: null,
                    total: 1,
                  },
                };
              }
            }
            return next;
          });
        }
      }

      refreshFacetsSilently();
    },
    [refreshFacetsSilently]
  );

  const upsertUpdatedTask = useCallback(
    (updatedTask: Task) => {
      const existing = findLoadedTask(updatedTask.id);
      if (existing && (existing.status !== updatedTask.status || (existing.property_id ?? null) !== (updatedTask.property_id ?? null))) {
        moveTaskOptimistic({
          taskId: updatedTask.id,
          targetStatus: updatedTask.status === 'pending' ? undefined : (updatedTask.status as TaskStatus),
          targetPropertyId: updatedTask.property_id ?? null,
          propertyPatch: {
            property_name: updatedTask.property_name,
            property_color: updatedTask.property_color,
            property_code: updatedTask.property_code,
          },
        });
      }
      patchTaskInStore(updatedTask.id, () => updatedTask);
      refreshFacetsSilently();
    },
    [findLoadedTask, moveTaskOptimistic, patchTaskInStore, refreshFacetsSilently]
  );

  return useMemo(
    () => ({
      groups,
      listItems,
      listPagination,
      loadedTasks,
      facets,
      isLoadingInitial,
      isRefreshing,
      isLoadingMoreList,
      loadingMoreColumns,
      hydrateFromServerPayload,
      resetStore,
      reloadCurrentView,
      refreshFacetsSilently,
      loadMoreColumn,
      loadMoreList,
      findLoadedTask,
      patchTaskInStore,
      moveTaskOptimistic,
      removeTaskFromStore,
      insertCreatedTasks,
      upsertUpdatedTask,
    }),
    [
      groups,
      listItems,
      listPagination,
      loadedTasks,
      facets,
      isLoadingInitial,
      isRefreshing,
      isLoadingMoreList,
      loadingMoreColumns,
      hydrateFromServerPayload,
      resetStore,
      reloadCurrentView,
      refreshFacetsSilently,
      loadMoreColumn,
      loadMoreList,
      findLoadedTask,
      patchTaskInStore,
      moveTaskOptimistic,
      removeTaskFromStore,
      insertCreatedTasks,
      upsertUpdatedTask,
    ]
  );
}
