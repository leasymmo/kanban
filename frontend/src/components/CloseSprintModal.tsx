import React, { useState } from 'react';
import { Sprint, Task } from '../types';
import { CheckCircle2, AlertTriangle, ArrowRight, X, Calendar, RefreshCw } from 'lucide-react';

interface CloseSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSprint: Sprint | null;
  tasks: Task[];
  onConfirmClose: (nextName: string, notes: string) => Promise<void>;
}

export const CloseSprintModal: React.FC<CloseSprintModalProps> = ({
  isOpen,
  onClose,
  currentSprint,
  tasks,
  onConfirmClose
}) => {
  if (!isOpen || !currentSprint) return null;

  const nextNumber = currentSprint.number + 1;
  const [nextName, setNextName] = useState(`Point ${nextNumber} — ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`);
  const [notes, setNotes] = useState('Clôture validée en fin de réunion des associés.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const doneTasks = tasks.filter(t => t.status === 'done');
  const pendingTasks = tasks.filter(t => t.status !== 'done');
  const totalSubtasksInPending = pendingTasks.reduce((acc, t) => acc + t.subtasks.length, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onConfirmClose(nextName, notes);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <RefreshCw className="w-4 h-4 animate-spin-slow" />
            Fin de réunion hebdomadaire
          </div>
          <h2 className="text-xl font-bold">Valider & Clôturer {currentSprint.name}</h2>
          <p className="text-xs text-slate-300 mt-1">
            Cette action fige le compte rendu actuel et ouvre immédiatement le sprint suivant.
          </p>
        </div>

        {/* Formulaire & Récapitulatif */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Bloc Statut de la Bascule */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/80">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-sm mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {doneTasks.length} Tâches terminées
              </div>
              <p className="text-xs text-emerald-700">
                Archivées dans {currentSprint.name}. Elles ne réapparaîtront pas.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200/80">
              <div className="flex items-center gap-1.5 text-blue-800 font-bold text-sm mb-1">
                <ArrowRight className="w-4 h-4 text-blue-600" />
                {pendingTasks.length} Tâches reportées
              </div>
              <p className="text-xs text-blue-700">
                Transférées au Point {nextNumber} avec <strong>{totalSubtasksInPending} sous-tâches</strong> (faites et à faire).
              </p>
            </div>
          </div>

          <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 flex items-start gap-2 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Règle de report</strong> : Toutes les tâches parentes non terminées sont reportées avec 100% de leurs sous-tâches (les sous-tâches déjà cochées restent cochées pour garder l'historique du travail accompli).
            </span>
          </div>

          {/* Nom du prochain sprint */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Nom du prochain sprint
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={nextName}
                onChange={(e) => setNextName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-md shadow-indigo-600/30 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? 'Bascule en cours...' : `Clôturer et ouvrir le Point ${nextNumber}`}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
