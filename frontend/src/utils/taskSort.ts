import { TaskListSortKey } from './cookies';
import { parseLocalDate } from './subtasks';

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
