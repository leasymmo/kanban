import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { TaskDueStateFilter, TaskPriority, TaskStatus, Property, User } from '../types';
import { AssigneeFilter, getUserPreferences, saveUserPreferences } from '../utils/cookies';

export type { AssigneeFilter };

export const TASK_STATUS_OPTIONS: { id: TaskStatus; label: string; dotClass: string }[] = [
  { id: 'todo', label: 'À faire', dotClass: 'bg-slate-400' },
  { id: 'in_progress', label: 'En cours', dotClass: 'bg-amber-500' },
  { id: 'blocked', label: 'Bloqué', dotClass: 'bg-red-500' },
  { id: 'done', label: 'Terminé', dotClass: 'bg-emerald-500' },
];

export const TASK_PRIORITY_OPTIONS: { id: TaskPriority; label: string; dotClass: string }[] = [
  { id: 'high', label: 'Haute / Urgente', dotClass: 'bg-red-500' },
  { id: 'medium', label: 'Moyenne', dotClass: 'bg-blue-500' },
  { id: 'low', label: 'Basse', dotClass: 'bg-slate-400' },
];

export const TASK_DUE_STATE_OPTIONS: { id: TaskDueStateFilter; label: string }[] = [
  { id: 'all', label: 'Toutes les échéances' },
  { id: 'overdue', label: 'En retard' },
  { id: 'with_date', label: 'Avec échéance' },
  { id: 'without_date', label: 'Sans échéance' },
];

export interface TaskServerFilterState {
  taskFilter: AssigneeFilter;
  taskSearchQuery: string;
  hiddenPropertyIds: number[];
  hiddenStatuses: TaskStatus[];
  hiddenPriorities: TaskPriority[];
  taskDueState: TaskDueStateFilter;
  taskStarredOnly: boolean;
  taskUnplannedOnly: boolean;
}

/**
 * Gère les filtres utilisateur des tâches (persistés par utilisateur) destinés à piloter les requêtes SQL backend.
 */
