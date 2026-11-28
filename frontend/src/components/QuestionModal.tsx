import React, { useState, useEffect, useId } from 'react';
import { Question, User } from '../types';
import { Badge, Button, Modal } from './ui';
import { AlertCircle } from 'lucide-react';

interface QuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sprintId: number;
  users: User[];
  currentUser: User | null;
  editingQuestion?: Question | null;
  initialUserId?: number;
  onAddQuestion: (data: { sprint_id: number; title: string; details?: string; user_id?: number }) => Promise<void>;
  onUpdateQuestion?: (id: number, data: Partial<Question>) => Promise<void>;
}

export const QuestionModal: React.FC<QuestionModalProps> = ({
  isOpen,
  onClose,
  sprintId,
  users,
  currentUser,
  editingQuestion = null,
  initialUserId,
  onAddQuestion,
  onUpdateQuestion
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const isEdit = !!editingQuestion;

  const titleInputId = useId();
  const detailsInputId = useId();
  const userSelectId = useId();

  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [targetUserId, setTargetUserId] = useState<number>(currentUser?.id || users[0]?.id || 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (editingQuestion) {
      setTitle(editingQuestion.title);
      setDetails(editingQuestion.details || '');
      setTargetUserId(editingQuestion.user_id);
    } else {
      setTitle('');
      setDetails('');
      setTargetUserId(initialUserId || currentUser?.id || users[0]?.id || 0);
    }
    setError(null);
    // Intentionally omit `users` reference to avoid resetting draft fields mid-typing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingQuestion?.id, initialUserId, currentUser?.id]);

  const hasOrphanAuthor =
    isEdit && editingQuestion && !users.some((u) => u.id === editingQuestion.user_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("L'intitulé de la question est obligatoire.");
      return;
    }
    if (trimmedTitle.length > 255) {
      setError("L'intitulé ne doit pas dépasser 255 caractères.");
      return;
    }
    if (isAdmin && !targetUserId) {
      setError('Veuillez sélectionner un associé concerné.');
      return;
    }
    if (isEdit && (!editingQuestion || !onUpdateQuestion)) {
      setError('Modification indisponible pour cette question.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      if (isEdit && editingQuestion && onUpdateQuestion) {
        await onUpdateQuestion(editingQuestion.id, {
          title: trimmedTitle,
          details: details.trim(),
          user_id: isAdmin ? targetUserId : editingQuestion.user_id
        });
      } else {
        await onAddQuestion({
          sprint_id: sprintId,
          title: trimmedTitle,
          details: details.trim(),
          user_id: isAdmin ? targetUserId : currentUser?.id
        });
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || "Impossible d'enregistrer la question.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const footer = (
    <div className="w-full flex items-center justify-end gap-2.5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClose}
        disabled={isSubmitting}
      >
        Annuler
      </Button>
      <Button
        type="submit"
        variant="primary"
        size="sm"
        isLoading={isSubmitting}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Ajouter la question'}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier la question' : 'Poser une question'}
      headerBadge={<Badge variant="accent">Réunion</Badge>}
      maxWidthClass="max-w-lg"
      canClose={!isSubmitting}
      asForm
      onSubmit={handleSubmit}
      bodyClassName="p-4 sm:px-5 sm:py-4 space-y-3 overflow-y-auto flex-1"
      footerClassName="px-4 sm:px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:py-3 bg-[var(--cdh-surface-control)] border-t border-[var(--cdh-border-hairline)] shrink-0"
      footer={footer}
    >
      {error && (
        <div
          role="alert"
          className="px-3 py-2 bg-[var(--cdh-danger-soft)] text-[var(--cdh-danger)] border border-[var(--cdh-danger-accent)]/30 rounded-cdh-md text-xs flex items-center gap-2 font-medium"
        >
          <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label
          htmlFor={titleInputId}
          className="block text-[11px] font-bold text-[var(--cdh-text-secondary)] uppercase tracking-wider mb-1"
        >
          Intitulé de la question *
        </label>
        <input
          id={titleInputId}
          type="text"
          autoFocus
          enterKeyHint="done"
          required
          maxLength={255}
          placeholder="Ex: Choix du prestataire serrurerie, point propriétaire..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-1.5 bg-[var(--cdh-surface-input)] border border-[var(--cdh-border-subtle)] rounded-cdh-md text-sm text-[var(--cdh-text-primary)] font-medium placeholder:text-[var(--cdh-text-tertiary)] focus:border-[var(--cdh-border-focus)] focus:ring-2 focus:ring-[var(--cdh-accent-soft)] focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor={detailsInputId}
          className="block text-[11px] font-bold text-[var(--cdh-text-secondary)] uppercase tracking-wider mb-1"
        >
          Détails &amp; arguments
        </label>
        <textarea
          id={detailsInputId}
          rows={3}
          placeholder="Précisions pour la discussion en séance..."
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          className="w-full px-3 py-1.5 bg-[var(--cdh-surface-input)] border border-[var(--cdh-border-subtle)] rounded-cdh-md text-sm text-[var(--cdh-text-primary)] placeholder:text-[var(--cdh-text-tertiary)] focus:border-[var(--cdh-border-focus)] focus:ring-2 focus:ring-[var(--cdh-accent-soft)] focus:outline-none"
        />
      </div>

      {isAdmin && (
        <div>
          <label
            htmlFor={userSelectId}
            className="block text-[11px] font-bold text-[var(--cdh-text-secondary)] uppercase tracking-wider mb-1"
          >
            Associé concerné
          </label>
          <select
            id={userSelectId}
            value={targetUserId}
            onChange={(e) => setTargetUserId(Number(e.target.value))}
            className="w-full px-2.5 py-1.5 bg-[var(--cdh-surface-input)] border border-[var(--cdh-border-subtle)] rounded-cdh-md text-sm text-[var(--cdh-text-primary)] cursor-pointer focus:border-[var(--cdh-border-focus)] focus:ring-2 focus:ring-[var(--cdh-accent-soft)] focus:outline-none"
          >
            {hasOrphanAuthor && editingQuestion && (
              <option value={editingQuestion.user_id}>
                {editingQuestion.user_name || 'Ancien associé'} (archivé)
              </option>
            )}
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </Modal>
  );
};
