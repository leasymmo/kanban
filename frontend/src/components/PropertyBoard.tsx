import React, { useEffect, useRef, useState } from 'react';
import { Task, Property, User, TaskStatus } from '../types';
import { TaskCard } from './TaskCard';
import { useCardDragAndDrop } from '../hooks/useCardDragAndDrop';
import { ensureWhiteTextContrast } from '../utils/color';
import { getUserPreferences, saveUserPreferences } from '../utils/cookies';
import { Badge, ProgressBar } from './ui';
import { Home, Plus, EyeOff, Eye } from 'lucide-react';

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
  const [hideEmptyProperties, setHideEmptyProperties] = useState<boolean>(() => {
    if (!currentUser) return true;
    return getUserPreferences(currentUser.id).hideEmptyProperties ?? true;
  });
  const [activePropertyId, setActivePropertyId] = useState<number | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUser) {
      setHideEmptyProperties(true);
      return;
    }
    const prefs = getUserPreferences(currentUser.id);
    setHideEmptyProperties(prefs.hideEmptyProperties ?? true);
  }, [currentUser?.id]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const handleWheel = (e: WheelEvent) => {
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);

      // 1. Trackpad horizontal swipe (2 doigts gauche/droite) : toujours scroller le rail
      if (absX > absY && absX > 0) {
        rail.scrollLeft += e.deltaX;
        e.preventDefault();
        return;
      }

      // 2. Shift + molette : scroll horizontal
      if (e.shiftKey && absY > 0) {
        rail.scrollLeft += e.deltaY;
        e.preventDefault();
        return;
      }

      // 3. Molette souris verticale : si la colonne survolée n'a pas de scroll vertical utile,
      //    scroller le rail horizontalement
      if (absY > 0) {
        const target = e.target as HTMLElement | null;
        const vList = target?.closest('.cdh-prop-scroll') as HTMLElement | null;
        if (vList && vList.scrollHeight > vList.clientHeight + 1) {
          const atTop = vList.scrollTop <= 0;
          const atBottom = vList.scrollTop + vList.clientHeight >= vList.scrollHeight - 1;
          if (!((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0))) {
            return; // Laisser la colonne scroller verticalement
          }
        }
        if (rail.scrollWidth > rail.clientWidth) {
          rail.scrollLeft += e.deltaY;
          e.preventDefault();
        }
      }
    };

    rail.addEventListener('wheel', handleWheel, { passive: false });
    return () => rail.removeEventListener('wheel', handleWheel);
  }, [hideEmptyProperties, properties.length, tasks.length]);

  const handleToggleHideEmpty = () => {
    setHideEmptyProperties(prev => {
      const next = !prev;
      if (currentUser) {
        saveUserPreferences(currentUser.id, { hideEmptyProperties: next });
      }
      return next;
    });
  };

  const allSections = [
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

  const sections = hideEmptyProperties
    ? allSections.filter(s => s.tasks.length > 0)
    : allSections;

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

  const scrollToProperty = (propertyId: number) => {
    setActivePropertyId(propertyId);
    const el = document.getElementById(`property-col-${propertyId}`);
    const container = railRef.current;
    if (el && container) {
      const targetLeft = el.offsetLeft - (container.clientWidth - el.clientWidth) / 2;
      container.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
    }
  };

  if (allSections.length === 0) {
    return (
      <div className="cdh-glass-column rounded-cdh-2xl p-10 text-center">
        <EyeOff className="w-8 h-8 mx-auto mb-2.5 text-[var(--cdh-text-tertiary)]" strokeWidth={1.75} />
        <p className="text-sm font-semibold text-[var(--cdh-text-primary)]">Tous les logements sont actuellement masqués.</p>
        <p className="text-xs text-[var(--cdh-text-secondary)] mt-1">Sélectionnez au moins un logement dans le filtre « Logements » ci-dessus.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 min-w-0 w-full flex flex-col gap-2.5">
      {/* Barre d'accès rapide par logement + toggle masquer vides */}
      <div className="shrink-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
          {sections.map((section) => {
            const isActive = activePropertyId === section.id;
            const remaining = section.tasks.filter(t => t.status !== 'done').length;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToProperty(section.id)}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 min-h-[32px] rounded-full text-[11.5px] font-semibold transition-all active:scale-[0.98] cursor-pointer tabular-nums ${
                  isActive
                    ? 'bg-[var(--cdh-text-primary)] text-[var(--cdh-text-inverted)] shadow-sm'
                    : 'cdh-glass-chrome text-[var(--cdh-text-primary)] hover:opacity-85'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: section.color || '#007AFF' }}
                />
                <span className="truncate max-w-[140px]">{section.name}</span>
                <span className="opacity-70 text-[10.5px]">
                  {remaining > 0 ? remaining : section.tasks.length}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          aria-pressed={hideEmptyProperties}
          onClick={handleToggleHideEmpty}
          className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 min-h-[32px] rounded-full text-[11.5px] font-semibold transition-all cursor-pointer ${
            hideEmptyProperties
              ? 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-accent)]'
              : 'cdh-glass-chrome text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)]'
          }`}
          title="Afficher ou masquer les logements sans tâche"
        >
          {hideEmptyProperties ? (
            <Eye className="w-3.5 h-3.5" strokeWidth={2} />
          ) : (
            <EyeOff className="w-3.5 h-3.5" strokeWidth={2} />
          )}
          <span className="hidden sm:inline">
            {hideEmptyProperties ? 'Tout afficher' : 'Masquer vides'}
          </span>
        </button>
      </div>

      {/* Rail horizontal en colonnes à hauteur fixe plein écran (Option A) */}
      {sections.length === 0 ? (
        <div className="cdh-glass-column rounded-cdh-2xl p-10 text-center">
          <EyeOff className="w-8 h-8 mx-auto mb-2.5 text-[var(--cdh-text-tertiary)]" strokeWidth={1.75} />
          <p className="text-sm font-semibold text-[var(--cdh-text-primary)]">Aucun logement avec des tâches pour ces filtres.</p>
          <button
            type="button"
            onClick={handleToggleHideEmpty}
            className="mt-2 text-xs font-semibold text-[var(--cdh-accent)] hover:underline cursor-pointer"
          >
            Afficher aussi les logements vides
          </button>
        </div>
      ) : (
        <div
          ref={railRef}
          className="flex-1 min-h-0 min-w-0 flex gap-3.5 sm:gap-4 items-stretch overflow-x-auto overflow-y-hidden overscroll-x-contain snap-x snap-mandatory sm:snap-none pb-2 -mx-3 px-3 sm:mx-0 sm:px-0"
        >
          {sections.map((section) => {
            const total = section.tasks.length;
            const doneCount = section.tasks.filter(t => t.status === 'done').length;
            const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;
            const isHovered = activeDropContainer === section.id;

            return (
              <div
                key={section.id}
                id={`property-col-${section.id}`}
                onDragOver={(e) => handleDragOverContainer(e, section.id)}
                onDragLeave={handleDragLeaveContainer}
                onDrop={(e) => handleDropOnContainer(e, section.id)}
                className={`cdh-glass-column rounded-cdh-2xl p-3 sm:p-3.5 flex flex-col h-full min-h-0 w-[calc(100vw-2.25rem)] max-w-[350px] sm:w-[330px] shrink-0 snap-center sm:snap-start transition-all duration-200 ${
                  isHovered ? 'ring-2 ring-[var(--cdh-accent)]/50 border-[var(--cdh-accent)]' : ''
                }`}
              >
                {/* Entête fixe du Logement */}
                <div className="shrink-0">
                  <div className="flex items-center justify-between pb-2.5 border-b border-[var(--cdh-border-hairline)] mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-cdh-sm flex items-center justify-center text-white shadow-xs shrink-0"
                        style={{ backgroundColor: ensureWhiteTextContrast(section.color) }}
                      >
                        <Home className="w-3.5 h-3.5" strokeWidth={2} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-semibold text-[13px] text-[var(--cdh-text-primary)] leading-tight truncate">
                            {section.name}
                          </h3>
                          {section.isDeactivated && (
                            <Badge variant="neutral">Désactivé</Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--cdh-text-secondary)] font-medium tabular-nums">
                          {doneCount}/{total} terminées ({percent}%)
                        </p>
                      </div>
                    </div>

                    {showQuickAddButtons && (
                      <button
                        type="button"
                        onClick={() => onAddNewTask(section.id > 0 ? section.id : undefined)}
                        aria-label={`Ajouter une tâche pour ${section.name}`}
                        className="p-1.5 text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] rounded-full transition-colors cursor-pointer shrink-0"
                        title={`Ajouter une tâche pour ${section.name}`}
                      >
                        <Plus className="w-4 h-4" strokeWidth={2} />
                      </button>
                    )}
                  </div>

                  <ProgressBar value={percent} label={`Progression ${section.name}`} className="mb-2.5" />
                </div>

                {/* Liste des cartes avec scroll vertical interne uniquement */}
                <div className="cdh-prop-scroll space-y-2.5 flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-0.5">
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
                    <p
                      className={`py-8 px-3 text-center text-xs text-[var(--cdh-text-tertiary)] font-medium select-none transition-colors rounded-cdh-lg ${
                        isHovered
                          ? 'border-2 border-dashed border-[var(--cdh-accent)] bg-[var(--cdh-accent-soft)] text-[var(--cdh-accent)]'
                          : 'border border-dashed border-[var(--cdh-border-hairline)]'
                      }`}
                    >
                      {isReadOnly || currentUser?.role === 'read' ? 'Aucune tâche' : 'Déposer une tâche ici'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
