import React, { useState, useEffect, useId } from 'react';
import { Question, Sprint, Task } from '../types';
import { Badge, Button, Modal } from './ui';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Sparkles,
  UserPlus,
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
  const nextNameInputId = useId();
  const notesInputId = useId();

  const [nextName, setNextName] = useState(
    `Point ${nextNumber} — ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
  );
  const [notes, setNotes] = useState('Clôture validée en fin de réunion des associés.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && currentSprint) {
      const n = currentSprint.number + 1;
      setNextName(
        `Point ${n} — ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
      );
      setNotes('Clôture validée en fin de réunion des associés.');
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentSprint?.id]);

  if (!currentSprint) return null;

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

  const footer = (
    <div className="w-full flex items-center justify-end gap-2">
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
        isLoading={isSubmitting}
        leftIcon={<CheckCircle2 className="w-4 h-4" strokeWidth={2.25} />}
        className="w-full sm:w-auto"
      >
        {isSubmitting ? 'Bascule en cours…' : `Clôturer & Point ${nextNumber}`}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Clôturer ${currentSprint.name}`}
      headerBadge={
        <Badge variant="accent">
          <ArrowRight className="w-3 h-3" strokeWidth={2.25} />
          Point {nextNumber}
        </Badge>
      }
      maxWidthClass="max-w-lg"
      canClose={!isSubmitting}
      asForm
      onSubmit={handleSubmit}
      bodyClassName="p-4 sm:px-5 sm:py-4 space-y-3 overflow-y-auto overflow-x-hidden flex-1 min-w-0"
      footerClassName="px-4 sm:px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:py-3 bg-[var(--cdh-surface-control)] border-t border-[var(--cdh-border-hairline)] shrink-0"
      footer={footer}
    >
      {error && (
        <div
          role="alert"
          className="px-3 py-2 bg-[var(--cdh-danger-soft)] text-[var(--cdh-danger)] rounded-cdh-md text-xs flex items-center gap-2 font-medium"
        >
          <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={2} />
          <span>{error}</span>
        </div>
      )}

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
            Questions archivées :{' '}
            <strong className="text-[var(--cdh-text-primary)]">
              {decidedQuestionsCount}/{questions.length}
            </strong>{' '}
            décidée{decidedQuestionsCount > 1 ? 's' : ''}.
          </p>
        )}
      </div>

      <div className="pt-2.5 border-t border-[var(--cdh-border-hairline)]">
        <label
          htmlFor={nextNameInputId}
          className="block text-[11px] font-bold text-[var(--cdh-text-secondary)] uppercase tracking-wider mb-1"
        >
          Prochain sprint *
        </label>
        <div className="relative flex items-center">
          <Calendar
            className="w-4 h-4 text-[var(--cdh-text-tertiary)] absolute left-3 pointer-events-none"
            strokeWidth={1.75}
          />
          <input
            id={nextNameInputId}
            type="text"
            required
            value={nextName}
            onChange={(e) => setNextName(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[var(--cdh-surface-input)] border border-[var(--cdh-border-subtle)] rounded-cdh-md text-sm text-[var(--cdh-text-primary)] font-medium focus:outline-none focus:border-[var(--cdh-border-focus)] focus:ring-2 focus:ring-[var(--cdh-accent-soft)]"
          />
        </div>
      </div>

      <div className="pt-2.5 border-t border-[var(--cdh-border-hairline)]">
        <label
          htmlFor={notesInputId}
          className="block text-[11px] font-bold text-[var(--cdh-text-secondary)] uppercase tracking-wider mb-1"
        >
          Notes
        </label>
        <textarea
          id={notesInputId}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Décisions clés de la réunion…"
          className="w-full px-3 py-1.5 bg-[var(--cdh-surface-input)] border border-[var(--cdh-border-subtle)] rounded-cdh-md text-sm text-[var(--cdh-text-primary)] placeholder:text-[var(--cdh-text-tertiary)] focus:outline-none focus:border-[var(--cdh-border-focus)] focus:ring-2 focus:ring-[var(--cdh-accent-soft)]"
        />
      </div>
    </Modal>
  );
};
