import React, { useState, useEffect } from 'react';
import { Question, Sprint, Task } from '../types';
import { useModalDialog } from '../hooks/useModalDialog';
import { Button } from './ui';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';

interface CloseSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSprint: Sprint | null;
  tasks: Task[];
  questions?: Question[];
  onConfirmClose: (nextName: string, notes: string) => Promise<void>;
}

/**
 * Modale épurée Apple Liquid Glass de validation & clôture de réunion hebdomadaire :
 * résumé visuel synthétique de la bascule + nom du prochain sprint + notes.
 */
export const CloseSprintModal: React.FC<CloseSprintModalProps> = ({
  isOpen,
  onClose,
  currentSprint,
  tasks,
  questions = [],
  onConfirmClose,
}) => {
  const nextNumber = (currentSprint?.number ?? 0) + 1;
  const [nextName, setNextName] = useState(
    `Point ${nextNumber} — ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
  );
  const [notes, setNotes] = useState('Clôture validée en fin de réunion des associés.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useModalDialog({
    isOpen: isOpen && !!currentSprint,
    onClose,
    canClose: !isSubmitting,
  });

  useEffect(() => {
    if (isOpen && currentSprint) {
      const n = currentSprint.number + 1;
      setNextName(
        `Point ${n} — ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
      );
      setNotes('Clôture validée en fin de réunion des associés.');
      setError(null);
    }
  }, [isOpen, currentSprint]);

  if (!isOpen || !currentSprint) return null;

  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const carryOverCount = tasks.filter((t) => t.status !== 'done' && t.status !== 'pending').length;
  const assignedPendingCount = tasks.filter((t) => t.status === 'pending' && !!t.assigned_to).length;
  const unassignedPendingCount = tasks.filter((t) => t.status === 'pending' && !t.assigned_to).length;
  const decidedQuestionsCount = questions.filter((q) => Boolean(q.final_answer?.trim())).length;

  const summaryItems = [
    {
      label: 'Terminées',
      value: doneCount,
      icon: <CheckCircle2 className="w-4 h-4 text-[var(--cdh-success)]" strokeWidth={2} />,
      bgClass: 'bg-[var(--cdh-success-soft)]',
    },
    {
      label: 'Reportées',
      value: carryOverCount,
      icon: <ArrowRight className="w-4 h-4 text-[var(--cdh-accent)]" strokeWidth={2} />,
      bgClass: 'bg-[var(--cdh-accent-soft)]',
    },
    {
      label: 'Planifiées',
      value: assignedPendingCount,
      icon: <Sparkles className="w-4 h-4 text-[var(--cdh-secondary)]" strokeWidth={2} />,
      bgClass: 'bg-[var(--cdh-secondary-soft)]',
    },
    {
      label: 'À attribuer',
      value: unassignedPendingCount,
      icon: <UserPlus className="w-4 h-4 text-[var(--cdh-warning)]" strokeWidth={2} />,
      bgClass: 'bg-[var(--cdh-warning-soft)]',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nextName.trim()) {
      setError('Le nom du prochain sprint est obligatoire.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onConfirmClose(nextName.trim(), notes);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Impossible de clôturer ce sprint.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[var(--cdh-backdrop-scrim)] backdrop-blur-[6px] animate-backdrop-in"
      onClick={() => !isSubmitting && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-sprint-modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="cdh-glass-overlay rounded-t-cdh-2xl sm:rounded-cdh-2xl max-w-lg w-full overflow-hidden max-h-[92dvh] flex flex-col animate-sheet-up sm:animate-modal-in focus:outline-none"
      >
        {/* Header compact */}
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 flex items-center justify-between gap-3 border-b border-[var(--cdh-border-hairline)] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <h2
              id="close-sprint-modal-title"
              className="text-[15px] sm:text-[16px] font-semibold tracking-[-0.015em] text-[var(--cdh-text-primary)] truncate"
            >
              Clôturer {currentSprint.name}
            </h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--cdh-accent-soft)] text-[var(--cdh-accent)] shrink-0">
              <ArrowRight className="w-3 h-3" strokeWidth={2.25} />
              Point {nextNumber}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre"
            className="text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] p-1.5 rounded-full hover:bg-[var(--cdh-surface-control)] cursor-pointer shrink-0 transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Corps épuré */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 min-w-0">
          <div className="p-4 sm:px-5 sm:py-4 space-y-3 overflow-y-auto overflow-x-hidden flex-1 min-w-0">
            {error && (
              <div className="px-3 py-2 bg-[var(--cdh-danger-soft)] text-[var(--cdh-danger)] rounded-cdh-md text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={2} />
                <span>{error}</span>
              </div>
            )}

            {/* Récapitulatif synthétique 2x2 */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {summaryItems.map((item) => (
                  <div
                    key={item.label}
                    className="cdh-surface-card rounded-cdh-md px-3 py-2.5 flex items-center gap-2.5"
                  >
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${item.bgClass}`}
                    >
                      {item.icon}
                    </span>
                    <div className="min-w-0 leading-tight">
                      <div className="text-[15px] font-bold text-[var(--cdh-text-primary)] tabular-nums">
                        {item.value}
                      </div>
                      <div className="text-[11px] font-medium text-[var(--cdh-text-secondary)] truncate">
                        {item.label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {questions.length > 0 && (
                <p className="text-[11.5px] text-[var(--cdh-text-secondary)] px-0.5 tabular-nums">
                  Questions archivées : <strong className="text-[var(--cdh-text-primary)]">{decidedQuestionsCount}/{questions.length}</strong> décidée{decidedQuestionsCount > 1 ? 's' : ''}.
                </p>
              )}
            </div>

            {/* Nom du prochain sprint */}
            <div className="pt-2.5 border-t border-[var(--cdh-border-hairline)]">
              <label className="block text-[11px] font-bold text-[var(--cdh-text-secondary)] uppercase tracking-wider mb-1">
                Prochain sprint *
              </label>
              <div className="relative flex items-center">
                <Calendar
                  className="w-4 h-4 text-[var(--cdh-text-tertiary)] absolute left-3 pointer-events-none"
                  strokeWidth={1.75}
                />
                <input
                  type="text"
                  required
                  value={nextName}
                  onChange={(e) => setNextName(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-[var(--cdh-surface-input)] border border-[var(--cdh-border-subtle)] rounded-cdh-md text-sm text-[var(--cdh-text-primary)] font-medium focus:outline-none focus:border-[var(--cdh-border-focus)] focus:ring-2 focus:ring-[var(--cdh-accent-soft)]"
                />
              </div>
            </div>

            {/* Notes de clôture */}
            <div className="pt-2.5 border-t border-[var(--cdh-border-hairline)]">
              <label className="block text-[11px] font-bold text-[var(--cdh-text-secondary)] uppercase tracking-wider mb-1">
                Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Décisions clés de la réunion…"
                className="w-full px-3 py-1.5 bg-[var(--cdh-surface-input)] border border-[var(--cdh-border-subtle)] rounded-cdh-md text-sm text-[var(--cdh-text-primary)] placeholder:text-[var(--cdh-text-tertiary)] focus:outline-none focus:border-[var(--cdh-border-focus)] focus:ring-2 focus:ring-[var(--cdh-accent-soft)]"
              />
            </div>
          </div>

          {/* Footer compact */}
          <div className="px-4 sm:px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:py-3 bg-[var(--cdh-surface-control)] border-t border-[var(--cdh-border-hairline)] flex items-center justify-end gap-2 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="hidden sm:inline-flex"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
              leftIcon={<CheckCircle2 className="w-4 h-4" strokeWidth={2.25} />}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? 'Bascule en cours…' : `Clôturer & Point ${nextNumber}`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
