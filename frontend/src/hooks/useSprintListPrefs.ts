import { useCallback, useEffect, useRef, useState } from 'react';
import { User } from '../types';
import {
  DEFAULT_TASK_LIST_COLUMNS,
  getUserPreferences,
  sanitizeTaskListColumns,
  saveUserPreferences,
  TaskListColumnId,
  TaskListSortDir,
  TaskListSortKey,
} from '../utils/cookies';

export interface SprintListColumnConfig {
  id: TaskListColumnId;
  label: string;
  sortKey: TaskListSortKey;
  width: string;
  locked?: boolean;
}

export const SPRINT_LIST_COLUMNS_CONFIG: SprintListColumnConfig[] = [
  { id: 'status', label: 'Statut', sortKey: 'status', width: '98px' },
  { id: 'title', label: 'Tâche', sortKey: 'alpha', width: 'minmax(200px, 2.2fr)', locked: true },
  { id: 'property', label: 'Logement', sortKey: 'property', width: '136px' },
  { id: 'priority', label: 'Priorité', sortKey: 'priority', width: '96px' },
  { id: 'assignee', label: 'Responsable', sortKey: 'assignee', width: '116px' },
  { id: 'due_date', label: 'Échéance', sortKey: 'due_date', width: '96px' },
  { id: 'subtasks', label: 'Sous-tâches', sortKey: 'subtasks', width: '98px' },
  { id: 'created_at', label: 'Créée le', sortKey: 'created_at', width: '94px' },
];

export function useSprintListPrefs(currentUser: User | null) {
  const userId = currentUser?.id ?? null;
  const loadedUserIdRef = useRef<number | null>(userId);
  const initialPrefs = userId ? getUserPreferences(userId) : {};

  const [sortBy, setSortBy] = useState<TaskListSortKey>(
    initialPrefs.taskListSortBy ?? 'priority'
  );
  const [sortDir, setSortDir] = useState<TaskListSortDir>(
    initialPrefs.taskListSortDir ?? 'asc'
  );
  const [visibleColumns, setVisibleColumns] = useState<TaskListColumnId[]>(() =>
    userId
      ? sanitizeTaskListColumns(initialPrefs.taskListVisibleColumns)
      : [...DEFAULT_TASK_LIST_COLUMNS]
  );

  useEffect(() => {
    if (!userId || loadedUserIdRef.current === userId) return;
    loadedUserIdRef.current = userId;
    const prefs = getUserPreferences(userId);
    setSortBy(prefs.taskListSortBy ?? 'priority');
    setSortDir(prefs.taskListSortDir ?? 'asc');
    setVisibleColumns(sanitizeTaskListColumns(prefs.taskListVisibleColumns));
  }, [userId]);

  const handleSelectSort = useCallback(
    (nextKey: TaskListSortKey) => {
      let nextDir: TaskListSortDir = 'asc';
      if (sortBy === nextKey) {
        nextDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else if (nextKey === 'created_at') {
        nextDir = 'desc';
      }
      setSortBy(nextKey);
      setSortDir(nextDir);
      if (userId) {
        saveUserPreferences(userId, {
          taskListSortBy: nextKey,
          taskListSortDir: nextDir,
        });
      }
    },
    [sortBy, sortDir, userId]
  );

  const handleToggleSortDir = useCallback(() => {
    const nextDir: TaskListSortDir = sortDir === 'asc' ? 'desc' : 'asc';
    setSortDir(nextDir);
    if (userId) {
      saveUserPreferences(userId, { taskListSortDir: nextDir });
    }
  }, [sortDir, userId]);

  const handleToggleColumn = useCallback(
    (colId: TaskListColumnId) => {
      if (colId === 'title') return;
      setVisibleColumns((prev) => {
        const next = prev.includes(colId)
          ? prev.filter((id) => id !== colId)
          : [...prev, colId];
        const sanitized = sanitizeTaskListColumns(next);
        if (userId) {
          saveUserPreferences(userId, { taskListVisibleColumns: sanitized });
        }
        return sanitized;
      });
    },
    [userId]
  );

  const handleResetColumns = useCallback(() => {
    const defaults = [...DEFAULT_TASK_LIST_COLUMNS];
    setVisibleColumns(defaults);
    if (userId) {
      saveUserPreferences(userId, { taskListVisibleColumns: defaults });
    }
  }, [userId]);

  return {
    sortBy,
    sortDir,
    visibleColumns,
    handleSelectSort,
    handleToggleSortDir,
    handleToggleColumn,
    handleResetColumns,
  };
}
