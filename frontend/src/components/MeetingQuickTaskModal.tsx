import React, { useState, useEffect, useCallback } from 'react';
import { Task, User, Property, TaskPriority } from '../types';
import { useModalDialog } from '../hooks/useModalDialog';
import { PropertyMultiSelect, TaskMetaBar } from './ui';
import {
  X, Sparkles, Plus, Trash2, AlertCircle
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

  const toggleProperty = useCallback((propId: number) => {
    setSelectedPropertyIds(prev =>
      prev.includes(propId) ? prev.filter(id => id !== propId) : [...prev, propId]
    );
  }, []);

  if (!isOpen) return null;

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
  const isMultiCreate = !isEdit && multiCount > 1;

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

        {/* Header Liquid Glass compact */}
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 flex items-center justify-between gap-3 border-b border-[var(--cdh-border-hairline)] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <h2 id="meeting-quick-task-modal-title" className="text-[15px] sm:text-[16px] font-semibold tracking-[-0.015em] text-[var(--cdh-text-primary)] truncate">
              {isEdit
                ? editingTask?.title
                : isMultiCreate
                ? `Créer ${multiCount} tâches en attente`
                : 'Nouvelle tâche en attente'}
            </h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--cdh-accent-soft)] text-[var(--cdh-accent)] shrink-0">
              <Sparkles className="w-2.5 h-2.5" strokeWidth={2.25} />
              {assignedTo === '' ? `En attente · Point ${nextSprintNumber}` : `Point ${nextSprintNumber} · Nouveau`}
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

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 min-w-0">
          <div className="p-4 sm:px-5 sm:py-4 space-y-3 overflow-y-auto overflow-x-hidden flex-1 min-w-0">
            {error && (
              <div className="px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span>{error}</span>
              </div>
            )}

            {/* 1. Intitulé */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Intitulé {isMultiCreate ? 'des tâches' : 'de la tâche'} *
              </label>
              <input
                type="text"
                autoFocus
                required
                placeholder="Ex: Contacter le serrurier, préparer devis propriétaire..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-1.5 border border-black/[0.12] rounded-lg text-sm font-medium text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            {/* 2. Notes */}
            <div className="pt-2.5 border-t border-black/[0.12]">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Notes
              </label>
              <textarea
                rows={2}
                placeholder="Précisions actées pendant la réunion..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-1.5 border border-black/[0.12] rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            {/* 3. Sous-tâches rapides */}
            <div className="pt-2.5 border-t border-black/[0.12] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Sous-tâches
                </label>
                {subtasks.length > 0 && (
                  <span className="text-[11px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-full">
                    {subtasks.length} étape{subtasks.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {subtasks.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 py-0.5">
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
                  placeholder="Ajouter une étape..."
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubtask();
                    }
                  }}
                  className="flex-1 px-3 py-1.5 border border-black/[0.12] rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddSubtask}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                  Ajouter
                </button>
              </div>
            </div>

            {/* 4. Logement(s) concerné(s) */}
            <div className="pt-2.5 border-t border-black/[0.12] min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {isEdit ? 'Logement concerné' : 'Logement(s) concerné(s)'}
                </label>
                {!isEdit && properties.length > 0 && (
                  <div className="flex items-center gap-2 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setSelectedPropertyIds(properties.map(p => p.id))}
                      className="text-brand-600 hover:text-brand-800 cursor-pointer"
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
                  className="w-full px-2.5 py-1.5 border border-black/[0.12] rounded-lg text-sm text-slate-800 bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none cursor-pointer"
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
                <PropertyMultiSelect
                  properties={properties}
                  selectedIds={selectedPropertyIds}
                  onToggle={toggleProperty}
                />
              )}
            </div>
          </div>

          {/* Footer fixe compact avec barre d'icônes unifiée */}
          <div className="px-4 sm:px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:py-3 bg-slate-50 border-t border-[var(--cdh-border-hairline)] flex items-center justify-between gap-2.5 shrink-0">
            <TaskMetaBar
              users={assignableUsers}
              assignedTo={assignedTo}
              onChangeAssignee={setAssignedTo}
              showAssignee={isAdmin}
              allowUnassign={true}
              status="todo"
              onChangeStatus={() => {}}
              showStatus={false}
              priority={priority}
              onChangePriority={setPriority}
              dueDate={dueDate}
              onChangeDueDate={setDueDate}
              markOverdue={true}
            />

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="hidden sm:inline-flex items-center justify-center px-3.5 py-2 sm:py-1.5 min-h-[42px] sm:min-h-0 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl sm:rounded-lg cursor-pointer transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-4 py-2 sm:py-1.5 min-h-[42px] sm:min-h-0 text-white rounded-xl sm:rounded-lg text-sm font-bold shadow-sm transition-all cursor-pointer disabled:opacity-60 ${
                  isMultiCreate
                    ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25'
                    : 'bg-brand-600 hover:bg-brand-700 shadow-brand-600/25'
                }`}
              >
                {isSubmitting
                  ? 'Enregistrement...'
                  : isEdit
                  ? 'Enregistrer'
                  : isMultiCreate
                  ? `Créer les ${multiCount} tâches`
                  : 'Mettre en attente'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
