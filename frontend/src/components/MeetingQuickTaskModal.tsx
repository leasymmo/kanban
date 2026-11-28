import React, { useState, useEffect, useCallback, useId, useMemo } from 'react';
import { Task, User, Property, TaskPriority } from '../types';
import { ensureWhiteTextContrast } from '../utils/color';
import { Avatar, Badge, Button, Modal, PropertySelectField, TaskMetaBar } from './ui';
import { Sparkles, Plus, Trash2, AlertCircle } from 'lucide-react';

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
  const assignableUsers = useMemo(
    () => (isAdmin ? users : users.filter((u) => u.id === currentUser?.id)),
    [isAdmin, users, currentUser?.id]
  );

  const titleInputId = useId();
  const notesInputId = useId();
  const subtaskInputId = useId();

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
    setSelectedPropertyIds((prev) =>
      prev.includes(propId) ? prev.filter((id) => id !== propId) : [...prev, propId]
    );
  }, []);

  const handleSelectAllProperties = useCallback(
    () => setSelectedPropertyIds(properties.map((p) => p.id)),
    [properties]
  );
  const handleSelectNoProperties = useCallback(() => setSelectedPropertyIds([]), []);

  const handleAddSubtask = () => {
    const clean = newSubtaskTitle.trim();
    if (!clean) return;
    setSubtasks((prev) => [
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
        .filter((st) => st.title.trim() !== '')
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
  const modalTitle = isEdit
    ? editingTask?.title || 'Modifier la tâche'
    : isMultiCreate
    ? `Créer ${multiCount} tâches en attente`
    : 'Nouvelle tâche en attente';

  const headerBadge = (
    <Badge variant="accent">
      <Sparkles className="w-2.5 h-2.5" strokeWidth={2.25} />
      {assignedTo === '' ? `En attente · Point ${nextSprintNumber}` : `Point ${nextSprintNumber} · Nouveau`}
    </Badge>
  );

  const footer = (
    <div className="w-full flex flex-wrap items-center justify-between gap-2.5">
      <TaskMetaBar
        users={assignableUsers}
        assignedTo={assignedTo}
        onChangeAssignee={setAssignedTo}
        showAssignee={false}
        status="todo"
        onChangeStatus={() => {}}
        showStatus={false}
        priority={priority}
        onChangePriority={setPriority}
        dueDate={dueDate}
        onChangeDueDate={setDueDate}
        markOverdue={true}
      />

      <div className="flex items-center gap-2 shrink-0 ml-auto">
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
          isLoading={isSubmitting}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? 'Enregistrement...'
            : isEdit
            ? 'Enregistrer'
            : isMultiCreate
            ? `Créer les ${multiCount} tâches`
            : 'Mettre en attente'}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      headerBadge={headerBadge}
      maxWidthClass="max-w-xl"
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
          Intitulé {isMultiCreate ? 'des tâches' : 'de la tâche'} *
        </label>
        <input
          id={titleInputId}
          type="text"
          autoFocus
          required
          placeholder="Ex: Contacter le serrurier, préparer devis propriétaire..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-1.5 bg-[var(--cdh-surface-input)] border border-[var(--cdh-border-subtle)] rounded-cdh-md text-sm font-medium text-[var(--cdh-text-primary)] placeholder:text-[var(--cdh-text-tertiary)] focus:border-[var(--cdh-border-focus)] focus:ring-2 focus:ring-[var(--cdh-accent-soft)] focus:outline-none"
        />
      </div>

      <div className="pt-2.5 border-t border-[var(--cdh-border-hairline)]">
        <span className="block text-[11px] font-bold text-[var(--cdh-text-secondary)] uppercase tracking-wider mb-1.5">
          Responsable
        </span>
        {!isAdmin && isEdit && editingTask?.assigned_to && editingTask.assigned_to !== currentUser?.id ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-[var(--cdh-border-subtle)] bg-[var(--cdh-surface-control)] text-[var(--cdh-text-secondary)]">
            <span>Attribuée à {editingTask.assigned_to_name || `#${editingTask.assigned_to}`} (lecture seule)</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {assignableUsers.map((u) => {
              const isSelected = assignedTo === u.id;
              const avatarBg = ensureWhiteTextContrast(u.avatar_color);
              const firstName = u.name.split(' ')[0];
              return (
                <button
                  type="button"
                  key={u.id}
                  aria-pressed={isSelected}
                  onClick={() => setAssignedTo(isSelected ? '' : u.id)}
                  className={`inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 min-h-[32px] rounded-full text-xs font-semibold border transition-all active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'text-white border-transparent shadow-xs'
                      : 'bg-[var(--cdh-surface-card)] text-[var(--cdh-text-primary)] border-[var(--cdh-border-subtle)] hover:bg-[var(--cdh-surface-control)]'
                  }`}
                  style={isSelected ? { backgroundColor: avatarBg } : undefined}
                >
                  <Avatar
                    initials={u.initials}
                    color={avatarBg}
                    size="xs"
                    className={isSelected ? 'ring-white/40' : ''}
                  />
                  <span>{firstName}</span>
                </button>
              );
            })}
          </div>
        )}
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
          placeholder="Précisions actées pendant la réunion..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-1.5 bg-[var(--cdh-surface-input)] border border-[var(--cdh-border-subtle)] rounded-cdh-md text-sm text-[var(--cdh-text-primary)] placeholder:text-[var(--cdh-text-tertiary)] focus:border-[var(--cdh-border-focus)] focus:ring-2 focus:ring-[var(--cdh-accent-soft)] focus:outline-none"
        />
      </div>

      <div className="pt-2.5 border-t border-[var(--cdh-border-hairline)] space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor={subtaskInputId}
            className="text-[11px] font-bold text-[var(--cdh-text-secondary)] uppercase tracking-wider"
          >
            Sous-tâches
          </label>
          {subtasks.length > 0 && (
            <span className="text-[11px] text-[var(--cdh-text-secondary)] font-semibold bg-[var(--cdh-surface-control)] px-2 py-0.5 rounded-full tabular-nums">
              {subtasks.length} étape{subtasks.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {subtasks.length > 0 && (
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 py-0.5">
            {subtasks.map((st) => (
              <div
                key={st.temp_id}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-cdh-md bg-[var(--cdh-surface-card)] border border-[var(--cdh-border-hairline)] text-xs"
              >
                <span className="text-[var(--cdh-text-primary)] font-medium truncate">{st.title}</span>
                <button
                  type="button"
                  aria-label={`Retirer l'étape ${st.title}`}
                  onClick={() => setSubtasks((prev) => prev.filter((item) => item.temp_id !== st.temp_id))}
                  className="text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-danger)] cursor-pointer shrink-0 p-0.5 rounded"
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
            id={subtaskInputId}
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
            className="flex-1 min-w-0 px-3 py-1.5 bg-[var(--cdh-surface-input)] border border-[var(--cdh-border-subtle)] rounded-cdh-md text-xs text-[var(--cdh-text-primary)] placeholder:text-[var(--cdh-text-tertiary)] focus:border-[var(--cdh-border-focus)] focus:ring-2 focus:ring-[var(--cdh-accent-soft)] focus:outline-none"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleAddSubtask}
            leftIcon={<Plus className="w-3.5 h-3.5" strokeWidth={2} />}
            className="shrink-0"
          >
            Ajouter
          </Button>
        </div>
      </div>

      <PropertySelectField
        isEdit={isEdit}
        properties={properties}
        propertyId={propertyId}
        onChangePropertyId={setPropertyId}
        selectedPropertyIds={selectedPropertyIds}
        onToggleSelectedProperty={toggleProperty}
        onSelectAll={handleSelectAllProperties}
        onSelectNone={handleSelectNoProperties}
        orphanProperty={
          editingTask?.property_id
            ? { id: editingTask.property_id, name: editingTask.property_name }
            : null
        }
      />
    </Modal>
  );
};
