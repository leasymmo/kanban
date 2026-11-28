import React, { useMemo } from 'react';
import { SprintMeetingSummary, Task, TaskGroupPage, TaskStatus, User } from '../../types';
import { buildSubtaskTree, HierarchicalSubtask, isTaskOverdue, parseLocalDate } from '../../utils/subtasks';
import { BlurredIconSwap } from '../BlurredIconSwap';
import { Badge, Button, PropertyPill, StatusIconPicker, TaskPriorityIcon, TaskStatusIcon } from '../ui';
import { MeetingSectionShell } from './MeetingSectionShell';
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit3,
  Square,
  Star,
} from 'lucide-react';

interface MeetingRetroStepProps {
  users: User[];
  activeSprintTasks: Task[];
  retroGroups?: Record<string, TaskGroupPage>;
  loadingRetroUsers?: Record<string, boolean>;
  meetingSummary?: SprintMeetingSummary;
  onLoadMoreForUser?: (userId: number) => void;
  currentUser: User | null;
  isAdmin: boolean;
  isReadOnly: boolean;
  expandedAccordions: Record<number, boolean>;
  onToggleAccordion: (userId: number) => void;
  onUpdateTaskStatus: (taskId: number, status: TaskStatus) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onToggleStar?: (taskId: number) => void;
  onEditTask: (task: Task) => void;
}

const RETRO_STATUS_ORDER: Partial<Record<Task['status'], number>> = {
  done: 0,
  in_progress: 1,
  blocked: 2,
  todo: 3,
};

const sortByRetroStatus = (a: Task, b: Task) =>
  (RETRO_STATUS_ORDER[a.status] ?? 4) - (RETRO_STATUS_ORDER[b.status] ?? 4);

const RetroSubtaskTree: React.FC<{
  nodes: HierarchicalSubtask[];
  canEdit: boolean;
  onToggleSubtask: (subtaskId: number) => void;
}> = ({ nodes, canEdit, onToggleSubtask }) => (
  <div className="space-y-1">
    {nodes.map((node) => (
      <div
        key={node.id}
        className={node.depth > 0 ? 'ml-3 pl-2.5 border-l border-[var(--cdh-border-hairline)]' : ''}
      >
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => canEdit && onToggleSubtask(node.id)}
          className={`w-full flex items-start gap-2 text-left text-[12.5px] py-0.5 rounded px-1 transition-colors ${
            canEdit
              ? 'cursor-pointer hover:bg-[var(--cdh-surface-control)] text-[var(--cdh-text-primary)]'
              : 'cursor-default text-[var(--cdh-text-secondary)]'
          }`}
        >
          <BlurredIconSwap
            active={!!node.is_done}
            className="mt-0.5 shrink-0"
            activeIcon={<CheckCircle2 className="w-3.5 h-3.5 text-[var(--cdh-success)]" strokeWidth={2} />}
            inactiveIcon={<Square className="w-3.5 h-3.5 text-[var(--cdh-text-tertiary)]" strokeWidth={1.75} />}
          />
          <span className={node.is_done ? 'line-through text-[var(--cdh-text-tertiary)]' : 'font-medium'}>
            {node.title}
          </span>
        </button>
        {node.children && node.children.length > 0 && (
          <div className="mt-0.5">
            <RetroSubtaskTree nodes={node.children} canEdit={canEdit} onToggleSubtask={onToggleSubtask} />
          </div>
        )}
      </div>
    ))}
  </div>
);

interface RetroTaskCardProps {
  task: Task;
  isHighlighted: boolean;
  fallbackCanEdit: boolean;
  isReadOnly: boolean;
  onUpdateTaskStatus: (taskId: number, status: TaskStatus) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onToggleStar?: (taskId: number) => void;
  onEditTask: (task: Task) => void;
}

