import React, { useMemo } from 'react';
import { Sprint, Task, User } from '../../types';
import { ensureWhiteTextContrast } from '../../utils/color';
import { parseLocalDate } from '../../utils/subtasks';
import { Avatar, Badge, PropertyPill, TaskPriorityIcon } from '../ui';
import { MeetingSectionShell } from './MeetingSectionShell';
import {
  Clock,
  Edit3,
  Sparkles,
  Trash2,
  UserPlus,
} from 'lucide-react';

interface MeetingActionPlanStepProps {
  sprint: Sprint;
  users: User[];
  pendingUnassigned: Task[];
  pendingAssigned: Task[];
  isAdmin: boolean;
  isReadOnly: boolean;
  onAssignTask: (taskId: number, userId: number | null) => void;
  onEditPendingTask?: (task: Task) => void;
  onDeleteTask?: (taskId: number) => void;
}

interface ActionPlanTaskCardProps {
  task: Task;
  kind: 'pool' | 'assigned';
  ownerId?: number;
  users: User[];
  isAdmin: boolean;
  isReadOnly: boolean;
  onAssignTask: (taskId: number, userId: number | null) => void;
  onEditPendingTask?: (task: Task) => void;
  onDeleteTask?: (taskId: number) => void;
}

const ActionPlanTaskCard: React.FC<ActionPlanTaskCardProps> = React.memo(({
  task: t,
  kind,
  ownerId,
  users,
  isAdmin,
  isReadOnly,
  onAssignTask,
  onEditPendingTask,
  onDeleteTask,
}) => {
  const parsedDue = parseLocalDate(t.due_date);
  const canModify = !isReadOnly && (!!t.can_edit || !!t.can_delete);
  const assignableUsers = useMemo(
    () => (kind === 'pool' ? users : users.filter((other) => other.id !== ownerId)),
    [kind, users, ownerId]
  );

  const editDeleteControls = canModify ? (
    <div className="flex items-center gap-1 shrink-0">
      {t.can_edit && onEditPendingTask && (
        <button
          type="button"
          onClick={() => onEditPendingTask(t)}
          className="w-8 h-8 flex items-center justify-center text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-accent)] bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-surface-control-hover)] rounded-cdh-md cursor-pointer transition-colors"
          title="Modifier cette tâche en attente"
          aria-label={`Modifier ${t.title}`}
        >
          <Edit3 className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
      )}
      {t.can_delete && onDeleteTask && (
        <button
          type="button"
          onClick={() => onDeleteTask(t.id)}
          className="w-8 h-8 flex items-center justify-center text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-danger)] bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-danger-soft)] rounded-cdh-md cursor-pointer transition-colors"
          title="Supprimer cette tâche en attente"
          aria-label={`Supprimer ${t.title}`}
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
      )}
    </div>
  ) : null;

  const headerBadges = (
    <div className="flex items-center gap-1.5 flex-wrap">
      {kind === 'pool' ? (
        <Badge variant="warning" pill>
          <UserPlus className="w-3 h-3" strokeWidth={2} />
          À attribuer
        </Badge>
      ) : (
        <Badge variant="accent" pill>
          <Sparkles className="w-3 h-3" strokeWidth={2} />
          Nouveau
        </Badge>
      )}

      {t.property_name && (
        <PropertyPill name={t.property_name} color={t.property_color} />
      )}

      {t.priority === 'high' && (
        <Badge variant="danger" pill>
          <TaskPriorityIcon priority="high" className="w-3 h-3" />
          Urgent
        </Badge>
      )}

      {parsedDue && (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full bg-[var(--cdh-surface-control)] text-[var(--cdh-text-secondary)]">
          <Clock className="w-3 h-3" strokeWidth={2} />
          {parsedDue.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
        </span>
      )}
    </div>
  );

  const descriptionAndSubtasks = (
    <>
      {t.description && (
        <p className="text-[13px] text-[var(--cdh-text-secondary)] break-words leading-relaxed">
          <span className="text-[var(--cdh-accent)] font-semibold mr-1.5">→</span>
          {t.description}
        </p>
      )}
      {t.subtasks && t.subtasks.length > 0 && (
        <ul className="space-y-1 pl-2.5 border-l border-[var(--cdh-border-hairline)]">
          {t.subtasks.map((st) => (
            <li key={st.id} className="text-[12px] text-[var(--cdh-text-secondary)] font-medium">
              • {st.title}
            </li>
          ))}
        </ul>
      )}
    </>
  );

  if (kind === 'pool') {
    return (
      <article
        data-task-card-id={t.id}
        className="cdh-surface-card rounded-cdh-lg p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3.5"
      >
        <div className="flex-1 min-w-0 space-y-1.5">
          {headerBadges}
          <h4 className="text-[14.5px] sm:text-[15px] font-semibold text-[var(--cdh-text-primary)] break-words leading-snug">
            {t.title}
          </h4>
          {descriptionAndSubtasks}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 justify-between md:justify-end">
          {isAdmin && !isReadOnly && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {assignableUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onAssignTask(t.id, u.id)}
                  className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 min-h-[32px] rounded-full text-xs font-semibold bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-surface-control-hover)] border border-[var(--cdh-border-hairline)] text-[var(--cdh-text-primary)] transition-all active:scale-95 cursor-pointer"
                  title={`Attribuer à ${u.name}`}
                >
                  <Avatar initials={u.initials} color={ensureWhiteTextContrast(u.avatar_color)} size="xs" />
                  <span>{u.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          )}
          {editDeleteControls}
        </div>
      </article>
    );
  }

  return (
    <article
      data-task-card-id={t.id}
      className="cdh-surface-card rounded-cdh-lg p-3.5 sm:p-4 space-y-2.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          {headerBadges}
          <h4 className="text-[14.5px] sm:text-[15px] font-semibold text-[var(--cdh-text-primary)] break-words leading-snug">
            {t.title}
          </h4>
        </div>
        {editDeleteControls}
      </div>

      {descriptionAndSubtasks}

      {isAdmin && !isReadOnly && (
        <div className="pt-2 border-t border-[var(--cdh-border-hairline)] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-[var(--cdh-text-tertiary)] mr-0.5">
              Réattribuer :
            </span>
            {assignableUsers.map((other) => (
              <button
                key={other.id}
                type="button"
                onClick={() => onAssignTask(t.id, other.id)}
                className="inline-flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-surface-control-hover)] border border-[var(--cdh-border-hairline)] text-[var(--cdh-text-primary)] transition-colors cursor-pointer"
                title={`Réattribuer à ${other.name}`}
              >
                <Avatar
                  initials={other.initials}
                  color={ensureWhiteTextContrast(other.avatar_color)}
                  size="xs"
                />
                <span>{other.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onAssignTask(t.id, null)}
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--cdh-warning-soft)] hover:opacity-85 text-[var(--cdh-warning)] transition-opacity cursor-pointer"
            title="Retirer le responsable (renvoyer dans Tâches à attribuer)"
          >
            Retirer
          </button>
        </div>
      )}
    </article>
  );
});

