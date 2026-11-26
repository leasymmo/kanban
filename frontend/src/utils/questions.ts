import { Question } from '../types';

/**
 * Indique si une question a reçu une réponse définitive en séance.
 */
export function hasFinalDecision(q: Pick<Question, 'final_answer'>): boolean {
  return Boolean(q.final_answer && q.final_answer.trim().length > 0);
}

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
