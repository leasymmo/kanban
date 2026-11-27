import { useState, useMemo, useEffect, useCallback } from 'react';
import { Task, TaskStatus, Property, User } from '../types';
import { getUserPreferences, saveUserPreferences } from '../utils/cookies';

export type AssigneeFilter = 'all' | 'me' | number;

export const TASK_STATUS_OPTIONS: { id: TaskStatus; label: string; dotClass: string }[] = [
  { id: 'todo', label: 'À faire', dotClass: 'bg-slate-400' },
  { id: 'in_progress', label: 'En cours', dotClass: 'bg-amber-500' },
  { id: 'blocked', label: 'Bloqué', dotClass: 'bg-red-500' },
  { id: 'done', label: 'Terminé', dotClass: 'bg-emerald-500' }
];

export function useTaskFilters(
  tasks: Task[],
  properties: Property[],
  currentUser: User | null
) {
  const initialPrefs = currentUser ? getUserPreferences(currentUser.id) : {};

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

  // Recharger les filtres depuis les cookies si l'utilisateur connecté change
  useEffect(() => {
    if (!currentUser) return;
    const prefs = getUserPreferences(currentUser.id);
    setTaskFilterState(prefs.taskFilter ?? 'me');
    setTaskSearchQueryState(prefs.taskSearchQuery ?? '');
    setHiddenPropertyIdsState(prefs.hiddenPropertyIds ?? []);
    setHiddenStatusesState(prefs.hiddenStatuses ?? []);
  }, [currentUser?.id]);

  const setTaskFilter = useCallback(
    (next: AssigneeFilter) => {
      setTaskFilterState(next);
      if (currentUser) {
        saveUserPreferences(currentUser.id, { taskFilter: next });
      }
    },
    [currentUser]
  );

  const setTaskSearchQuery = useCallback(
    (next: string) => {
      setTaskSearchQueryState(next);
      if (currentUser) {
        saveUserPreferences(currentUser.id, { taskSearchQuery: next });
      }
    },
    [currentUser]
  );

  const setHiddenPropertyIds = useCallback(
    (next: number[]) => {
      setHiddenPropertyIdsState(next);
      if (currentUser) {
        saveUserPreferences(currentUser.id, { hiddenPropertyIds: next });
      }
    },
    [currentUser]
  );

  const setHiddenStatuses = useCallback(
    (next: TaskStatus[]) => {
      setHiddenStatusesState(next);
      if (currentUser) {
        saveUserPreferences(currentUser.id, { hiddenStatuses: next });
      }
    },
    [currentUser]
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
        if (currentUser) {
          saveUserPreferences(currentUser.id, { hiddenPropertyIds: next });
        }
        return next;
      });
    },
    [currentUser]
  );

  const toggleStatusVisibility = useCallback(
    (status: TaskStatus) => {
      setHiddenStatusesState(prev => {
        const next = prev.includes(status)
          ? prev.filter(s => s !== status)
          : [...prev, status];
        if (currentUser) {
          saveUserPreferences(currentUser.id, { hiddenStatuses: next });
        }
        return next;
      });
    },
    [currentUser]
  );

  const resetFilters = useCallback(() => {
    setTaskSearchQueryState('');
    setHiddenPropertyIdsState([]);
    setHiddenStatusesState([]);
    if (currentUser) {
      saveUserPreferences(currentUser.id, {
        taskSearchQuery: '',
        hiddenPropertyIds: [],
        hiddenStatuses: []
      });
    }
  }, [currentUser]);

  const hasActiveFilters =
    taskSearchQuery.trim().length > 0 ||
    hiddenPropertyIds.some(id => allPropertyFilterIds.includes(id)) ||
    hiddenStatuses.length > 0;

  // Tâches filtrées par logement, statut et recherche (utilisé pour les compteurs par associé)
  const facetFilteredTasks = useMemo(() => {
    const q = taskSearchQuery.trim().toLowerCase();
    return tasks
      .filter(t => {
        if (t.status === 'pending') return false;
        const propKey = t.property_id || 0;
        if (hiddenPropertyIds.includes(propKey)) return false;
        if (hiddenStatuses.includes(t.status)) return false;

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
  }, [tasks, hiddenPropertyIds, hiddenStatuses, taskSearchQuery]);

  // Tâches filtrées finales (ajout du filtre associé)
  const filteredTasks = useMemo(() => {
    return facetFilteredTasks.filter(t => {
      if (taskFilter === 'me') {
        return t.assigned_to === currentUser?.id;
      }
      if (typeof taskFilter === 'number') {
        return t.assigned_to === taskFilter;
      }
      return true;
    });
  }, [facetFilteredTasks, taskFilter, currentUser]);

  return {
    taskFilter,
    setTaskFilter,
    taskSearchQuery,
    setTaskSearchQuery,
    hiddenPropertyIds,
    setHiddenPropertyIds,
    hiddenStatuses,
    setHiddenStatuses,
    allPropertyFilterIds,
    togglePropertyVisibility,
    toggleStatusVisibility,
    resetFilters,
    hasActiveFilters,
    facetFilteredTasks,
    filteredTasks
  };
}
