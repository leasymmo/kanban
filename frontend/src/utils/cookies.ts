import { TaskStatus } from '../types';

export type AssigneeFilterPref = 'all' | 'me' | number;

export interface UserUiPreferences {
  activeTab: 'tasks' | 'questions' | 'meeting';
  taskViewMode: 'kanban' | 'property';
  taskFilter: AssigneeFilterPref;
  taskSearchQuery: string;
  hiddenPropertyIds: number[];
  hiddenStatuses: TaskStatus[];
}

const VALID_TABS = new Set(['tasks', 'questions', 'meeting']);
const VALID_VIEW_MODES = new Set(['kanban', 'property']);
const VALID_STATUSES = new Set<TaskStatus>(['todo', 'in_progress', 'blocked', 'done']);

function getCookieKey(userId: number): string {
  return `kanban_prefs_u_${userId}`;
}

export function getCookie(name: string): string | null {
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

export function setCookie(name: string, value: string, days: number = 365): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 86400 * 1000).toUTCString();
  const secureFlag =
    typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${secureFlag}`;
}

export function getUserPreferences(userId: number): Partial<UserUiPreferences> {
  const raw = getCookie(getCookieKey(userId));
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

    return prefs;
  } catch {
    return {};
  }
}

export function saveUserPreferences(userId: number, patch: Partial<UserUiPreferences>): void {
  const current = getUserPreferences(userId);
  const next: Partial<UserUiPreferences> = { ...current, ...patch };
  setCookie(getCookieKey(userId), JSON.stringify(next), 365);
}