export function useTaskFilters(properties: Property[], currentUser: User | null) {
  const userId = currentUser?.id ?? null;
  const loadedUserIdRef = useRef<number | null>(userId);
  const initialPrefs = userId ? getUserPreferences(userId) : {};

  const [taskFilter, setTaskFilterState] = useState<AssigneeFilter>(
    initialPrefs.taskFilter ?? 'me'
  );
  const [taskSearchQuery, setTaskSearchQueryState] = useState<string>(
    initialPrefs.taskSearchQuery ?? ''
  );
  const [hiddenPropertyIds, setHiddenPropertyIdsState] = useState<number[]>(
    initialPrefs.hiddenPropertyIds ?? []
  );
  const [hiddenStatuses, setHiddenStatusesState] = useState<TaskStatus[]>(
    initialPrefs.hiddenStatuses ?? []
  );
  const [hiddenPriorities, setHiddenPrioritiesState] = useState<TaskPriority[]>(
    initialPrefs.hiddenPriorities ?? []
  );
  const [taskDueState, setTaskDueStateState] = useState<TaskDueStateFilter>(
    initialPrefs.taskDueState ?? 'all'
  );
  const [taskStarredOnly, setTaskStarredOnlyState] = useState<boolean>(
    initialPrefs.taskStarredOnly ?? false
  );
  const [taskUnplannedOnly, setTaskUnplannedOnlyState] = useState<boolean>(
    initialPrefs.taskUnplannedOnly ?? false
  );

  // Recharger les préférences uniquement si l'utilisateur connecté change réellement
  useEffect(() => {
    if (!userId || loadedUserIdRef.current === userId) return;
    loadedUserIdRef.current = userId;
    const prefs = getUserPreferences(userId);
    setTaskFilterState(prefs.taskFilter ?? 'me');
    setTaskSearchQueryState(prefs.taskSearchQuery ?? '');
    setHiddenPropertyIdsState(prefs.hiddenPropertyIds ?? []);
    setHiddenStatusesState(prefs.hiddenStatuses ?? []);
    setHiddenPrioritiesState(prefs.hiddenPriorities ?? []);
    setTaskDueStateState(prefs.taskDueState ?? 'all');
    setTaskStarredOnlyState(prefs.taskStarredOnly ?? false);
    setTaskUnplannedOnlyState(prefs.taskUnplannedOnly ?? false);
  }, [userId]);

  const setTaskFilter = useCallback(
    (next: AssigneeFilter) => {
      setTaskFilterState(next);
      if (userId) saveUserPreferences(userId, { taskFilter: next });
    },
    [userId]
  );

  const setTaskSearchQuery = useCallback(
    (next: string) => {
      setTaskSearchQueryState(next);
      if (userId) saveUserPreferences(userId, { taskSearchQuery: next });
    },
    [userId]
  );

  const setHiddenPropertyIds = useCallback(
    (next: number[]) => {
      setHiddenPropertyIdsState(next);
      if (userId) saveUserPreferences(userId, { hiddenPropertyIds: next });
    },
    [userId]
  );

  const setHiddenStatuses = useCallback(
    (next: TaskStatus[]) => {
      setHiddenStatusesState(next);
      if (userId) saveUserPreferences(userId, { hiddenStatuses: next });
    },
    [userId]
  );

  const setHiddenPriorities = useCallback(
    (next: TaskPriority[]) => {
      setHiddenPrioritiesState(next);
      if (userId) saveUserPreferences(userId, { hiddenPriorities: next });
    },
    [userId]
  );

  const setTaskDueState = useCallback(
    (next: TaskDueStateFilter) => {
      setTaskDueStateState(next);
      if (userId) saveUserPreferences(userId, { taskDueState: next });
    },
    [userId]
  );

  const setTaskStarredOnly = useCallback(
    (next: boolean) => {
      setTaskStarredOnlyState(next);
      if (userId) saveUserPreferences(userId, { taskStarredOnly: next });
    },
    [userId]
  );

  const setTaskUnplannedOnly = useCallback(
    (next: boolean) => {
      setTaskUnplannedOnlyState(next);
      if (userId) saveUserPreferences(userId, { taskUnplannedOnly: next });
    },
    [userId]
  );

  const allPropertyFilterIds = useMemo(
    () => [0, ...properties.map((p) => p.id)],
    [properties]
  );

  const togglePropertyVisibility = useCallback(
    (propId: number) => {
      setHiddenPropertyIdsState((prev) => {
        const next = prev.includes(propId)
          ? prev.filter((id) => id !== propId)
          : [...prev, propId];
        if (userId) saveUserPreferences(userId, { hiddenPropertyIds: next });
        return next;
      });
    },
    [userId]
  );

  const toggleStatusVisibility = useCallback(
    (status: TaskStatus) => {
      setHiddenStatusesState((prev) => {
        const next = prev.includes(status)
          ? prev.filter((s) => s !== status)
          : [...prev, status];
        if (userId) saveUserPreferences(userId, { hiddenStatuses: next });
        return next;
      });
    },
    [userId]
  );

  const togglePriorityVisibility = useCallback(
    (priority: TaskPriority) => {
      setHiddenPrioritiesState((prev) => {
        const next = prev.includes(priority)
          ? prev.filter((p) => p !== priority)
          : [...prev, priority];
        if (userId) saveUserPreferences(userId, { hiddenPriorities: next });
        return next;
      });
    },
    [userId]
  );

  const resetFilters = useCallback(() => {
    setTaskSearchQueryState('');
    setHiddenPropertyIdsState([]);
    setHiddenStatusesState([]);
    setHiddenPrioritiesState([]);
    setTaskDueStateState('all');
    setTaskStarredOnlyState(false);
    setTaskUnplannedOnlyState(false);
    if (userId) {
      saveUserPreferences(userId, {
        taskSearchQuery: '',
        hiddenPropertyIds: [],
        hiddenStatuses: [],
        hiddenPriorities: [],
        taskDueState: 'all',
        taskStarredOnly: false,
        taskUnplannedOnly: false,
      });
    }
  }, [userId]);

  const hasActiveFilters =
    taskSearchQuery.trim().length > 0 ||
    hiddenPropertyIds.some((id) => allPropertyFilterIds.includes(id)) ||
    hiddenStatuses.length > 0 ||
    hiddenPriorities.length > 0 ||
    taskDueState !== 'all' ||
    taskStarredOnly ||
    taskUnplannedOnly;

  return {
    taskFilter,
    setTaskFilter,
    taskSearchQuery,
    setTaskSearchQuery,
    hiddenPropertyIds,
    setHiddenPropertyIds,
    hiddenStatuses,
    setHiddenStatuses,
    hiddenPriorities,
    setHiddenPriorities,
    taskDueState,
    setTaskDueState,
    taskStarredOnly,
    setTaskStarredOnly,
    taskUnplannedOnly,
    setTaskUnplannedOnly,
    allPropertyFilterIds,
    togglePropertyVisibility,
    toggleStatusVisibility,
    togglePriorityVisibility,
    resetFilters,
    hasActiveFilters,
  };
}
