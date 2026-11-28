import { TaskDueStateFilter, TaskPriority, TaskStatus } from '../types';

export type AssigneeFilter = 'all' | 'me' | number;
export type TaskViewMode = 'kanban' | 'property' | 'list';
export type TaskListSortKey =
  | 'alpha'
  | 'status'
  | 'priority'
  | 'due_date'
  | 'created_at'
  | 'property'
  | 'assignee'
  | 'subtasks';
export type TaskBoardSortKey = TaskListSortKey | 'position' | 'updated_at';
export type TaskListSortDir = 'asc' | 'desc';
export type TaskListColumnId =
  | 'status'
  | 'title'
  | 'property'
  | 'priority'
  | 'assignee'
  | 'due_date'
  | 'subtasks'
  | 'created_at';

export const DEFAULT_TASK_LIST_COLUMNS: TaskListColumnId[] = [
  'status',
  'title',
  'property',
  'priority',
  'assignee',
  'due_date',
  'subtasks',
];

export interface UserUiPreferences {
  activeTab: 'tasks' | 'questions' | 'meeting';
  taskViewMode: TaskViewMode;
  taskFilter: AssigneeFilter;
  taskSearchQuery: string;
  hiddenPropertyIds: number[];
  hiddenStatuses: TaskStatus[];
  hiddenPriorities: TaskPriority[];
  taskDueState: TaskDueStateFilter;
  taskStarredOnly: boolean;
  taskUnplannedOnly: boolean;
  hideEmptyProperties: boolean;
  taskListSortBy: TaskListSortKey;
  taskListSortDir: TaskListSortDir;
  taskBoardSortBy: TaskBoardSortKey;
  taskBoardSortDir: TaskListSortDir;
  taskListVisibleColumns: TaskListColumnId[];
}

const LAST_USER_ID_KEY = 'kanban_last_user_id';
const VALID_TABS = new Set(['tasks', 'questions', 'meeting']);
const VALID_VIEW_MODES = new Set<TaskViewMode>(['kanban', 'property', 'list']);
const VALID_STATUSES = new Set<TaskStatus>(['todo', 'in_progress', 'blocked', 'done']);
const VALID_PRIORITIES = new Set<TaskPriority>(['low', 'medium', 'high']);
const VALID_DUE_STATES = new Set<TaskDueStateFilter>(['all', 'overdue', 'with_date', 'without_date']);
const VALID_LIST_SORTS = new Set<TaskListSortKey>([
  'alpha',
  'status',
  'priority',
  'due_date',
  'created_at',
  'property',
  'assignee',
  'subtasks',
]);
const VALID_BOARD_SORTS = new Set<TaskBoardSortKey>([
  'position',
  'alpha',
  'status',
  'priority',
  'due_date',
  'created_at',
  'updated_at',
  'property',
  'assignee',
  'subtasks',
]);
const VALID_LIST_SORT_DIRS = new Set<TaskListSortDir>(['asc', 'desc']);
const VALID_LIST_COLUMNS = new Set<TaskListColumnId>([
  'status',
  'title',
  'property',
  'priority',
  'assignee',
  'due_date',
  'subtasks',
  'created_at',
]);

export function sanitizeTaskListColumns(cols: unknown): TaskListColumnId[] {
  if (!Array.isArray(cols)) return [...DEFAULT_TASK_LIST_COLUMNS];
  const filtered = cols.filter(
    (col): col is TaskListColumnId =>
      typeof col === 'string' && VALID_LIST_COLUMNS.has(col as TaskListColumnId)
  );
  const unique = Array.from(new Set(filtered));
  return unique.includes('title') ? unique : ['title', ...unique];
}

function getStorageKey(userId: number): string {
  return `kanban_prefs_u_${userId}`;
}

function readLegacyCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const encodedName = `${encodeURIComponent(name)}=`;
  const parts = document.cookie ? document.cookie.split('; ') : [];
  for (const part of parts) {
    if (part.startsWith(encodedName)) {
      try {
        return decodeURIComponent(part.slice(encodedName.length));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function clearLegacyCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

function parsePreferencesRaw(raw: string | null): Partial<UserUiPreferences> {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    const prefs: Partial<UserUiPreferences> = {};

    if (typeof parsed.activeTab === 'string' && VALID_TABS.has(parsed.activeTab)) {
      prefs.activeTab = parsed.activeTab as UserUiPreferences['activeTab'];
    }

    if (typeof parsed.taskViewMode === 'string' && VALID_VIEW_MODES.has(parsed.taskViewMode)) {
      prefs.taskViewMode = parsed.taskViewMode as UserUiPreferences['taskViewMode'];
    }

    if (
      parsed.taskFilter === 'all' ||
      parsed.taskFilter === 'me' ||
      (typeof parsed.taskFilter === 'number' && Number.isInteger(parsed.taskFilter) && parsed.taskFilter > 0)
    ) {
      prefs.taskFilter = parsed.taskFilter;
    }

    if (typeof parsed.taskSearchQuery === 'string') {
      prefs.taskSearchQuery = parsed.taskSearchQuery;
    }

    if (Array.isArray(parsed.hiddenPropertyIds)) {
      prefs.hiddenPropertyIds = parsed.hiddenPropertyIds.filter(
        (id: unknown): id is number => typeof id === 'number' && Number.isInteger(id) && id >= 0
      );
    }

    if (Array.isArray(parsed.hiddenStatuses)) {
      prefs.hiddenStatuses = parsed.hiddenStatuses.filter(
        (st: unknown): st is TaskStatus => typeof st === 'string' && VALID_STATUSES.has(st as TaskStatus)
      );
    }

    if (Array.isArray(parsed.hiddenPriorities)) {
      prefs.hiddenPriorities = parsed.hiddenPriorities.filter(
        (p: unknown): p is TaskPriority => typeof p === 'string' && VALID_PRIORITIES.has(p as TaskPriority)
      );
    }

    if (typeof parsed.hideEmptyProperties === 'boolean') {
      prefs.hideEmptyProperties = parsed.hideEmptyProperties;
    }

    if (typeof parsed.taskDueState === 'string' && VALID_DUE_STATES.has(parsed.taskDueState as TaskDueStateFilter)) {
      prefs.taskDueState = parsed.taskDueState as TaskDueStateFilter;
    }

    if (typeof parsed.taskStarredOnly === 'boolean') {
      prefs.taskStarredOnly = parsed.taskStarredOnly;
    }

    if (typeof parsed.taskUnplannedOnly === 'boolean') {
      prefs.taskUnplannedOnly = parsed.taskUnplannedOnly;
    }

    if (
      typeof parsed.taskListSortBy === 'string' &&
      VALID_LIST_SORTS.has(parsed.taskListSortBy as TaskListSortKey)
    ) {
      prefs.taskListSortBy = parsed.taskListSortBy as TaskListSortKey;
    }

    if (
      typeof parsed.taskListSortDir === 'string' &&
      VALID_LIST_SORT_DIRS.has(parsed.taskListSortDir as TaskListSortDir)
    ) {
      prefs.taskListSortDir = parsed.taskListSortDir as TaskListSortDir;
    }

    if (
      typeof parsed.taskBoardSortBy === 'string' &&
      VALID_BOARD_SORTS.has(parsed.taskBoardSortBy as TaskBoardSortKey)
    ) {
      prefs.taskBoardSortBy = parsed.taskBoardSortBy as TaskBoardSortKey;
    }

    if (
      typeof parsed.taskBoardSortDir === 'string' &&
      VALID_LIST_SORT_DIRS.has(parsed.taskBoardSortDir as TaskListSortDir)
    ) {
      prefs.taskBoardSortDir = parsed.taskBoardSortDir as TaskListSortDir;
    }

    if (Array.isArray(parsed.taskListVisibleColumns)) {
      prefs.taskListVisibleColumns = sanitizeTaskListColumns(parsed.taskListVisibleColumns);
    }

    return prefs;
  } catch {
    return {};
  }
}

export function getUserPreferences(userId: number): Partial<UserUiPreferences> {
  const key = getStorageKey(userId);
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) {
        return parsePreferencesRaw(stored);
      }
      // Migration unique depuis l'ancien stockage cookie vers localStorage
      const legacy = readLegacyCookie(key);
      if (legacy !== null) {
        const parsed = parsePreferencesRaw(legacy);
        window.localStorage.setItem(key, JSON.stringify(parsed));
        clearLegacyCookie(key);
        return parsed;
      }
    } catch {
      // Fallback silencieux si localStorage est restreint
    }
  }
  return {};
}

export function saveUserPreferences(userId: number, patch: Partial<UserUiPreferences>): void {
  const key = getStorageKey(userId);
  const current = getUserPreferences(userId);
  const next: Partial<UserUiPreferences> = { ...current, ...patch };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
      clearLegacyCookie(key);
    } catch {
      // Ignore quota / private mode errors
    }
  }
}

export function getLastUserId(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_USER_ID_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLastUserId(userId: number | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (userId && userId > 0) {
      window.localStorage.setItem(LAST_USER_ID_KEY, String(userId));
    } else {
      window.localStorage.removeItem(LAST_USER_ID_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}