const RetroTaskCard: React.FC<RetroTaskCardProps> = React.memo(({
  task: t,
  isHighlighted,
  fallbackCanEdit,
  isReadOnly,
  onUpdateTaskStatus,
  onToggleSubtask,
  onToggleStar,
  onEditTask,
}) => {
  const hierarchicalSubtasks = useMemo(
    () => buildSubtaskTree(Array.isArray(t.subtasks) ? t.subtasks : []),
    [t.subtasks]
  );
  const canEditTask = !isReadOnly && (t.can_edit !== undefined ? !!t.can_edit : fallbackCanEdit);
  const canStarTask = !isReadOnly && !!t.can_star;
  const parsedDue = parseLocalDate(t.due_date);
  const overdue = isTaskOverdue(t.due_date, t.status);

  return (
    <article
      data-task-card-id={t.id}
      className={`cdh-surface-card rounded-cdh-lg p-3.5 sm:p-4 space-y-2.5 ${
        isHighlighted ? 'cdh-card-starred' : ''
      } ${
        !isHighlighted && t.status === 'blocked' ? 'cdh-card-blocked' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          {/* Bascule rapide Fait / En cours */}
          {canEditTask ? (
            <button
              type="button"
              onClick={() => onUpdateTaskStatus(t.id, t.status === 'done' ? 'in_progress' : 'done')}
              className="mt-0.5 shrink-0 cursor-pointer hover:scale-105 transition-transform"
              title={t.status === 'done' ? 'Repasser En cours' : 'Marquer Terminé'}
              aria-label={t.status === 'done' ? 'Repasser en cours' : 'Marquer comme terminée'}
            >
              <BlurredIconSwap
                active={t.status === 'done'}
                activeIcon={<CheckCircle2 className="w-5 h-5 text-[var(--cdh-success)]" strokeWidth={2} />}
                inactiveIcon={<Square className="w-5 h-5 text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-accent)]" strokeWidth={1.75} />}
              />
            </button>
          ) : (
            <span className="mt-0.5 shrink-0">
              <TaskStatusIcon status={t.status === 'pending' ? 'todo' : t.status} className="w-5 h-5" />
            </span>
          )}

          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Ligne badges (logement, priorité, échéance) + titre haute lisibilité */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {t.property_name && (
                <PropertyPill name={t.property_name} color={t.property_color} />
              )}

              {t.status === 'blocked' && (
                <Badge variant="danger" pill>
                  Bloqué
                </Badge>
              )}

              {t.priority === 'high' && (
                <Badge variant="danger" pill>
                  <TaskPriorityIcon priority="high" className="w-3 h-3" />
                  Urgent
                </Badge>
              )}

              {parsedDue && (
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full ${
                    overdue
                      ? 'bg-[var(--cdh-danger-soft)] text-[var(--cdh-danger)]'
                      : 'bg-[var(--cdh-surface-control)] text-[var(--cdh-text-secondary)]'
                  }`}
                >
                  <Clock className="w-3 h-3" strokeWidth={2} />
                  {parsedDue.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </span>
              )}
            </div>

            <h4
              className={`text-[14.5px] sm:text-[15px] font-semibold leading-snug break-words ${
                t.status === 'done'
                  ? 'line-through text-[var(--cdh-text-secondary)]'
                  : 'text-[var(--cdh-text-primary)]'
              }`}
            >
              {canEditTask ? (
                <button
                  type="button"
                  onClick={() => onEditTask(t)}
                  className="text-left hover:text-[var(--cdh-accent)] cursor-pointer transition-colors focus-visible:outline-none focus-visible:underline"
                >
                  {t.title}
                </button>
              ) : (
                t.title
              )}
            </h4>

            {t.description && (
              <p className="text-[13px] text-[var(--cdh-text-secondary)] leading-relaxed break-words">
                <span className="text-[var(--cdh-accent)] font-semibold mr-1.5">→</span>
                {t.description}
              </p>
            )}

            {hierarchicalSubtasks.length > 0 && (
              <div className="pt-2 border-t border-[var(--cdh-border-hairline)]">
                <RetroSubtaskTree
                  nodes={hierarchicalSubtasks}
                  canEdit={canEditTask}
                  onToggleSubtask={onToggleSubtask}
                />
              </div>
            )}
          </div>
        </div>

        {/* Contrôles droite : Étoile + Statut + Modifier */}
        <div className="flex items-center gap-1.5 shrink-0">
          {(canStarTask || !!t.is_starred) && (
            <button
              type="button"
              disabled={!canStarTask}
              aria-pressed={!!t.is_starred}
              onClick={(e) => {
                e.stopPropagation();
                if (canStarTask && onToggleStar) onToggleStar(t.id);
              }}
              aria-label={t.is_starred ? 'Retirer la mise en avant' : 'Mettre en avant pour la réunion'}
              title={t.is_starred ? 'Mise en avant activée' : 'Mettre en avant pour la réunion'}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                t.is_starred
                  ? `bg-[var(--cdh-warning-soft)] text-[var(--cdh-warning-accent)] ${
                      canStarTask ? 'cursor-pointer active:scale-95' : 'cursor-default'
                    }`
                  : 'bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-surface-control-hover)] text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-warning-accent)] cursor-pointer active:scale-95'
              }`}
            >
              <Star className={`w-4 h-4 ${t.is_starred ? 'fill-current' : ''}`} strokeWidth={1.75} />
            </button>
          )}

          {canEditTask && (
            <>
              <StatusIconPicker
                status={t.status === 'pending' ? 'todo' : t.status}
                onChange={(nextStatus) => onUpdateTaskStatus(t.id, nextStatus)}
              />

              <button
                type="button"
                onClick={() => onEditTask(t)}
                aria-label="Modifier la tâche"
                title="Modifier la tâche"
                className="hidden sm:flex w-8 h-8 rounded-cdh-md items-center justify-center text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-accent)] hover:bg-[var(--cdh-surface-control)] transition-colors cursor-pointer"
              >
                <Edit3 className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
});

/**
 * Étape 1 de la Vue Réunion : Rétrospective par associé, en cartes haute lisibilité Liquid Glass.
 */
export const MeetingRetroStep: React.FC<MeetingRetroStepProps> = ({
  users,
  activeSprintTasks,
  retroGroups,
  loadingRetroUsers,
  meetingSummary,
  onLoadMoreForUser,
  currentUser,
  isAdmin,
  isReadOnly,
  expandedAccordions,
  onToggleAccordion,
  onUpdateTaskStatus,
  onToggleSubtask,
  onToggleStar,
  onEditTask,
}) => {
  const tasksByUserId = useMemo(() => {
    const map = new Map<number, {
      total: number;
      doneCount: number;
      pendingCount: number;
      starred: Task[];
      unstarred: Task[];
    }>();

    for (const t of activeSprintTasks) {
      if (!t.assigned_to) continue;
      let bucket = map.get(t.assigned_to);
      if (!bucket) {
        bucket = { total: 0, doneCount: 0, pendingCount: 0, starred: [], unstarred: [] };
        map.set(t.assigned_to, bucket);
      }
      bucket.total += 1;
      if (t.status === 'done') bucket.doneCount += 1;
      else bucket.pendingCount += 1;
      if (t.is_starred) bucket.starred.push(t);
      else bucket.unstarred.push(t);
    }

    for (const bucket of map.values()) {
      bucket.starred.sort(sortByRetroStatus);
      bucket.unstarred.sort(sortByRetroStatus);
    }
    return map;
  }, [activeSprintTasks]);

  return (
    <div className="space-y-4">
      {users.map((user) => {
        const bucket = tasksByUserId.get(user.id) || {
          total: 0,
          doneCount: 0,
          pendingCount: 0,
          starred: [],
          unstarred: [],
        };
        const uKey = String(user.id);
        const userGroup = retroGroups?.[uKey];
        const serverStats = meetingSummary?.per_user_tasks?.[uKey];
        const displayTotal = serverStats?.active ?? userGroup?.pagination?.total ?? bucket.total;
        const displayDone = serverStats?.done ?? bucket.doneCount;
        const displayPending = Math.max(0, displayTotal - displayDone);
        const hasMoreUserTasks = !!userGroup?.pagination?.has_more;
        const isLoadingUserMore = !!loadingRetroUsers?.[uKey];

        const canEditThis =
          !isReadOnly && (isAdmin || (currentUser?.role === 'write' && currentUser?.id === user.id));
        const isAccordionOpen = !!expandedAccordions[user.id];
        const progressPercent =
          displayTotal > 0 ? Math.round((displayDone / displayTotal) * 100) : 0;

        return (
          <MeetingSectionShell
            key={user.id}
            sectionId={`meeting-section-retro-${user.id}`}
            dataAnchor={String(user.id)}
            avatar={{ name: user.name, initials: user.initials, color: user.avatar_color }}
            title={user.name}
            subtitle={`${displayDone}/${displayTotal} terminée${displayDone > 1 ? 's' : ''}`}
            progressPercent={progressPercent}
            badges={
              <>
                {bucket.starred.length > 0 && (
                  <Badge variant="warning" pill>
                    <Star className="w-3 h-3 fill-current" strokeWidth={2} />
                    {bucket.starred.length} mise{bucket.starred.length > 1 ? 's' : ''} en avant
                  </Badge>
                )}
                <Badge variant="neutral" pill>
                  {displayPending} restante{displayPending > 1 ? 's' : ''}
                </Badge>
              </>
            }
          >
            <div className="space-y-2.5">
              {bucket.starred.length > 0 ? (
                <div className="space-y-2.5">
                  {bucket.starred.map((t) => (
                    <RetroTaskCard
                      key={t.id}
                      task={t}
                      isHighlighted
                      fallbackCanEdit={canEditThis}
                      isReadOnly={isReadOnly}
                      onUpdateTaskStatus={onUpdateTaskStatus}
                      onToggleSubtask={onToggleSubtask}
                      onToggleStar={onToggleStar}
                      onEditTask={onEditTask}
                    />
                  ))}
                </div>
              ) : (
                <div className="px-4 py-3.5 border border-dashed border-[var(--cdh-border-subtle)] bg-[var(--cdh-surface-control)] rounded-cdh-lg text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[var(--cdh-text-primary)]">
                    <Star className="w-3.5 h-3.5 text-[var(--cdh-warning-accent)]" strokeWidth={2} />
                    <span>Aucune tâche mise en avant avec l'étoile</span>
                  </div>
                  <p className="text-xs text-[var(--cdh-text-secondary)] mt-1">
                    {bucket.unstarred.length > 0
                      ? `Dépliez ci-dessous pour afficher les ${bucket.unstarred.length} autre${bucket.unstarred.length > 1 ? 's' : ''} tâche${bucket.unstarred.length > 1 ? 's' : ''} de ${user.name}.`
                      : 'Aucune tâche assignée sur ce sprint.'}
                  </p>
                </div>
              )}

              {bucket.unstarred.length > 0 && (
                <div className="pt-2 border-t border-[var(--cdh-border-hairline)]">
                  <button
                    type="button"
                    data-retro-accordion-trigger={user.id}
                    aria-expanded={isAccordionOpen}
                    onClick={() => onToggleAccordion(user.id)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-cdh-md bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-surface-control-hover)] border border-[var(--cdh-border-hairline)] text-[12.5px] font-semibold text-[var(--cdh-text-primary)] transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <ChevronDown
                        className={`w-4 h-4 text-[var(--cdh-text-secondary)] transition-transform duration-200 ${
                          isAccordionOpen ? 'rotate-180' : ''
                        }`}
                        strokeWidth={2}
                      />
                      <span>Autres tâches ({bucket.unstarred.length})</span>
                    </span>
                    <span className="text-[11px] font-bold text-[var(--cdh-text-secondary)] uppercase tracking-wider">
                      {isAccordionOpen ? 'Masquer' : 'Afficher'}
                    </span>
                  </button>

                  {isAccordionOpen && (
                    <div className="mt-2.5 space-y-2.5 animate-fade-in">
                      {bucket.unstarred.map((t) => (
                        <RetroTaskCard
                          key={t.id}
                          task={t}
                          isHighlighted={false}
                          fallbackCanEdit={canEditThis}
                          isReadOnly={isReadOnly}
                          onUpdateTaskStatus={onUpdateTaskStatus}
                          onToggleSubtask={onToggleSubtask}
                          onToggleStar={onToggleStar}
                          onEditTask={onEditTask}
                        />
                      ))}

                      {hasMoreUserTasks && onLoadMoreForUser && (
                        <div className="pt-1 flex justify-center">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            isLoading={isLoadingUserMore}
                            disabled={isLoadingUserMore}
                            onClick={() => onLoadMoreForUser(user.id)}
                          >
                            Charger plus de tâches ({Math.max(0, displayTotal - bucket.total)} restantes)
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </MeetingSectionShell>
        );
      })}
    </div>
  );
};