/**
 * Étape 3 de la Vue Réunion :
 * - Pool « À attribuer » (en 1 clic par associé)
 * - Plan d'action du prochain sprint (Point N+1) par associé
 */
export const MeetingActionPlanStep: React.FC<MeetingActionPlanStepProps> = ({
  sprint,
  users,
  pendingUnassigned,
  pendingAssigned,
  isAdmin,
  isReadOnly,
  onAssignTask,
  onEditPendingTask,
  onDeleteTask,
}) => {
  const pendingByUserId = useMemo(() => {
    const map = new Map<number, Task[]>();
    for (const t of pendingAssigned) {
      if (!t.assigned_to) continue;
      const list = map.get(t.assigned_to);
      if (list) list.push(t);
      else map.set(t.assigned_to, [t]);
    }
    return map;
  }, [pendingAssigned]);

  return (
    <div className="space-y-4">
      {/* Sous-section 1 : Pool des tâches non-attribuées */}
      <MeetingSectionShell
        sectionId="meeting-section-unassigned-pool"
        dataAnchor="pool"
        customIcon={
          <span className="w-10 h-10 rounded-full bg-[var(--cdh-warning-soft)] text-[var(--cdh-warning)] flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5" strokeWidth={2} />
          </span>
        }
        title="Tâches à attribuer"
        subtitle={`En attente d'un responsable pour le Point ${sprint.number + 1}`}
        accentWarning
        badges={
          <Badge variant="warning" pill>
            {pendingUnassigned.length} à attribuer
          </Badge>
        }
      >
        {pendingUnassigned.length > 0 ? (
          <div className="space-y-2.5">
            {pendingUnassigned.map((t) => (
              <ActionPlanTaskCard
                key={t.id}
                task={t}
                kind="pool"
                users={users}
                isAdmin={isAdmin}
                isReadOnly={isReadOnly}
                onAssignTask={onAssignTask}
                onEditPendingTask={onEditPendingTask}
                onDeleteTask={onDeleteTask}
              />
            ))}
          </div>
        ) : (
          <div className="py-4 px-4 border border-dashed border-[var(--cdh-border-subtle)] rounded-cdh-lg text-center text-xs text-[var(--cdh-text-tertiary)] font-medium">
            Aucune tâche non attribuée en attente.
          </div>
        )}
      </MeetingSectionShell>

      {/* Sous-section 2 : Tâches attribuées par associé (Plan d'action Point N+1) */}
      {users.map((u) => {
        const userPending = pendingByUserId.get(u.id) || [];

        return (
          <MeetingSectionShell
            key={u.id}
            sectionId={`meeting-section-unassigned-${u.id}`}
            dataAnchor={String(u.id)}
            avatar={{ name: u.name, initials: u.initials, color: u.avatar_color }}
            title={u.name}
            subtitle={
              userPending.length === 0
                ? `Aucune tâche prévue pour le Point ${sprint.number + 1}`
                : `${userPending.length} tâche${userPending.length > 1 ? 's' : ''} planifiée${userPending.length > 1 ? 's' : ''} pour le Point ${sprint.number + 1}`
            }
            badges={
              <Badge variant={userPending.length > 0 ? 'accent' : 'neutral'} pill>
                {userPending.length} planifiée{userPending.length > 1 ? 's' : ''}
              </Badge>
            }
          >
            {userPending.length > 0 ? (
              <div className="space-y-2.5">
                {userPending.map((t) => (
                  <ActionPlanTaskCard
                    key={t.id}
                    task={t}
                    kind="assigned"
                    ownerId={u.id}
                    users={users}
                    isAdmin={isAdmin}
                    isReadOnly={isReadOnly}
                    onAssignTask={onAssignTask}
                    onEditPendingTask={onEditPendingTask}
                    onDeleteTask={onDeleteTask}
                  />
                ))}
              </div>
            ) : (
              <div className="py-4 px-4 border border-dashed border-[var(--cdh-border-subtle)] rounded-cdh-lg text-center text-xs text-[var(--cdh-text-tertiary)] font-medium">
                Aucune tâche attribuée pour la semaine prochaine.
              </div>
            )}
          </MeetingSectionShell>
        );
      })}
    </div>
  );
};
