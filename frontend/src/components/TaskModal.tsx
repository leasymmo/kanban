import React, { useState, useEffect, useCallback, useId, useMemo } from 'react';
import { Task, User, Property, TaskPriority, TaskStatus } from '../types';
import { useSubtaskTreeEditor } from '../hooks/useSubtaskTreeEditor';
import { SubtaskTreeEditor } from './task-modal/SubtaskTreeEditor';
import { Badge, Button, Modal, PropertySelectField, TaskMetaBar } from './ui';
import { AlertCircle, ClipboardList, Sparkles, Zap } from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task | null;
  sprintId: number;
  currentUser: User | null;
  users: User[];
  properties: Property[];
  initialStatus?: TaskStatus;
  initialPropertyId?: number | null;
  initialAssignedTo?: number | null;
  creationSource?: 'tasks' | 'meeting';
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
  initialStatus = 'todo',
  initialPropertyId = null,
  initialAssignedTo,
  creationSource = 'tasks',
  onSave
}) => {
  const isEdit = !!task;
  const isAdmin = currentUser?.role === 'admin';
  const assignableUsers = useMemo(
    () => (isAdmin ? users : users.filter((u) => u.id === currentUser?.id)),
    [isAdmin, users, currentUser?.id]
  );

  const titleInputId = useId();
  const notesInputId = useId();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [propertyId, setPropertyId] = useState<number | ''>('');
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<number[]>([]);
  const [assignedTo, setAssignedTo] = useState<number | ''>('');
  const [dueDate, setDueDate] = useState('');
  const [isStarred, setIsStarred] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    subtaskTree,
    stats: subtaskStats,
    initFromSubtasks,
    resetTree,
    addRootSubtask,
    addChildSubtask,
    removeSubtask,
    toggleSubtask,
    updateSubtaskTitle,
    reorderSiblings,
    flattenForSubmit,
  } = useSubtaskTreeEditor();

  useEffect(() => {
    if (!isOpen) return;

    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatus(task.status === 'pending' ? 'todo' : task.status);
      setPriority(task.priority);
      setPropertyId(task.property_id || '');
      setSelectedPropertyIds(task.property_id ? [task.property_id] : []);
      setAssignedTo(task.assigned_to || currentUser?.id || assignableUsers[0]?.id || '');
      setDueDate(task.due_date ? task.due_date.substring(0, 10) : '');
      setIsStarred(!!task.is_starred);
      initFromSubtasks(task.subtasks || []);
    } else {
      setTitle('');
      setDescription('');
      setStatus(initialStatus || 'todo');
      setPriority('medium');
      setPropertyId(initialPropertyId || '');
      setSelectedPropertyIds(initialPropertyId ? [initialPropertyId] : []);
      if (isAdmin) {
        if (initialAssignedTo !== undefined) {
          setAssignedTo(initialAssignedTo || '');
        } else {
          setAssignedTo(currentUser?.id || assignableUsers[0]?.id || '');
        }
      } else {
        setAssignedTo(currentUser?.id || assignableUsers[0]?.id || '');
      }
      setDueDate('');
      setIsStarred(false);
      resetTree();
    }
    setError(null);
  }, [
    task,
    isOpen,
    initialStatus,
    initialPropertyId,
    initialAssignedTo,
    isAdmin,
    currentUser?.id,
    assignableUsers,
    initFromSubtasks,
    resetTree,
  ]);

  const toggleSelectedProperty = useCallback((propId: number) => {
    setSelectedPropertyIds((prev) =>
      prev.includes(propId) ? prev.filter((id) => id !== propId) : [...prev, propId]
    );
  }, []);

  const handleSelectAllProperties = useCallback(
    () => setSelectedPropertyIds(properties.map((p) => p.id)),
    [properties]
  );
  const handleSelectNoProperties = useCallback(() => setSelectedPropertyIds([]), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Le titre de la tâche est obligatoire.');
      return;
    }

    const effectiveAssignedTo = isAdmin
      ? assignedTo !== ''
        ? Number(assignedTo)
        : null
      : isEdit && task?.assigned_to
      ? task.assigned_to
      : currentUser?.id ?? null;

    if (!effectiveAssignedTo && (!isEdit || task?.status !== 'pending')) {
      setError('Un associé responsable est obligatoire.');
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
        assigned_to: effectiveAssignedTo,
        due_date: dueDate || null,
        is_starred: isStarred ? 1 : 0,
        subtasks: flattenForSubmit(),
      };

      if (isEdit && task) {
        payload.id = task.id;
        payload.property_id = propertyId !== '' ? Number(propertyId) : null;
      } else {
        payload.property_ids = selectedPropertyIds;
        payload.created_from = creationSource;
        payload.is_unplanned = creationSource === 'tasks' ? 1 : 0;
      }

      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue lors de l’enregistrement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const multiCount = !isEdit ? selectedPropertyIds.length : 1;
  const isMultiCreate = !isEdit && multiCount > 1;
  const showUnplannedBadge = isEdit ? !!task?.is_unplanned : creationSource === 'tasks';

  const modalTitle = isEdit
    ? task.title
    : isMultiCreate
    ? `Créer ${multiCount} tâches similaires`
    : 'Nouvelle tâche';

  const headerBadge = showUnplannedBadge ? (
    <Badge variant="success">
      <Zap className="w-2.5 h-2.5" strokeWidth={2.25} />
      Complémentaire
    </Badge>
  ) : isEdit && task?.is_new ? (
    <Badge variant="accent">
      <Sparkles className="w-2.5 h-2.5" strokeWidth={2.25} />
      Nouveau
    </Badge>
  ) : (
    <Badge variant="accent">
      <ClipboardList className="w-2.5 h-2.5" strokeWidth={2.25} />
      Planifiée
    </Badge>
  );

  const footer = (
    <div className="w-full flex flex-wrap items-center justify-between gap-2.5">
      <TaskMetaBar
        users={assignableUsers}
        assignedTo={assignedTo}
        onChangeAssignee={setAssignedTo}
        showAssignee={isAdmin}
        status={status}
        onChangeStatus={setStatus}
        priority={priority}
        onChangePriority={setPriority}
        dueDate={dueDate}
        onChangeDueDate={setDueDate}
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
            : 'Créer la tâche'}
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
          autoFocus={!isEdit}
          enterKeyHint="done"
          required
          placeholder="Ex: Vérifier le détecteur de fumée..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-1.5 bg-[var(--cdh-surface-input)] border border-[var(--cdh-border-subtle)] rounded-cdh-md text-sm text-[var(--cdh-text-primary)] font-medium placeholder:text-[var(--cdh-text-tertiary)] focus:border-[var(--cdh-border-focus)] focus:ring-2 focus:ring-[var(--cdh-accent-soft)] focus:outline-none"
        />
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
          placeholder="Précisions, suivi devis, contact..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-1.5 bg-[var(--cdh-surface-input)] border border-[var(--cdh-border-subtle)] rounded-cdh-md text-sm text-[var(--cdh-text-primary)] placeholder:text-[var(--cdh-text-tertiary)] focus:border-[var(--cdh-border-focus)] focus:ring-2 focus:ring-[var(--cdh-accent-soft)] focus:outline-none"
        />
      </div>

      <SubtaskTreeEditor
        nodes={subtaskTree}
        stats={subtaskStats}
        isOpen={isOpen}
        onAddRoot={addRootSubtask}
        onAddChild={addChildSubtask}
        onRemove={removeSubtask}
        onToggle={toggleSubtask}
        onUpdateTitle={updateSubtaskTitle}
        onReorderSiblings={reorderSiblings}
      />

      <PropertySelectField
        isEdit={isEdit}
        properties={properties}
        propertyId={propertyId}
        onChangePropertyId={setPropertyId}
        selectedPropertyIds={selectedPropertyIds}
        onToggleSelectedProperty={toggleSelectedProperty}
        onSelectAll={handleSelectAllProperties}
        onSelectNone={handleSelectNoProperties}
        orphanProperty={
          task?.property_id ? { id: task.property_id, name: task.property_name } : null
        }
      />
    </Modal>
  );
};
