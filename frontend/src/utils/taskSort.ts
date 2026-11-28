import { Task, TaskPriority, TaskStatus } from '../types';
import { TaskListSortDir, TaskListSortKey } from './cookies';
import { calculateSubtaskStats, parseLocalDate } from './subtasks';

export const STATUS_ORDER: Record<TaskStatus | 'pending', number> = {
  blocked: 0,
  in_progress: 1,
  todo: 2,
  done: 3,
  pending: 4,
};

export const PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export const TASK_LIST_SORT_OPTIONS: { id: TaskListSortKey; label: string }[] = [
  { id: 'priority', label: 'Priorité' },
  { id: 'status', label: 'Statut' },
  { id: 'due_date', label: 'Échéance' },
  { id: 'alpha', label: 'Alphabétique' },
  { id: 'property', label: 'Logement' },
  { id: 'assignee', label: 'Responsable' },
  { id: 'subtasks', label: 'Progression sous-tâches' },
  { id: 'created_at', label: 'Date de création' },
];

const SHORT_MONTHS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

export function formatShortDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = parseLocalDate(dateStr);
  if (!d) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = SHORT_MONTHS[d.getMonth()] || '';
  return `${day} ${month}`;
}

export function parseTimestampMs(raw?: string | null): number {
  if (!raw) return Number.POSITIVE_INFINITY;
  const normalized = raw.includes(' ') && !raw.includes('T') ? raw.replace(/\s+/, 'T') : raw;
  const ts = Date.parse(normalized);
  return Number.isNaN(ts) ? Number.POSITIVE_INFINITY : ts;
}

export function sortTasks(
  tasks: Task[],
  sortBy: TaskListSortKey,
  sortDir: TaskListSortDir
): Task[] {
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...tasks].sort((a, b) => {
    let cmp = 0;

    switch (sortBy) {
      case 'alpha':
        cmp = a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
        break;
      case 'status':
        cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
        break;
      case 'priority':
        cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
        break;
      case 'due_date': {
        const da = parseLocalDate(a.due_date)?.getTime() ?? Number.POSITIVE_INFINITY;
        const db = parseLocalDate(b.due_date)?.getTime() ?? Number.POSITIVE_INFINITY;
        const aMissing = da === Number.POSITIVE_INFINITY;
        const bMissing = db === Number.POSITIVE_INFINITY;
        if (aMissing !== bMissing) return aMissing ? 1 : -1;
        cmp = da - db;
        break;
      }
      case 'created_at': {
        const ta = parseTimestampMs(a.created_at);
        const tb = parseTimestampMs(b.created_at);
        const aMissing = ta === Number.POSITIVE_INFINITY;
        const bMissing = tb === Number.POSITIVE_INFINITY;
        if (aMissing !== bMissing) return aMissing ? 1 : -1;
        cmp = ta - tb;
        break;
      }
      case 'property': {
        const pa = (a.property_name || '').trim();
        const pb = (b.property_name || '').trim();
        if (!pa && !pb) cmp = 0;
        else if (!pa) return 1;
        else if (!pb) return -1;
        else cmp = pa.localeCompare(pb, 'fr', { sensitivity: 'base' });
        break;
      }
      case 'assignee': {
        const aa = (a.assigned_to_name || '').trim();
        const ab = (b.assigned_to_name || '').trim();
        if (!aa && !ab) cmp = 0;
        else if (!aa) return 1;
        else if (!ab) return -1;
        else cmp = aa.localeCompare(ab, 'fr', { sensitivity: 'base' });
        break;
      }
      case 'subtasks': {
        const sa = calculateSubtaskStats(a.subtasks || []);
        const sb = calculateSubtaskStats(b.subtasks || []);
        if (sa.total === 0 && sb.total === 0) cmp = 0;
        else if (sa.total === 0) return 1;
        else if (sb.total === 0) return -1;
        else cmp = sa.percent - sb.percent || sa.total - sb.total;
        break;
      }
    }

    if (cmp !== 0) return cmp * dir;
    return a.position - b.position || a.id - b.id;
  });
}
