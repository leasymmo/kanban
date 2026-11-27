import React from 'react';
import { Task, TaskStatus, User } from '../../types';
import { buildSubtaskTree, HierarchicalSubtask, isTaskOverdue, parseLocalDate } from '../../utils/subtasks';
import { hexToSoftTint } from '../../utils/color';
import { BlurredIconSwap } from '../BlurredIconSwap';
import { Badge, TaskPriorityIcon, TaskStatusIcon } from '../ui';
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

/**
 * Étape 1 de la Vue Réunion : Rétrospective par associé, en cartes haute lisibilité Liquid Glass.
 */
export const MeetingRetroStep: React.FC<MeetingRetroStepProps> = ({
  users,
  activeSprintTasks,
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

  const renderRetroSubtasks = (nodes: HierarchicalSubtask[], canEditThis: boolean) => (
    <div className="space-y-1">
      {nodes.map((node) => (
        <div
          key={node.id}
          className={node.depth > 0 ? 'ml-3 pl-2.5 border-l border-[var(--cdh-border-hairline)]' : ''}
        >
          <button
            type="button"
            disabled={!canEditThis}
            onClick={() => canEditThis && onToggleSubtask(node.id)}
            className={`w-full flex items-start gap-2 text-left text-[12.5px] py-0.5 rounded px-1 transition-colors ${
              canEditThis
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
            <div className="mt-0.5">{renderRetroSubtasks(node.children, canEditThis)}</div>
          )}
        </div>
      ))}
    </div>
  );

  const renderRetroTask = (t: Task, isHighlighted: boolean, fallbackCanEdit: boolean) => {
    const hierarchicalSubtasks = buildSubtaskTree(Array.isArray(t.subtasks) ? t.subtasks : []);
    const canEditTask = !isReadOnly && (t.can_edit !== undefined ? !!t.can_edit : fallbackCanEdit);
    const canStarTask = !isReadOnly && !!t.can_star;
    const parsedDue = parseLocalDate(t.due_date);
    const overdue = isTaskOverdue(t.due_date, t.status);

    return (
      <article
        key={t.id}
        className={`cdh-surface-card rounded-cdh-lg p-3.5 sm:p-4 transition-all space-y-2.5 ${
          isHighlighted
            ? 'ring-1 ring-[var(--cdh-warning-accent)]/60 border-[var(--cdh-warning-accent)]/50'
            : t.status === 'blocked'
            ? 'border-[var(--cdh-danger-accent)]/40'
            : ''
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
                  <span
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-cdh-xs text-[var(--cdh-text-primary)]"
                    style={{ backgroundColor: hexToSoftTint(t.property_color, 0.14) }}
                  >
                    <span
                      aria-hidden="true"
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: t.property_color || '#007AFF' }}
                    />
                    {t.property_name}
                  </span>
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
                onClick={() => canEditTask && onEditTask(t)}
                className={`text-[14.5px] sm:text-[15px] font-semibold leading-snug break-words ${
                  canEditTask ? 'hover:text-[var(--cdh-accent)] cursor-pointer transition-colors' : ''
                } ${
                  t.status === 'done'
                    ? 'line-through text-[var(--cdh-text-tertiary)]'
                    : 'text-[var(--cdh-text-primary)]'
                }`}
              >
                {t.title}
              </h4>

              {t.description && (
                <p className="text-[13px] text-[var(--cdh-text-secondary)] leading-relaxed break-words">
                  <span className="text-[var(--cdh-accent)] font-semibold mr-1.5">→</span>
                  {t.description}
                </p>
              )}

              {hierarchicalSubtasks.length > 0 && (
                <div className="pt-2 border-t border-[var(--cdh-border-hairline)]">
                  {renderRetroSubtasks(hierarchicalSubtasks, canEditTask)}
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
                <select
                  aria-label={`Statut de ${t.title}`}
                  value={t.status}
                  onChange={(e) => onUpdateTaskStatus(t.id, e.target.value as TaskStatus)}
                  className="text-[12px] font-semibold border border-[var(--cdh-border-hairline)] rounded-cdh-md px-2.5 py-1.5 bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-surface-control-hover)] text-[var(--cdh-text-primary)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--cdh-accent-soft)]"
                >
                  <option value="todo" className="bg-[var(--cdh-bg-canvas)]">À faire</option>
                  <option value="in_progress" className="bg-[var(--cdh-bg-canvas)]">En cours</option>
                  <option value="blocked" className="bg-[var(--cdh-bg-canvas)]">Bloqué</option>
                  <option value="done" className="bg-[var(--cdh-bg-canvas)]">Terminé</option>
                </select>

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
  };

  return (
    <div className="space-y-4">
      {users.map((user) => {
        const userTasks = activeSprintTasks.filter((t) => t.assigned_to === user.id);
        const userDone = userTasks.filter((t) => t.status === 'done');
        const userPending = userTasks.filter((t) => t.status !== 'done');
        const userStarred = userTasks.filter((t) => !!t.is_starred).sort(sortByRetroStatus);
        const userUnstarred = userTasks.filter((t) => !t.is_starred).sort(sortByRetroStatus);
        const canEditThis =
          !isReadOnly && (isAdmin || (currentUser?.role === 'write' && currentUser?.id === user.id));
        const isAccordionOpen = !!expandedAccordions[user.id];
        const progressPercent =
          userTasks.length > 0 ? Math.round((userDone.length / userTasks.length) * 100) : 0;

        return (
          <MeetingSectionShell
            key={user.id}
            sectionId={`meeting-section-retro-${user.id}`}
            dataAnchor={String(user.id)}
            avatar={{ name: user.name, initials: user.initials, color: user.avatar_color }}
            title={user.name}
            subtitle={`${userDone.length}/${userTasks.length} terminée${userDone.length > 1 ? 's' : ''}`}
            progressPercent={progressPercent}
            badges={
              <>
                {userStarred.length > 0 && (
                  <Badge variant="warning" pill>
                    <Star className="w-3 h-3 fill-current" strokeWidth={2} />
                    {userStarred.length} mise{userStarred.length > 1 ? 's' : ''} en avant
                  </Badge>
                )}
                <Badge variant="neutral" pill>
                  {userPending.length} restante{userPending.length > 1 ? 's' : ''}
                </Badge>
              </>
            }
          >
            <div className="space-y-2.5">
              {userStarred.length > 0 ? (
                <div className="space-y-2.5">
                  {userStarred.map((t) => renderRetroTask(t, true, canEditThis))}
                </div>
              ) : (
                <div className="px-4 py-3.5 border border-dashed border-[var(--cdh-border-subtle)] bg-[var(--cdh-surface-control)] rounded-cdh-lg text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[var(--cdh-text-primary)]">
                    <Star className="w-3.5 h-3.5 text-[var(--cdh-warning-accent)]" strokeWidth={2} />
                    <span>Aucune tâche mise en avant avec l'étoile</span>
                  </div>
                  <p className="text-xs text-[var(--cdh-text-secondary)] mt-1">
                    {userUnstarred.length > 0
                      ? `Dépliez ci-dessous pour afficher les ${userUnstarred.length} autre${userUnstarred.length > 1 ? 's' : ''} tâche${userUnstarred.length > 1 ? 's' : ''} de ${user.name}.`
                      : 'Aucune tâche assignée sur ce sprint.'}
                  </p>
                </div>
              )}

              {userUnstarred.length > 0 && (
                <div className="pt-2 border-t border-[var(--cdh-border-hairline)]">
                  <button
                    type="button"
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
                      <span>Autres tâches ({userUnstarred.length})</span>
                    </span>
                    <span className="text-[11px] font-bold text-[var(--cdh-text-secondary)] uppercase tracking-wider">
                      {isAccordionOpen ? 'Masquer' : 'Afficher'}
                    </span>
                  </button>

                  {isAccordionOpen && (
                    <div className="mt-2.5 space-y-2.5 animate-fade-in">
                      {userUnstarred.map((t) => renderRetroTask(t, false, canEditThis))}
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
