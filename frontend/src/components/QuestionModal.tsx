import React, { useState, useEffect } from 'react';
import { Question, User } from '../types';
import { X, AlertCircle } from 'lucide-react';

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

  if (!isOpen) return null;

  const hasOrphanAuthor =
    isEdit && editingQuestion && !users.some(u => u.id === editingQuestion.user_id);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-black/[0.12] overflow-hidden max-h-[92dvh] flex flex-col">

        {/* Header compact */}
        <div className="bg-slate-900 text-white px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <h3 className="text-sm sm:text-base font-bold truncate">
              {isEdit ? 'Modifier la question' : 'Poser une question'}
            </h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30 shrink-0">
              Réunion
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre"
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer shrink-0 transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 sm:px-5 sm:py-4 space-y-3 overflow-y-auto flex-1">
            {error && (
              <div className="px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Intitulé de la question *
              </label>
              <input
                type="text"
                autoFocus
                required
                maxLength={255}
                placeholder="Ex: Choix du prestataire serrurerie, point propriétaire..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-1.5 border border-black/[0.12] rounded-lg text-sm text-slate-800 font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Détails & arguments
              </label>
              <textarea
                rows={3}
                placeholder="Précisions pour la discussion en séance..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full px-3 py-1.5 border border-black/[0.12] rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            {isAdmin && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Associé concerné
                </label>
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-black/[0.12] rounded-lg text-sm text-slate-800 bg-white cursor-pointer focus:ring-2 focus:ring-brand-500 focus:outline-none"
                >
                  {hasOrphanAuthor && editingQuestion && (
                    <option value={editingQuestion.user_id}>
                      {editingQuestion.user_name || 'Ancien associé'} (archivé)
                    </option>
                  )}
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="px-4 sm:px-5 py-3 bg-slate-50 border-t border-black/[0.12] flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg cursor-pointer transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-sm shadow-brand-600/25 cursor-pointer transition-all"
            >
              {isSubmitting ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Ajouter la question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
