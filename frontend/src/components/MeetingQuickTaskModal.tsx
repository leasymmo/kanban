import React, { useState, useEffect } from 'react';
import { Task, User, Property, TaskPriority } from '../types';
import { ensureWhiteTextContrast } from '../utils/color';
import { useModalDialog } from '../hooks/useModalDialog';
import {
  X, Sparkles, Plus, Trash2, Home, Check, AlertCircle, UserPlus
} from 'lucide-react';

interface MeetingQuickTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  sprintId: number;
  nextSprintNumber: number;
  currentUser: User | null;
  users: User[];
  properties: Property[];
  editingTask?: Task | null;
  onSave: (taskData: any) => Promise<void>;
}

interface QuickSubtaskDraft {
  id?: number;
  temp_id: string;
  title: string;
  is_done?: number | boolean;
}

export const MeetingQuickTaskModal: React.FC<MeetingQuickTaskModalProps> = ({
  isOpen,
  onClose,
  sprintId,
  nextSprintNumber,
  currentUser,
  users,
  properties,
  editingTask = null,
  onSave
}) => {
  const isEdit = !!editingTask;
  const isAdmin = currentUser?.role === 'admin';
  const assignableUsers = isAdmin
    ? users
    : users.filter(u => u.id === currentUser?.id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assignedTo, setAssignedTo] = useState<number | ''>('');
  const [propertyId, setPropertyId] = useState<number | ''>('');
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<number[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [subtasks, setSubtasks] = useState<QuickSubtaskDraft[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useModalDialog({
    isOpen,
    onClose,
    canClose: !isSubmitting
  });

  useEffect(() => {
    if (!isOpen) return;

    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description || '');
      setPriority(editingTask.priority || 'medium');
      setAssignedTo(editingTask.assigned_to || '');
      setPropertyId(editingTask.property_id || '');
      setSelectedPropertyIds(editingTask.property_id ? [editingTask.property_id] : []);
      setDueDate(editingTask.due_date ? editingTask.due_date.substring(0, 10) : '');
      setSubtasks(
        (editingTask.subtasks || []).map((st, idx) => ({
          id: st.id,
          temp_id: `edit-qst-${st.id}-${idx}`,
          title: st.title,
          is_done: st.is_done
        }))
      );
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setAssignedTo('');
      setPropertyId('');
      setSelectedPropertyIds([]);
      setDueDate('');
      setSubtasks([]);
    }
    setNewSubtaskTitle('');
    setError(null);
  }, [isOpen, editingTask]);

  if (!isOpen) return null;

  const toggleProperty = (propId: number) => {
    setSelectedPropertyIds(prev =>
      prev.includes(propId) ? prev.filter(id => id !== propId) : [...prev, propId]
    );
  };

  const handleAddSubtask = () => {
    const clean = newSubtaskTitle.trim();
    if (!clean) return;
    setSubtasks(prev => [
      ...prev,
      {
        temp_id: `qst-${Date.now()}-${Math.random()}`,
        title: clean,
        is_done: 0
      }
    ]);
    setNewSubtaskTitle('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("L'intitulé de la tâche est obligatoire.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const effectiveAssignedTo = isAdmin
        ? (assignedTo !== '' ? Number(assignedTo) : null)
        : (isEdit && editingTask?.assigned_to && editingTask.assigned_to !== currentUser?.id)
        ? editingTask.assigned_to
        : (assignedTo !== '' && Number(assignedTo) === currentUser?.id ? currentUser.id : null);

      const formattedSubtasks = subtasks
        .filter(st => st.title.trim() !== '')
        .map((st, idx) => ({
          id: st.id,
          temp_id: st.temp_id,
          title: st.title.trim(),
          is_done: st.is_done ? 1 : 0,
          position: idx + 1
        }));

      const payload: any = {
        sprint_id: sprintId,
        title: title.trim(),
        description: description.trim(),
        status: 'pending',
        priority,
        assigned_to: effectiveAssignedTo,
        due_date: dueDate || null,
        subtasks: formattedSubtasks
      };

      if (isEdit && editingTask) {
        payload.id = editingTask.id;
        payload.property_id = propertyId !== '' ? Number(propertyId) : null;
      } else {
        payload.property_ids = selectedPropertyIds;
        payload.created_from = 'meeting_pending';
        payload.pending_for_next_sprint = true;
      }

      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Impossible d'enregistrer cette tâche en séance.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const multiCount = !isEdit ? selectedPropertyIds.length : 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[var(--cdh-backdrop-scrim)] backdrop-blur-[6px] animate-backdrop-in"
      onClick={() => !isSubmitting && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-quick-task-modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="cdh-glass-overlay rounded-t-cdh-2xl sm:rounded-cdh-2xl max-w-xl w-full overflow-hidden max-h-[92dvh] flex flex-col animate-sheet-up sm:animate-modal-in focus:outline-none"
      >

        {/* Header spécifique Réunion */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-start justify-between gap-3 shrink-0 border-b border-slate-800">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30 text-[11px] font-bold uppercase tracking-wider mb-1.5">
              <Sparkles className="w-3 h-3 text-blue-200" strokeWidth={2.25} />
              <span>
                {assignedTo === ''
                  ? `En attente (pending) • Sans responsable`
                  : `En attente pour le Point ${nextSprintNumber} • Tag « Nouveau »`}
              </span>
            </div>
            <h2 id="meeting-quick-task-modal-title" className="text-base sm:text-lg font-bold leading-tight">
              {isEdit ? 'Modifier la tâche en attente' : 'Ajout rapide — Nouvelle tâche en séance'}
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              {assignedTo === ''
                ? `Cette tâche reste au statut pending et suivra sur le Point ${nextSprintNumber} tant qu'elle n'est pas attribuée.`
                : `À la validation de la réunion, cette tâche attribuée passera sur le Point ${nextSprintNumber} avec le tag « Nouveau ».`}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span>{error}</span>
              </div>
            )}

            {/* Intitulé */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Intitulé de l'action *
              </label>
              <input
                type="text"
                autoFocus
                required
                placeholder="Ex: Contacter le serrurier, préparer devis propriétaire..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-black/[0.12] rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Attribution rapide */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Responsable pour le prochain sprint
              </label>
              <div className="flex flex-wrap gap-1.5">
                {!isAdmin && isEdit && editingTask?.assigned_to && editingTask.assigned_to !== currentUser?.id ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-black/[0.12] bg-slate-100 text-slate-700">
                    <span>Attribuée à {editingTask.assigned_to_name || `#${editingTask.assigned_to}`} (lecture seule)</span>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setAssignedTo('')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        assignedTo === ''
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5" strokeWidth={2.25} />
                      <span>À attribuer</span>
                    </button>

                    {assignableUsers.map((u) => {
                      const isSelected = assignedTo === u.id;
                      return (
                        <button
                          type="button"
                          key={u.id}
                          onClick={() => setAssignedTo(u.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            isSelected
                              ? 'text-white border-transparent shadow-xs'
                              : 'bg-white text-slate-800 border-black/[0.12] hover:bg-slate-50'
                          }`}
                          style={isSelected ? { backgroundColor: ensureWhiteTextContrast(u.avatar_color) } : undefined}
                        >
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] leading-none font-bold text-white"
                            style={{ backgroundColor: ensureWhiteTextContrast(u.avatar_color) }}
                          >
                            {u.initials}
                          </span>
                          <span>{u.name}</span>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            {/* Logements */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {isEdit ? 'Logement concerné' : 'Logement(s) concerné(s)'}
                </label>
                {!isEdit && properties.length > 0 && (
                  <div className="flex items-center gap-2 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setSelectedPropertyIds(properties.map(p => p.id))}
                      className="text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      Tout sélectionner
                    </button>
                    {selectedPropertyIds.length > 0 && (
                      <>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedPropertyIds([])}
                          className="text-slate-500 hover:text-slate-700 cursor-pointer"
                        >
                          Aucun
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {isEdit ? (
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 border border-black/[0.12] rounded-xl text-sm text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="">Aucun / Tâche générale</option>
                  {editingTask?.property_id && !properties.some(p => p.id === editingTask.property_id) && (
                    <option value={editingTask.property_id}>
                      {editingTask.property_name || `Hébergement #${editingTask.property_id}`} (désactivé)
                    </option>
                  )}
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>
                      {Number(p.is_active) === 0 ? `${p.name} (désactivé)` : p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex flex-wrap gap-1.5 p-2.5 rounded-[18px] bg-slate-50 border border-black/[0.12]">
                  {properties.map(p => {
                    const isSelected = selectedPropertyIds.includes(p.id);
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => toggleProperty(p.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? 'text-white border-transparent shadow-xs'
                            : 'bg-white text-slate-700 border-black/[0.12] hover:border-black/[0.22]'
                        }`}
                        style={isSelected ? { backgroundColor: p.color || '#3B82F6' } : undefined}
                      >
                        <Home className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-slate-400'}`} strokeWidth={2} />
                        <span>{p.name}</span>
                        {isSelected && <Check className="w-3 h-3" strokeWidth={2} />}
                      </button>
                    );
                  })}
                  {properties.length === 0 && (
                    <span className="text-xs text-slate-400">Aucun logement actif configuré</span>
                  )}
                </div>
              )}
            </div>

            {/* Priorité & Échéance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Priorité
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full px-3 py-2 border border-black/[0.12] rounded-xl text-sm text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="low">Basse</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Haute / Urgente</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Échéance (optionnelle)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-black/[0.12] rounded-xl text-sm text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Contexte / Notes de séance
              </label>
              <textarea
                rows={2}
                placeholder="Précisions actées pendant la réunion..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2.5 border border-black/[0.12] rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Sous-tâches rapides */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Sous-tâches rapides (optionnel)
              </label>
              {subtasks.length > 0 && (
                <div className="space-y-1.5 mb-2 max-h-36 overflow-y-auto pr-1">
                  {subtasks.map(st => (
                    <div
                      key={st.temp_id}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-black/[0.12] text-xs"
                    >
                      <span className="text-slate-700 font-medium truncate">{st.title}</span>
                      <button
                        type="button"
                        onClick={() => setSubtasks(prev => prev.filter(item => item.temp_id !== st.temp_id))}
                        className="text-slate-400 hover:text-red-500 cursor-pointer shrink-0"
                        title="Retirer"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ajouter une sous-étape et appuyer sur Entrée..."
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubtask();
                    }
                  }}
                  className="flex-1 px-3 py-1.5 border border-black/[0.12] rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddSubtask}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                  Ajouter
                </button>
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:py-3.5 bg-slate-50 border-t border-black/[0.12] flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-sm shadow-brand-600/25 flex items-center gap-1.5 cursor-pointer disabled:opacity-60 transition-colors"
            >
              <Sparkles className="w-4 h-4" strokeWidth={2.25} />
              <span>
                {isSubmitting
                  ? 'Enregistrement...'
                  : isEdit
                  ? 'Mettre à jour'
                  : assignedTo === ''
                  ? (multiCount > 1 ? `Créer ${multiCount} tâches (pending)` : 'Créer en attente (pending)')
                  : multiCount > 1
                  ? `Mettre ${multiCount} tâches en attente`
                  : 'Mettre en attente pour le prochain sprint'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
