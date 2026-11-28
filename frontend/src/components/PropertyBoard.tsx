import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Task, Property, User, TaskPriority, TaskStatus, TaskGroupPage } from '../types';
import { TaskCard } from './TaskCard';
import { useCardDragAndDrop } from '../hooks/useCardDragAndDrop';
import {
  CreatedTaskBatch,
  getScrollBehavior,
  scrollContainersAndHighlightTasks,
} from '../utils/taskMotion';
import { ensureWhiteTextContrast } from '../utils/color';
import { Badge, InfiniteScrollSentinel, ProgressBar } from './ui';
import { Home, Plus, EyeOff, Eye } from 'lucide-react';

interface PropertySectionModel {
  id: number;
  key: string;
  name: string;
  color: string;
  isDeactivated: boolean;
  tasks: Task[];
  totalCount: number;
  doneCount: number;
  remainingCount: number;
  hasMore: boolean;
}

interface PropertyColumnViewProps {
  section: PropertySectionModel;
  isHovered: boolean;
  isLoadingMore: boolean;
  onLoadMore: (key: string) => void;
  showQuickAddButtons: boolean;
  allUsers: User[];
  currentUser: User | null;
  isReadOnly: boolean;
  draggedTaskId: number | null;
  dropTarget: { containerId: number; taskId: number; position: 'before' | 'after' } | null;
  onAddNewTask: (propertyId?: number) => void;
  onDragOverContainer: (e: React.DragEvent, sectionId: number) => void;
  onDragLeaveContainer: (e: React.DragEvent) => void;
  onDropOnContainer: (e: React.DragEvent, sectionId: number) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragEnd: () => void;
  onDragOverCard: (e: React.DragEvent, targetTask: Task) => void;
  onDropOnCard: (e: React.DragEvent, targetTask: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onAddSubtask?: (taskId: number, title: string, parentId?: number | null) => Promise<void>;
  onUpdateStatus?: (taskId: number, newStatus: TaskStatus) => void;
  onAssignTask?: (taskId: number, userId: number | null) => void;
  onQuickUpdateTask?: (taskId: number, patch: { priority?: TaskPriority; due_date?: string | null }) => void;
  onToggleStar?: (taskId: number) => void;
}

const PropertyColumnView: React.FC<PropertyColumnViewProps> = React.memo(({
  section,
  isHovered,
  isLoadingMore,
  onLoadMore,
  showQuickAddButtons,
  allUsers,
  currentUser,
  isReadOnly,
  draggedTaskId,
  dropTarget,
  onAddNewTask,
  onDragOverContainer,
  onDragLeaveContainer,
  onDropOnContainer,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onDropOnCard,
  onEditTask,
  onDeleteTask,
  onToggleSubtask,
  onAddSubtask,
  onUpdateStatus,
  onAssignTask,
  onQuickUpdateTask,
  onToggleStar,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const handleLoadMoreCol = useCallback(() => onLoadMore(section.key), [onLoadMore, section.key]);
  const percent =
    section.totalCount > 0 ? Math.round((section.doneCount / section.totalCount) * 100) : 0;

  return (
    <div
      onDragOver={(e) => onDragOverContainer(e, section.id)}
      onDragLeave={onDragLeaveContainer}
      onDrop={(e) => onDropOnContainer(e, section.id)}
      className={`cdh-glass-column rounded-cdh-2xl p-3 sm:p-3.5 flex flex-col h-full min-h-0 w-[calc(100vw-2.25rem)] max-w-[350px] sm:w-[330px] shrink-0 snap-center sm:snap-start transition-colors duration-150 ${
        isHovered ? 'ring-2 ring-[var(--cdh-accent)]/50 border-[var(--cdh-accent)]' : ''
      }`}
    >
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
                {section.isDeactivated && <Badge variant="neutral">Désactivé</Badge>}
              </div>
              <p className="text-[11px] text-[var(--cdh-text-secondary)] font-medium tabular-nums">
                {section.doneCount}/{section.totalCount} terminées ({percent}%)
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

        <ProgressBar value={percent} label={`Progression ${section.name}`} className="mb-1" />
      </div>

      <div
        ref={scrollRef}
        data-property-scroll={section.id}
        className="cdh-prop-scroll space-y-2.5 flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-2.5 -mx-2.5 pt-2.5 pb-4"
      >
        {section.tasks.length > 0 ? (
          <>
            {section.tasks.map((task) => {
              const indicator =
                dropTarget?.containerId === section.id && dropTarget?.taskId === task.id
                  ? dropTarget.position
                  : null;
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  allUsers={allUsers}
                  currentUser={currentUser}
                  isReadOnly={isReadOnly}
                  onEdit={onEditTask}
                  onDelete={onDeleteTask}
                  onToggleSubtask={onToggleSubtask}
                  onAddSubtask={onAddSubtask}
                  onUpdateStatus={onUpdateStatus}
                  onAssignTask={onAssignTask}
                  onQuickUpdateTask={onQuickUpdateTask}
                  onToggleStar={onToggleStar}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDragOverCard={onDragOverCard}
                  onDropOnCard={onDropOnCard}
                  dropIndicator={indicator}
                  isDragging={draggedTaskId === task.id}
                />
              );
            })}
            <InfiniteScrollSentinel
              rootRef={scrollRef}
              hasMore={section.hasMore}
              isLoadingMore={isLoadingMore}
              onLoadMore={handleLoadMoreCol}
              loadedCount={section.tasks.length}
              totalCount={section.totalCount}
              itemLabel="tâches"
            />
          </>
        ) : (
          <p
            className={`py-10 px-3 text-center text-xs text-[var(--cdh-text-tertiary)] font-medium select-none rounded-cdh-lg transition-colors ${
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
});

interface PropertyBoardProps {
  groups: Record<string, TaskGroupPage>;
  propertyCounts: Record<string, { total: number; done: number }>;
  allTasks: Task[];
  loadingMoreColumns: Record<string, boolean>;
  onLoadMoreColumn: (propertyKey: string) => void;
  hideEmptyProperties: boolean;
  onToggleHideEmpty: () => void;
  properties: Property[];
  allUsers?: User[];
  hiddenPropertyIds?: number[];
  currentUser: User | null;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onAddSubtask?: (taskId: number, title: string, parentId?: number | null) => Promise<void>;
  onUpdateStatus?: (taskId: number, newStatus: TaskStatus) => void;
  onAssignTask?: (taskId: number, userId: number | null) => void;
  onQuickUpdateTask?: (taskId: number, patch: { priority?: TaskPriority; due_date?: string | null }) => void;
  onMoveTaskProperty?: (taskId: number, targetPropertyId: number | null, orderedSectionTaskIds: number[]) => void;
  onToggleStar?: (taskId: number) => void;
  onAddNewTask: (propertyId?: number) => void;
  canAddTasks?: boolean;
  isReadOnly: boolean;
  lastCreatedBatch?: CreatedTaskBatch | null;
  isModalOpen?: boolean;
  onConsumeCreatedBatch?: () => void;
}

export const PropertyBoard: React.FC<PropertyBoardProps> = ({
  groups,
  propertyCounts,
  allTasks,
  loadingMoreColumns,
  onLoadMoreColumn,
  hideEmptyProperties,
  onToggleHideEmpty,
  properties,
  allUsers = [],
  hiddenPropertyIds = [],
  currentUser,
  onEditTask,
  onDeleteTask,
  onToggleSubtask,
  onAddSubtask,
  onUpdateStatus,
  onAssignTask,
  onQuickUpdateTask,
  onMoveTaskProperty,
  onToggleStar,
  onAddNewTask,
  canAddTasks,
  isReadOnly,
  lastCreatedBatch,
  isModalOpen = false,
  onConsumeCreatedBatch
}) => {
  const showQuickAddButtons =
    canAddTasks !== undefined ? canAddTasks : (!isReadOnly && currentUser?.role === 'admin');

  const [activePropertyId, setActivePropertyId] = useState<number | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const pillBarRef = useRef<HTMLDivElement>(null);
  const rafScrollRef = useRef<number | null>(null);
  const programmaticTargetLeftRef = useRef<number | null>(null);
  const programmaticTimerRef = useRef<number | null>(null);

  const allSections = useMemo<PropertySectionModel[]>(() => {
    const hiddenSet = new Set(hiddenPropertyIds);
    const buildSection = (
      id: number,
      name: string,
      color: string,
      isDeactivated: boolean
    ): PropertySectionModel => {
      const key = String(id);
      const grp = groups[key];
      const serverCounts = propertyCounts[key];
      const list = grp?.data ?? [];
      const totalCount = grp?.pagination?.total ?? serverCounts?.total ?? list.length;
      const doneCount = grp?.done_count ?? serverCounts?.done ?? 0;

      return {
        id,
        key,
        name,
        color,
        isDeactivated,
        tasks: list,
        totalCount,
        doneCount,
        remainingCount: Math.max(0, totalCount - doneCount),
        hasMore: !!grp?.pagination?.has_more,
      };
    };

    const raw: PropertySectionModel[] = [
      buildSection(0, 'Sans logement', '#64748B', false),
      ...properties
        .filter((p) => Number(p.is_active) === 1 || (propertyCounts[String(p.id)]?.total ?? 0) > 0 || !!groups[String(p.id)])
        .map((p) => buildSection(p.id, p.name, p.color, Number(p.is_active) === 0)),
    ];
    return raw.filter((section) => !hiddenSet.has(section.id));
  }, [properties, groups, propertyCounts, hiddenPropertyIds]);

  const sections = useMemo(
    () => (hideEmptyProperties ? allSections.filter((s) => s.totalCount > 0 || s.tasks.length > 0) : allSections),
    [hideEmptyProperties, allSections]
  );

  const effectiveActiveId = useMemo(() => {
    if (sections.length === 0) return null;
    if (activePropertyId !== null && sections.some((s) => s.id === activePropertyId)) {
      return activePropertyId;
    }
    return sections[0].id;
  }, [sections, activePropertyId]);

  useEffect(() => {
    if (effectiveActiveId === null) return;
    const bar = pillBarRef.current;
    const pill = document.getElementById(`property-pill-${effectiveActiveId}`);
    if (!bar || !pill) return;

    const pillLeft = pill.offsetLeft;
    const pillRight = pillLeft + pill.offsetWidth;
    const viewLeft = bar.scrollLeft;
    const viewRight = viewLeft + bar.clientWidth;

    const behavior = getScrollBehavior();
    if (pillLeft < viewLeft + 8) {
      bar.scrollTo({ left: Math.max(0, pillLeft - 12), behavior });
    } else if (pillRight > viewRight - 8) {
      bar.scrollTo({ left: pillRight - bar.clientWidth + 12, behavior });
    }
  }, [effectiveActiveId]);

  const syncActiveFromRail = useCallback(() => {
    const rail = railRef.current;
    if (!rail || sections.length === 0) return;

    const targetLeft = programmaticTargetLeftRef.current;
    if (targetLeft !== null) {
      if (Math.abs(rail.scrollLeft - targetLeft) <= 2) {
        programmaticTargetLeftRef.current = null;
      } else {
        return;
      }
    }

    const maxScroll = rail.scrollWidth - rail.clientWidth;
    if (maxScroll <= 1 || sections.length === 1) {
      setActivePropertyId((prev) => (prev === sections[0].id ? prev : sections[0].id));
      return;
    }

    const progress = Math.max(0, Math.min(1, rail.scrollLeft / maxScroll));
    const idx = Math.round(progress * (sections.length - 1));
    const nextId = sections[idx]?.id ?? sections[0].id;
    setActivePropertyId((prev) => (prev === nextId ? prev : nextId));
  }, [sections]);

  const handleRailScroll = useCallback(() => {
    if (rafScrollRef.current !== null) return;
    rafScrollRef.current = window.requestAnimationFrame(() => {
      rafScrollRef.current = null;
      syncActiveFromRail();
    });
  }, [syncActiveFromRail]);

  useEffect(() => {
    return () => {
      if (rafScrollRef.current !== null) {
        window.cancelAnimationFrame(rafScrollRef.current);
      }
      if (programmaticTimerRef.current !== null) {
        window.clearTimeout(programmaticTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const handleWheel = (e: WheelEvent) => {
      programmaticTargetLeftRef.current = null;
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);

      if (absX > absY && absX > 0) {
        rail.scrollLeft += e.deltaX;
        e.preventDefault();
        return;
      }

      if (e.shiftKey && absY > 0) {
        rail.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };

    const handleTouchStart = () => {
      programmaticTargetLeftRef.current = null;
    };

    rail.addEventListener('wheel', handleWheel, { passive: false });
    rail.addEventListener('touchstart', handleTouchStart, { passive: true });
    return () => {
      rail.removeEventListener('wheel', handleWheel);
      rail.removeEventListener('touchstart', handleTouchStart);
    };
  }, [sections.length]);

  const getContainerId = useCallback((t: Task) => t.property_id || 0, []);
  const handleDropReorder = useCallback(
    (draggedTask: Task, targetSectionId: number, orderedSectionTaskIds: number[]) => {
      if (onMoveTaskProperty) {
        const targetPropertyId = targetSectionId > 0 ? targetSectionId : null;
        onMoveTaskProperty(draggedTask.id, targetPropertyId, orderedSectionTaskIds);
      }
    },
    [onMoveTaskProperty]
  );

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
    tasks: allTasks,
    getContainerId,
    isReadOnly,
    onDropReorder: handleDropReorder,
  });

  const scrollToProperty = useCallback(
    (propertyId: number) => {
      const idx = sections.findIndex((s) => s.id === propertyId);
      if (idx === -1) return;
      setActivePropertyId(propertyId);

      const rail = railRef.current;
      if (!rail) return;

      const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
      const targetLeft =
        sections.length > 1
          ? Math.round((idx / (sections.length - 1)) * maxScroll)
          : 0;

      programmaticTargetLeftRef.current = targetLeft;
      if (programmaticTimerRef.current !== null) {
        window.clearTimeout(programmaticTimerRef.current);
      }
      programmaticTimerRef.current = window.setTimeout(() => {
        programmaticTargetLeftRef.current = null;
        programmaticTimerRef.current = null;
      }, 650);

      rail.scrollTo({ left: targetLeft, behavior: getScrollBehavior() });
    },
    [sections]
  );

  useEffect(() => {
    if (!lastCreatedBatch || isModalOpen) return;

    const firstSectionId = lastCreatedBatch.propertyId ?? 0;
    const hasSection = sections.some((s) => s.id === firstSectionId);
    const hasVisibleTask = allTasks.some((t) => lastCreatedBatch.ids.includes(t.id));
    const batchIds = lastCreatedBatch.ids;

    onConsumeCreatedBatch?.();
    if (!hasSection || !hasVisibleTask) return;

    scrollToProperty(firstSectionId);

    const rafId = window.requestAnimationFrame(() => {
      const propScrollEl = document.querySelector<HTMLElement>(
        `[data-property-scroll="${firstSectionId}"]`
      );
      scrollContainersAndHighlightTasks({
        horizontalEl: railRef.current,
        verticalEl: propScrollEl,
        taskIds: batchIds,
      });
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [lastCreatedBatch, isModalOpen, sections, allTasks, scrollToProperty, onConsumeCreatedBatch]);

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
      <div className="shrink-0 flex items-center justify-between gap-2">
        <div
          ref={pillBarRef}
          className="relative flex items-center gap-1.5 overflow-x-auto no-scrollbar px-1.5 py-1 flex-1 min-w-0"
        >
          {sections.map((section) => {
            const isActive = effectiveActiveId === section.id;

            return (
              <button
                key={section.id}
                id={`property-pill-${section.id}`}
                type="button"
                aria-current={isActive ? 'location' : undefined}
                onClick={() => scrollToProperty(section.id)}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 min-h-[32px] rounded-full text-[11.5px] font-semibold transition-colors duration-150 cursor-pointer tabular-nums ${
                  isActive
                    ? 'bg-[var(--cdh-surface-card-hover)] text-[var(--cdh-text-primary)] shadow-cdh-card ring-1 ring-[var(--cdh-accent)]/35'
                    : 'bg-[var(--cdh-surface-control)] text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control-hover)]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: section.color || '#007AFF' }}
                />
                <span className="truncate max-w-[140px]">{section.name}</span>
                <span className="opacity-70 text-[10.5px]">
                  {section.remainingCount > 0 ? section.remainingCount : section.totalCount}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          aria-pressed={hideEmptyProperties}
          onClick={onToggleHideEmpty}
          className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 min-h-[32px] rounded-full text-[11.5px] font-semibold transition-colors duration-150 cursor-pointer ${
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

      {sections.length === 0 ? (
        <div className="cdh-glass-column rounded-cdh-2xl p-10 text-center">
          <EyeOff className="w-8 h-8 mx-auto mb-2.5 text-[var(--cdh-text-tertiary)]" strokeWidth={1.75} />
          <p className="text-sm font-semibold text-[var(--cdh-text-primary)]">Aucun logement avec des tâches pour ces filtres.</p>
          <button
            type="button"
            onClick={onToggleHideEmpty}
            className="mt-2 text-xs font-semibold text-[var(--cdh-accent)] hover:underline cursor-pointer"
          >
            Afficher aussi les logements vides
          </button>
        </div>
      ) : (
        <div
          ref={railRef}
          onScroll={handleRailScroll}
          className="flex-1 min-h-0 min-w-0 flex gap-3.5 sm:gap-4 items-stretch overflow-x-auto overflow-y-hidden overscroll-x-contain snap-x snap-mandatory sm:snap-none pb-2 -mx-3 px-3 sm:mx-0 sm:px-0"
        >
          {sections.map((section) => (
            <PropertyColumnView
              key={section.id}
              section={section}
              isHovered={activeDropContainer === section.id}
              isLoadingMore={!!loadingMoreColumns[section.key]}
              onLoadMore={onLoadMoreColumn}
              showQuickAddButtons={showQuickAddButtons}
              allUsers={allUsers}
              currentUser={currentUser}
              isReadOnly={isReadOnly}
              draggedTaskId={draggedTaskId}
              dropTarget={dropTarget}
              onAddNewTask={onAddNewTask}
              onDragOverContainer={handleDragOverContainer}
              onDragLeaveContainer={handleDragLeaveContainer}
              onDropOnContainer={handleDropOnContainer}
              onDragStart={handleDragStart}
              onDragEnd={resetDragState}
              onDragOverCard={handleDragOverCard}
              onDropOnCard={handleDropOnCard}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
              onToggleSubtask={onToggleSubtask}
              onAddSubtask={onAddSubtask}
              onUpdateStatus={onUpdateStatus}
              onAssignTask={onAssignTask}
              onQuickUpdateTask={onQuickUpdateTask}
              onToggleStar={onToggleStar}
            />
          ))}
        </div>
      )}
    </div>
  );
};
