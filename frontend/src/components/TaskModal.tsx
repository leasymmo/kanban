import React, { useState, useEffect } from 'react';
import { Task, User, Property, TaskPriority, TaskStatus } from '../types';
import { X, Plus, Trash2, Home, CheckSquare, Square, UserPlus, AlertCircle, ShieldAlert } from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task | null; // null si création
  sprintId: number;
  currentUser: User | null;
  users: User[];
  properties: Property[];
  onSave: (taskData: any) => Promise<void>;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  task,
  sprintId,
  currentUser,
  users,
  properties,
  onSave
}) => {
  if (!isOpen) return null;

  const isEdit = !!task;
  const isAdmin = currentUser?.role === 'admin';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [propertyId, setPropertyId] = useState<number | ''>('');
  const [assignedTo, setAssignedTo] = useState<number | ''>('');
  const [dueDate, setDueDate] = useState('');
  const [isUnplanned, setIsUnplanned] = useState(false);
  const [subtasks, setSubtasks] = useState<{ id?: number; title: string; is_done: boolean }[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatus(task.status);
      setPriority(task.priority);
      setPropertyId(task.property_id || '');
      setAssignedTo(task.assigned_to || '');
      setDueDate(task.due_date ? task.due_date.substring(0, 10) : '');
      setIsUnplanned(!!task.is_unplanned);
      setSubtasks(task.subtasks.map(s => ({ id: s.id, title: s.title, is_done: !!s.is_done })));
    } else {
      setTitle('');
      setDescription('');
      setStatus('todo');
      setPriority('medium');
      setPropertyId('');
      setAssignedTo('');
      setDueDate('');
      setIsUnplanned(false);
      setSubtasks([]);
    }
    setError(null);
  }, [task, isOpen]);

  // Si l'utilisateur coche "Tâche complémentaire", elle est passée par défaut à "Fait"
  const handleUnplannedToggle = (checked: boolean) => {
    setIsUnplanned(checked);
    if (checked && !isEdit) {
      setStatus('done');
    }
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    setSubtasks([...subtasks, { title: newSubtaskTitle.trim(), is_done: false }]);
    setNewSubtaskTitle('');
  };

  const handleRemoveSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
  };

  const handleToggleSubtask = (index: number) => {
    setSubtasks(
      subtasks.map((s, i) => i === index ? { ...s, is_done: !s.is_done } : s)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Le titre de la tâche est obligatoire.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        sprint_id: sprintId,
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        property_id: propertyId !== '' ? Number(propertyId) : null,
        assigned_to: assignedTo !== '' ? Number(assignedTo) : null,
        due_date: dueDate || null,
        is_unplanned: isUnplanned ? 1 : 0,
        subtasks: subtasks.map(s => s.title)
      };

      if (isEdit && task) {
        payload.id = task.id;
      }

      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue lors de l’enregistrement');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Règle du brief : Si la tâche n'est pas attribuée, seul l'admin peut l'attribuer à quelqu'un.
  // Un utilisateur 'write' ne peut s'attribuer qu'à lui-même s'il le souhaite lors de la création.
  const canModifyAssignment = isAdmin || (!isEdit && currentUser?.role === 'write');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div>
            <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">
              {isEdit ? 'Détails de la tâche' : 'Nouvelle tâche'}
            </span>
            <h2 className="text-lg font-bold">
              {isEdit ? task.title : 'Créer une tâche pour le sprint'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Titre */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Intitulé de la tâche *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Refaire les joints studio Mel, Passer commande draps..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          {/* Description & Notes (Remarques "→ ...") */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Notes & Commentaires (format « → ... » du document)
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Dans l'attente du retour devis, contact pris avec la MJD..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          {/* Logement & Responsable (2 colonnes) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Logement concerné */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Logement concerné
              </label>
              <div className="relative">
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white cursor-pointer"
                >
                  <option value="">Aucun / Tâche générale</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Responsable / Attribution */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Responsable</span>
                {!canModifyAssignment && (
                  <span className="text-[10px] text-amber-600 font-normal flex items-center gap-0.5" title="Seul un admin peut attribuer">
                    <ShieldAlert className="w-3 h-3" /> Admin requis
                  </span>
                )}
              </label>
              <select
                value={assignedTo}
                disabled={!canModifyAssignment}
                onChange={(e) => setAssignedTo(e.target.value === '' ? '' : Number(e.target.value))}
                className={`w-full px-3 py-2 border rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white ${
                  canModifyAssignment ? 'border-slate-300 cursor-pointer' : 'border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed'
                }`}
              >
                <option value="">Pool des tâches non attribuées</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Statut, Priorité & Échéance (3 colonnes) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Statut */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Statut
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white cursor-pointer font-medium"
              >
                <option value="todo">À faire</option>
                <option value="in_progress">🚧 En cours</option>
                <option value="blocked">❌ Bloqué / Litige</option>
                <option value="done">✅ Fait</option>
              </select>
            </div>

            {/* Priorité */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Priorité
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white cursor-pointer"
              >
                <option value="low">Basse</option>
                <option value="medium">Moyenne</option>
                <option value="high">Haute / Urgente</option>
              </select>
            </div>

            {/* Échéance */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Échéance
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white"
              />
            </div>
          </div>

          {/* Sous-tâches (Checklist) */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Sous-tâches / Étapes hiérarchisées
            </label>

            {/* Liste existante */}
            <div className="space-y-1.5 mb-2.5 max-h-36 overflow-y-auto">
              {subtasks.map((sub, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => handleToggleSubtask(idx)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    {sub.is_done ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300 shrink-0" />
                    )}
                    <span className={sub.is_done ? 'line-through text-slate-400' : 'text-slate-800 font-medium'}>
                      {sub.title}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveSubtask(idx)}
                    className="text-slate-400 hover:text-red-500 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Input nouvelle sous-tâche */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Ajouter une sous-tâche..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter
              </button>
            </div>
          </div>

          {/* Option Réalisation Complémentaire / Imprévue */}
          <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
            <input
              type="checkbox"
              id="is_unplanned"
              checked={isUnplanned}
              onChange={(e) => handleUnplannedToggle(e.target.checked)}
              className="w-4 h-4 rounded text-brand-600 border-slate-300 focus:ring-brand-500"
            />
            <label htmlFor="is_unplanned" className="text-xs text-slate-600 select-none">
              <strong>Réalisation complémentaire</strong> (tâche réalisée pendant la semaine hors plan d'action initial)
            </label>
          </div>

          {/* Footer boutons */}
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
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-bold shadow-md shadow-brand-600/30 transition-all"
            >
              {isSubmitting ? 'Enregistrement...' : isEdit ? 'Enregistrer les modifications' : 'Créer la tâche'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
