import React, { useState, useEffect } from 'react';
import { Task, User, Property, TaskPriority, TaskStatus, Subtask } from '../types';
import { buildSubtaskTree, flattenSubtaskTree, HierarchicalSubtask } from '../utils/subtasks';
import {
  X, Plus, Trash2, Home, CheckSquare, Square,
  UserPlus, AlertCircle, ShieldAlert, CornerDownRight, Check
} from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task | null;
  sprintId: number;
  currentUser: User | null;
  users: User[];
  properties: Property[];
  onSave: (taskData: any) => Promise<void>;
}

interface ModalSubtaskItem {
  id?: number;
  tempId: string;
  parentId: string | number | null;
  title: string;
  is_done: boolean;
  depth: number;
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
  const [subtasks, setSubtasks] = useState<ModalSubtaskItem[]>([]);
  const [newRootTitle, setNewRootTitle] = useState('');
  const [activeChildParentId, setActiveChildParentId] = useState<string | number | null>(null);
  const [newChildTitle, setNewChildTitle] = useState('');
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

      // Convertir les sous-tâches en liste plate hiérarchisée
      const tree = buildSubtaskTree(task.subtasks || []);
      const flat = flattenSubtaskTree(tree);
      setSubtasks(flat.map((s, idx) => ({
        id: s.id,
        tempId: `loaded-${s.id}-${idx}`,
        parentId: s.parent_id || null,
        title: s.title,
        is_done: !!s.is_done,
        depth: Math.min(s.depth, 3) // maximum 4 niveaux (0, 1, 2, 3)
      })));
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
    setActiveChildParentId(null);
    setNewChildTitle('');
    setError(null);
  }, [task, isOpen]);

  const handleUnplannedToggle = (checked: boolean) => {
    setIsUnplanned(checked);
    if (checked && !isEdit) {
      setStatus('done');
    }
  };

  // Ajout d'une sous-tâche racine (Niveau 1 / depth 0)
  const handleAddRootSubtask = () => {
    if (!newRootTitle.trim()) return;
    const newItem: ModalSubtaskItem = {
      tempId: `temp-${Date.now()}-${Math.random()}`,
      parentId: null,
      title: newRootTitle.trim(),
      is_done: false,
      depth: 0
    };
    setSubtasks([...subtasks, newItem]);
    setNewRootTitle('');
  };

  // Ajout d'une sous-tâche enfant (Niveau N+1, max 4 niveaux)
  const handleAddChildSubtask = (parentItem: ModalSubtaskItem) => {
    if (!newChildTitle.trim()) return;
    const parentRef = parentItem.id || parentItem.tempId;
    const newItem: ModalSubtaskItem = {
      tempId: `temp-${Date.now()}-${Math.random()}`,
      parentId: parentRef,
      title: newChildTitle.trim(),
      is_done: false,
      depth: Math.min(parentItem.depth + 1, 3)
    };

    // Insérer juste après le parent (ou après le dernier descendant du parent)
    const parentIndex = subtasks.findIndex(s => (s.id && s.id === parentItem.id) || s.tempId === parentItem.tempId);
    if (parentIndex !== -1) {
      let insertIndex = parentIndex + 1;
      while (insertIndex < subtasks.length && subtasks[insertIndex].depth > parentItem.depth) {
        insertIndex++;
      }
      const updated = [...subtasks];
      updated.splice(insertIndex, 0, newItem);
      setSubtasks(updated);
    } else {
      setSubtasks([...subtasks, newItem]);
    }

    setNewChildTitle('');
    setActiveChildParentId(null);
  };

  // Suppression d'une sous-tâche et de tous ses descendants
  const handleRemoveSubtask = (itemToRemove: ModalSubtaskItem) => {
    const idsToRemove = new Set<string | number>();
    const markDescendants = (targetId: string | number) => {
      idsToRemove.add(targetId);
      subtasks.forEach(s => {
        if (s.parentId === targetId) {
          markDescendants(s.id || s.tempId);
        }
      });
    };
    markDescendants(itemToRemove.id || itemToRemove.tempId);

    setSubtasks(subtasks.filter(s => !idsToRemove.has(s.id || s.tempId)));
  };

  const handleToggleSubtask = (index: number) => {
    setSubtasks(
      subtasks.map((s, i) => i === index ? { ...s, is_done: !s.is_done } : s)
    );
  };

  const handleUpdateSubtaskTitle = (index: number, newTitle: string) => {
    setSubtasks(
      subtasks.map((s, i) => i === index ? { ...s, title: newTitle } : s)
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
      // Préparation du payload de sous-tâches hiérarchisées
      const formattedSubtasks = subtasks.map((st, idx) => ({
        id: st.id,
        temp_id: st.tempId,
        parent_id: typeof st.parentId === 'number' ? st.parentId : null,
        parent_temp_id: typeof st.parentId === 'string' ? st.parentId : null,
        title: st.title.trim(),
        is_done: st.is_done ? 1 : 0,
        position: idx + 1
      }));

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
        subtasks: formattedSubtasks
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

  const canModifyAssignment = isAdmin || (!isEdit && currentUser?.role === 'write');

  const getDepthStyle = (depth: number) => {
    switch (depth) {
      case 1:
        return 'ml-4 pl-3 border-l-2 border-indigo-400 bg-indigo-50/20';
      case 2:
        return 'ml-8 pl-3 border-l-2 border-amber-400 bg-amber-50/20';
      case 3:
        return 'ml-12 pl-3 border-l-2 border-emerald-400 bg-emerald-50/20';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  const getDepthBadge = (depth: number) => {
    const labels = ['Niv. 1', 'Niv. 2', 'Niv. 3', 'Niv. 4'];
    const colors = [
      'bg-slate-200 text-slate-700',
      'bg-indigo-100 text-indigo-700',
      'bg-amber-100 text-amber-700',
      'bg-emerald-100 text-emerald-700'
    ];
    return (
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${colors[depth] || colors[0]}`}>
        {labels[depth] || 'Niv. 4'}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-4 sm:my-8 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div>
            <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">
              {isEdit ? 'Détails de la tâche' : 'Nouvelle tâche'}
            </span>
            <h2 className="text-base sm:text-lg font-bold">
              {isEdit ? task.title : 'Créer une tâche pour le sprint'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulaire défilant */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          
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

          {/* Description & Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Notes & Commentaires (format « → ... »)
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Dans l'attente du retour devis, contact pris..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          {/* Logement & Responsable (2 colonnes) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Logement concerné
              </label>
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

          {/* Sous-tâches (Checklist multi-niveaux jusqu'à 4 niveaux) */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Sous-tâches hiérarchiques (jusqu'à 4 niveaux)
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                {subtasks.filter(s => s.is_done).length}/{subtasks.length} validées
              </span>
            </div>

            {/* Arborescence de sous-tâches */}
            <div className="space-y-2 mb-3 max-h-52 overflow-y-auto pr-1">
              {subtasks.map((sub, idx) => {
                const subRef = sub.id || sub.tempId;
                const isAddingChildHere = activeChildParentId === subRef;

                return (
                  <div key={sub.tempId || idx} className="space-y-1">
                    <div className={`flex items-center justify-between gap-2 p-1.5 rounded-lg border text-xs ${getDepthStyle(sub.depth)}`}>
                      <button
                        type="button"
                        onClick={() => handleToggleSubtask(idx)}
                        className="flex items-center gap-1.5 text-left shrink-0 cursor-pointer"
                      >
                        {sub.is_done ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 shrink-0" />
                        )}
                      </button>

                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {getDepthBadge(sub.depth)}
                        <input
                          type="text"
                          value={sub.title}
                          onChange={(e) => handleUpdateSubtaskTitle(idx, e.target.value)}
                          className={`flex-1 bg-transparent border-0 p-0 text-xs font-medium focus:outline-none focus:ring-0 ${
                            sub.is_done ? 'line-through text-slate-400' : 'text-slate-800'
                          }`}
                        />
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Bouton pour ajouter un sous-niveau si depth < 3 */}
                        {sub.depth < 3 && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveChildParentId(isAddingChildHere ? null : subRef);
                              setNewChildTitle('');
                            }}
                            className="p-1 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded cursor-pointer"
                            title={`Ajouter une sous-tâche de niveau ${sub.depth + 2}`}
                          >
                            <CornerDownRight className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Bouton supprimer */}
                        <button
                          type="button"
                          onClick={() => handleRemoveSubtask(sub)}
                          className="p-1 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                          title="Supprimer cette sous-tâche et ses enfants"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Champ d'ajout sous-niveau inline */}
                    {isAddingChildHere && (
                      <div className={`flex items-center gap-2 py-1 ${getDepthStyle(Math.min(sub.depth + 1, 3))}`}>
                        <input
                          type="text"
                          autoFocus
                          placeholder={`Sous-tâche de niveau ${sub.depth + 2}...`}
                          value={newChildTitle}
                          onChange={(e) => setNewChildTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddChildSubtask(sub);
                            } else if (e.key === 'Escape') {
                              setActiveChildParentId(null);
                            }
                          }}
                          className="flex-1 px-2.5 py-1 border border-brand-300 rounded text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddChildSubtask(sub)}
                          className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded text-xs font-semibold cursor-pointer"
                        >
                          Ajouter
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveChildParentId(null)}
                          className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {subtasks.length === 0 && (
                <div className="p-3 border-2 border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                  Aucune sous-tâche. Ajoutez une première sous-étape ci-dessous.
                </div>
              )}
            </div>

            {/* Input nouvelle sous-tâche principale (Niveau 1) */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Ajouter une sous-tâche principale (Niveau 1)..."
                value={newRootTitle}
                onChange={(e) => setNewRootTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddRootSubtask();
                  }
                }}
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddRootSubtask}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter
              </button>
            </div>
          </div>

          {/* Option Réalisation Complémentaire */}
          <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
            <input
              type="checkbox"
              id="is_unplanned"
              checked={isUnplanned}
              onChange={(e) => handleUnplannedToggle(e.target.checked)}
              className="w-4 h-4 rounded text-brand-600 border-slate-300 focus:ring-brand-500"
            />
            <label htmlFor="is_unplanned" className="text-xs text-slate-600 select-none">
              <strong>Réalisation complémentaire</strong> (réalisée hors plan d'action initial)
            </label>
          </div>

          {/* Footer boutons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-bold shadow-md shadow-brand-600/30 transition-all cursor-pointer"
            >
              {isSubmitting ? 'Enregistrement...' : isEdit ? 'Enregistrer les modifications' : 'Créer la tâche'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
