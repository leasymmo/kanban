import { QuestionStatus } from '../types';

export const QUESTION_STATUS_META: Record<
  QuestionStatus,
  { label: string; shortLabel: string; badgeClass: string; selectClass: string }
> = {
  open: {
    label: 'À aborder',
    shortLabel: 'À aborder',
    badgeClass: 'bg-amber-100 text-amber-900',
    selectClass: 'bg-amber-100 text-amber-900 border-amber-200/90 hover:bg-amber-200/70'
  },
  discussed: {
    label: 'En discussion',
    shortLabel: 'En discussion',
    badgeClass: 'bg-blue-100 text-blue-900',
    selectClass: 'bg-blue-100 text-blue-900 border-blue-200/90 hover:bg-blue-200/70'
  },
  resolved: {
    label: 'Résolue / Actée',
    shortLabel: 'Résolue',
    badgeClass: 'bg-emerald-100 text-emerald-900',
    selectClass: 'bg-emerald-100 text-emerald-900 border-emerald-200/90 hover:bg-emerald-200/70'
  }
};

/**
 * Formate de façon sûre une date ISO ou MySQL ("YYYY-MM-DD HH:mm:ss") sous Safari/WebKit.
 */
export function formatQuestionDate(rawDate?: string | null, withTime: boolean = false): string {
  if (!rawDate) return '';
  const normalized = rawDate.includes(' ') && !rawDate.includes('T')
    ? rawDate.replace(' ', 'T')
    : rawDate;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return '';

  return parsed.toLocaleDateString(
    'fr-FR',
    withTime
      ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: 'short' }
  );
}
