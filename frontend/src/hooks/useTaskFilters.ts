import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Task, TaskPriority, TaskStatus, Property, User } from '../types';
import { AssigneeFilter, getUserPreferences, saveUserPreferences } from '../utils/cookies';

export type { AssigneeFilter };

export const TASK_STATUS_OPTIONS: { id: TaskStatus; label: string; dotClass: string }[] = [
  { id: 'todo', label: 'À faire', dotClass: 'bg-slate-400' },
  { id: 'in_progress', label: 'En cours', dotClass: 'bg-amber-500' },
  { id: 'blocked', label: 'Bloqué', dotClass: 'bg-red-500' },
  { id: 'done', label: 'Terminé', dotClass: 'bg-emerald-500' }
];

export const TASK_PRIORITY_OPTIONS: { id: TaskPriority; label: string; dotClass: string }[] = [
  { id: 'high', label: 'Haute / Urgente', dotClass: 'bg-red-500' },
  { id: 'medium', label: 'Moyenne', dotClass: 'bg-blue-500' },
  { id: 'low', label: 'Basse', dotClass: 'bg-slate-400' }
];

export function useTaskFilters(
  tasks: Task[],
  properties: Property[],
  currentUser: User | null
) {
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

  const allPropertyFilterIds = useMemo(
    () => [...properties.map(p => p.id), 0],
    [properties]
  );

  const togglePropertyVisibility = useCallback(
    (propId: number) => {
      setHiddenPropertyIdsState(prev => {
        const next = prev.includes(propId)
          ? prev.filter(id => id !== propId)
          : [...prev, propId];
        if (userId) saveUserPreferences(userId, { hiddenPropertyIds: next });
        return next;
      });
    },
    [userId]
  );

  const toggleStatusVisibility = useCallback(
    (status: TaskStatus) => {
      setHiddenStatusesState(prev => {
        const next = prev.includes(status)
          ? prev.filter(s => s !== status)
          : [...prev, status];
        if (userId) saveUserPreferences(userId, { hiddenStatuses: next });
        return next;
      });
    },
    [userId]
  );

  const togglePriorityVisibility = useCallback(
    (priority: TaskPriority) => {
      setHiddenPrioritiesState(prev => {
        const next = prev.includes(priority)
          ? prev.filter(p => p !== priority)
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
    if (userId) {
      saveUserPreferences(userId, {
        taskSearchQuery: '',
        hiddenPropertyIds: [],
        hiddenStatuses: [],
        hiddenPriorities: []
      });
    }
  }, [userId]);

  const hasActiveFilters =
    taskSearchQuery.trim().length > 0 ||
    hiddenPropertyIds.some(id => allPropertyFilterIds.includes(id)) ||
    hiddenStatuses.length > 0 ||
    hiddenPriorities.length > 0;

  const facetFilteredTasks = useMemo(() => {
    const q = taskSearchQuery.trim().toLowerCase();
    const hiddenPropSet = new Set(hiddenPropertyIds);
    const hiddenStatusSet = new Set<string>(hiddenStatuses);
    const hiddenPrioritySet = new Set<string>(hiddenPriorities);

    return tasks
      .filter(t => {
        if (t.status === 'pending') return false;
        const propKey = t.property_id || 0;
        if (hiddenPropSet.has(propKey)) return false;
        if (hiddenStatusSet.has(t.status)) return false;
        if (hiddenPrioritySet.has(t.priority || 'medium')) return false;

        if (q) {
          const matchTitle = t.title.toLowerCase().includes(q);
          const matchDesc = (t.description || '').toLowerCase().includes(q);
          const matchProp = (t.property_name || '').toLowerCase().includes(q);
          const matchSub = (t.subtasks || []).some(st => st.title.toLowerCase().includes(q));
          if (!matchTitle && !matchDesc && !matchProp && !matchSub) return false;
        }
        return true;
      })
      .sort((a, b) => (a.position - b.position) || (a.id - b.id));
  }, [tasks, hiddenPropertyIds, hiddenStatuses, hiddenPriorities, taskSearchQuery]);

  const filteredTasks = useMemo(() => {
    return facetFilteredTasks.filter(t => {
      if (taskFilter === 'me') {
        return t.assigned_to === userId;
      }
      if (typeof taskFilter === 'number') {
        return t.assigned_to === taskFilter;
      }
      return true;
    });
  }, [facetFilteredTasks, taskFilter, userId]);

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
    allPropertyFilterIds,
    togglePropertyVisibility,
    toggleStatusVisibility,
    togglePriorityVisibility,
    resetFilters,
    hasActiveFilters,
    facetFilteredTasks,
    filteredTasks
  };
}
