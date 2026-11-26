import React, { useState } from 'react';
import { Question, Sprint, Task } from '../types';
import { useModalDialog } from '../hooks/useModalDialog';
import { CheckCircle2, AlertTriangle, AlertCircle, ArrowRight, X, Calendar, RefreshCw, Sparkles, UserPlus } from 'lucide-react';

interface CloseSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSprint: Sprint | null;
  tasks: Task[];
  questions?: Question[];
  onConfirmClose: (nextName: string, notes: string) => Promise<void>;
}

export const CloseSprintModal: React.FC<CloseSprintModalProps> = ({
  isOpen,
  onClose,
  currentSprint,
  tasks,
  questions = [],
  onConfirmClose
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
    canClose: !isSubmitting
  });

  React.useEffect(() => {
    if (isOpen && currentSprint) {
      const n = currentSprint.number + 1;
      setNextName(`Point ${n} — ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`);
      setNotes('Clôture validée en fin de réunion des associés.');
      setError(null);
    }
  }, [isOpen, currentSprint]);

  if (!isOpen || !currentSprint) return null;

  const doneTasks = tasks.filter(t => t.status === 'done');
  const assignedPendingTasks = tasks.filter(t => t.status === 'pending' && !!t.assigned_to);
  const unassignedPendingTasks = tasks.filter(t => t.status === 'pending' && !t.assigned_to);
  const activeCarryOverTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'pending');
  const totalSubtasksInCarryOver = activeCarryOverTasks.reduce((acc, t) => acc + t.subtasks.length, 0);

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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-backdrop-in"
      onClick={() => !isSubmitting && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-sprint-modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full shadow-2xl border border-black/[0.12] overflow-hidden max-h-[92dvh] flex flex-col animate-sheet-up sm:animate-modal-in focus:outline-none"
      >
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-6 relative border-b border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre"
            className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
          
          <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase tracking-wider mb-1 pr-8">
            <RefreshCw className="w-4 h-4 shrink-0" strokeWidth={2.25} />
            <span>Fin de réunion hebdomadaire</span>
          </div>
          <h2 id="close-sprint-modal-title" className="text-lg sm:text-xl font-bold pr-8">Valider & Clôturer {currentSprint.name}</h2>
          <p className="text-xs text-slate-300 mt-1">
            Cette action fige le compte rendu actuel et ouvre immédiatement le sprint suivant.
          </p>
        </div>

        {/* Formulaire & Récapitulatif */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={2} />
              <span>{error}</span>
            </div>
          )}
          
          {/* Bloc Statut de la Bascule (2x2) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/80">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-sm mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" strokeWidth={2.25} />
                {doneTasks.length} Terminée{doneTasks.length > 1 ? 's' : ''}
              </div>
              <p className="text-xs text-emerald-700">
                Archivées dans {currentSprint.name}. Elles ne réapparaîtront pas.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200/80">
              <div className="flex items-center gap-1.5 text-blue-800 font-bold text-sm mb-1">
                <ArrowRight className="w-4 h-4 text-blue-600" strokeWidth={2.25} />
                {activeCarryOverTasks.length} Active{activeCarryOverTasks.length > 1 ? 's' : ''} reportée{activeCarryOverTasks.length > 1 ? 's' : ''}
              </div>
              <p className="text-xs text-blue-700">
                Transférées au Point {nextNumber} avec leur statut actuel et <strong>{totalSubtasksInCarryOver} sous-tâches</strong>.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-violet-50 border border-violet-200/90">
              <div className="flex items-center gap-1.5 text-violet-900 font-bold text-sm mb-1">
                <Sparkles className="w-4 h-4 text-violet-600" strokeWidth={2.25} />
                {assignedPendingTasks.length} En attente attribuée{assignedPendingTasks.length > 1 ? 's' : ''}
              </div>
              <p className="text-xs text-violet-800">
                Activées sur le Point {nextNumber} en statut <strong>« À faire »</strong> avec le tag <strong>« Nouveau »</strong>.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/90">
              <div className="flex items-center gap-1.5 text-amber-900 font-bold text-sm mb-1">
                <UserPlus className="w-4 h-4 text-amber-600" strokeWidth={2.25} />
                {unassignedPendingTasks.length} Non attribuée{unassignedPendingTasks.length > 1 ? 's' : ''}
              </div>
              <p className="text-xs text-amber-800">
                Déplacées vers le Point {nextNumber} en restant au statut <strong>pending</strong> (dans Plan d'Action).
              </p>
            </div>
          </div>

          <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 flex items-start gap-2 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.5} />
            <div className="space-y-1">
              <p>
                <strong>Règle de report</strong> : Toutes les tâches parentes non terminées sont reportées en conservant leur statut actuel et leurs sous-tâches (les sous-tâches déjà cochées restent cochées pour garder l'historique du travail accompli).
              </p>
              <p>
                <strong>Questions & réponses</strong> : {questions.filter(q => Boolean(q.final_answer?.trim())).length}/{questions.length} question{questions.length > 1 ? 's' : ''} avec réponse définitive archivée{questions.length > 1 ? 's' : ''}. Les propositions indicatives préparatoires ne sont pas conservées après la clôture.
              </p>
            </div>
          </div>

          {/* Nom du prochain sprint */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Nom du prochain sprint
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" strokeWidth={1.75} />
              <input
                type="text"
                required
                value={nextName}
                onChange={(e) => setNextName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-black/[0.12] rounded-lg text-sm text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Notes de clôture de réunion */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Notes du compte rendu de clôture
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Décisions majeures actées pendant la réunion..."
              className="w-full p-2.5 border border-black/[0.12] rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          </div>

          {/* Boutons d'action */}
          <div className="px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:py-3.5 bg-slate-50 border-t border-black/[0.12] flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 min-h-[42px] sm:min-h-0 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl sm:rounded-lg cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 sm:px-5 py-2.5 min-h-[42px] sm:min-h-0 bg-brand-600 hover:bg-brand-700 text-white rounded-xl sm:rounded-lg text-sm font-bold shadow-sm shadow-brand-600/25 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={2.25} />
              <span>{isSubmitting ? 'Bascule en cours...' : `Clôturer & Point ${nextNumber}`}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
