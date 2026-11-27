import React from 'react';
import { Task, Property, User, TaskStatus } from '../types';
import { TaskCard } from './TaskCard';
import { useCardDragAndDrop } from '../hooks/useCardDragAndDrop';
import { ensureWhiteTextContrast } from '../utils/color';
import { Badge, ProgressBar } from './ui';
import { Home, Plus, EyeOff } from 'lucide-react';

interface PropertyBoardProps {
  tasks: Task[];
  properties: Property[];
  hiddenPropertyIds?: number[];
  currentUser: User | null;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onAddSubtask?: (taskId: number, title: string, parentId?: number | null) => Promise<void>;
  onUpdateStatus?: (taskId: number, newStatus: TaskStatus) => void;
  onMoveTaskProperty?: (taskId: number, targetPropertyId: number | null, orderedSectionTaskIds: number[]) => void;
  onToggleStar?: (taskId: number) => void;
  onAddNewTask: (propertyId?: number) => void;
  canAddTasks?: boolean;
  isReadOnly: boolean;
}

export const PropertyBoard: React.FC<PropertyBoardProps> = ({
  tasks,
  properties,
  hiddenPropertyIds = [],
  currentUser,
  onEditTask,
  onDeleteTask,
  onToggleSubtask,
  onAddSubtask,
  onUpdateStatus,
  onMoveTaskProperty,
  onToggleStar,
  onAddNewTask,
  canAddTasks,
  isReadOnly
}) => {
  const showQuickAddButtons =
    canAddTasks !== undefined ? canAddTasks : (!isReadOnly && currentUser?.role === 'admin');
  const sections = [
    ...properties.map(p => ({
      id: p.id,
      name: p.name,
      code: p.code,
      color: p.color,
      isDeactivated: Number(p.is_active) === 0,
      tasks: tasks.filter(t => t.property_id === p.id)
    })),
    {
      id: 0,
      name: 'Général / Sans logement',
      code: 'GEN',
      color: '#64748B',
      isDeactivated: false,
      tasks: tasks.filter(t => !t.property_id)
    }
  ].filter(section => !hiddenPropertyIds.includes(section.id));

  const {
    draggedTaskId,
    activeDropContainer,
    dropTarget,
    resetDragState,
    handleDragStart,
    handleDragOverContainer,
    handleDragLeaveContainer,
    handleDragOverCard,
    handleDropOnCard,
    handleDropOnContainer
  } = useCardDragAndDrop<number>({
    tasks,
    getContainerId: (t) => t.property_id || 0,
    isReadOnly,
    onDropReorder: (draggedTask, targetSectionId, orderedSectionTaskIds) => {
      if (onMoveTaskProperty) {
        const targetPropertyId = targetSectionId > 0 ? targetSectionId : null;
        onMoveTaskProperty(draggedTask.id, targetPropertyId, orderedSectionTaskIds);
      }
    }
  });

  const getGridClass = (count: number) => {
    if (count <= 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-1 md:grid-cols-2';
    return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';
  };

  const listMaxHeightClass =
    sections.length <= 2 ? 'md:max-h-[calc(100dvh-300px)]' : 'md:max-h-[480px]';

  if (sections.length === 0) {
    return (
      <div className="cdh-glass-column rounded-cdh-2xl p-10 text-center">
        <EyeOff className="w-8 h-8 mx-auto mb-2.5 text-[var(--cdh-text-tertiary)]" strokeWidth={1.75} />
        <p className="text-sm font-semibold text-[var(--cdh-text-primary)]">Tous les logements sont actuellement masqués.</p>
        <p className="text-xs text-[var(--cdh-text-secondary)] mt-1">Sélectionnez au moins un logement dans le filtre « Logements » ci-dessus.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={`grid ${getGridClass(sections.length)} gap-4`}>
        {sections.map((section) => {
          const total = section.tasks.length;
          const doneCount = section.tasks.filter(t => t.status === 'done').length;
          const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;
          const isHovered = activeDropContainer === section.id;

          return (
            <div
              key={section.id}
              onDragOver={(e) => handleDragOverContainer(e, section.id)}
              onDragLeave={handleDragLeaveContainer}
              onDrop={(e) => handleDropOnContainer(e, section.id)}
              className={`cdh-glass-column rounded-cdh-2xl p-3.5 sm:p-4 flex flex-col min-h-[160px] md:min-h-[340px] transition-all duration-200 ${
                isHovered ? 'ring-2 ring-[var(--cdh-accent)]/50 border-[var(--cdh-accent)]' : ''
              }`}
            >
              {/* Entête du Logement */}
              <div className="flex items-center justify-between pb-3 border-b border-[var(--cdh-border-hairline)] mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-cdh-md flex items-center justify-center text-white shadow-xs shrink-0"
                    style={{ backgroundColor: ensureWhiteTextContrast(section.color) }}
                  >
                    <Home className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-semibold text-sm text-[var(--cdh-text-primary)] leading-tight">
                        {section.name}
                      </h3>
                      {section.isDeactivated && (
                        <Badge variant="neutral">Désactivé</Badge>
                      )}
                    </div>
                    <p className="text-[11.5px] text-[var(--cdh-text-secondary)] font-medium tabular-nums">
                      {doneCount}/{total} terminées ({percent}%)
                    </p>
                  </div>
                </div>

                {showQuickAddButtons && (
                  <button
                    onClick={() => onAddNewTask(section.id > 0 ? section.id : undefined)}
                    aria-label={`Ajouter une tâche pour ${section.name}`}
                    className="p-1.5 text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] rounded-full transition-colors cursor-pointer"
                    title={`Ajouter une tâche pour ${section.name}`}
                  >
                    <Plus className="w-4 h-4" strokeWidth={2} />
                  </button>
                )}
              </div>

              {/* Mini barre de progression */}
              <ProgressBar value={percent} label={`Progression ${section.name}`} className="mb-3" />

              {/* Cartes de tâches du logement */}
              <div className={`space-y-2.5 flex-1 md:overflow-y-auto ${listMaxHeightClass} md:pr-0.5`}>
                {section.tasks.length > 0 ? (
                  section.tasks.map((task) => {
                    const indicator =
                      dropTarget?.containerId === section.id && dropTarget?.taskId === task.id
                        ? dropTarget.position
                        : null;
                    return (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isReadOnly={isReadOnly}
                        onEdit={onEditTask}
                        onDelete={onDeleteTask}
                        onToggleSubtask={onToggleSubtask}
                        onAddSubtask={onAddSubtask}
                        onUpdateStatus={onUpdateStatus}
                        onToggleStar={onToggleStar}
                        onDragStart={handleDragStart}
                        onDragEnd={resetDragState}
                        onDragOverCard={(e, t) => handleDragOverCard(e, t, section.id)}
                        onDropOnCard={(e, t) => handleDropOnCard(e, t, section.id)}
                        dropIndicator={indicator}
                        isDragging={draggedTaskId === task.id}
                      />
                    );
                  })
                ) : (
                  <p className={`py-8 px-3 text-center text-xs text-[var(--cdh-text-tertiary)] font-medium select-none transition-colors rounded-cdh-lg ${
                    isHovered
                      ? 'border-2 border-dashed border-[var(--cdh-accent)] bg-[var(--cdh-accent-soft)] text-[var(--cdh-accent)]'
                      : 'border border-dashed border-[var(--cdh-border-hairline)]'
                  }`}>
                    {isReadOnly || currentUser?.role === 'read' ? 'Aucune tâche' : 'Déposer une tâche ici'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
