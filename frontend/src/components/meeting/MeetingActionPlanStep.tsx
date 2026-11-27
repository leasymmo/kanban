import React from 'react';
import { Sprint, Task, User } from '../../types';
import { ensureWhiteTextContrast, hexToSoftTint } from '../../utils/color';
import { parseLocalDate } from '../../utils/subtasks';
import { Avatar, Badge, TaskPriorityIcon } from '../ui';
import { MeetingSectionShell } from './MeetingSectionShell';
import { MeetingFocusKey } from './MeetingHeader';
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
  focusedKey: MeetingFocusKey;
  isAdmin: boolean;
  isReadOnly: boolean;
  onAssignTask: (taskId: number, userId: number | null) => void;
  onEditPendingTask?: (task: Task) => void;
  onDeleteTask?: (taskId: number) => void;
}

/**
 * Étape 3 de la Vue Réunion :
 * - Pool « À attribuer » (en 1 clic par associé)
 * - Plan d'action du prochain sprint (Point N+1), focalisé sur l'associé sélectionné
 */
export const MeetingActionPlanStep: React.FC<MeetingActionPlanStepProps> = ({
  sprint,
  users,
  pendingUnassigned,
  pendingAssigned,
  focusedKey,
  isAdmin,
  isReadOnly,
  onAssignTask,
  onEditPendingTask,
  onDeleteTask,
}) => {
  const showPool = focusedKey === 'all' || focusedKey === 'pool';
  const visibleUsers =
    focusedKey === 'all'
      ? users
      : focusedKey === 'pool'
      ? []
      : users.filter((u) => u.id === focusedKey);

  const renderTaskHeaderBadges = (t: Task, kind: 'pool' | 'assigned') => {
    const parsedDue = parseLocalDate(t.due_date);
    return (
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
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full bg-[var(--cdh-surface-control)] text-[var(--cdh-text-secondary)]">
            <Clock className="w-3 h-3" strokeWidth={2} />
            {parsedDue.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
          </span>
        )}
      </div>
    );
  };

  const renderTaskEditDelete = (t: Task) => {
    if (isReadOnly || (!t.can_edit && !t.can_delete)) return null;
    return (
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
    );
  };

  return (
    <div className="space-y-4">
      {/* Sous-section 1 : Pool des tâches non-attribuées */}
      {showPool && (
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
                <article
                  key={t.id}
                  className="cdh-surface-card rounded-cdh-lg p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3.5"
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {renderTaskHeaderBadges(t, 'pool')}
                    <h4 className="text-[14.5px] sm:text-[15px] font-semibold text-[var(--cdh-text-primary)] break-words leading-snug">
                      {t.title}
                    </h4>
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
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0 justify-between md:justify-end">
                    {isAdmin && !isReadOnly && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {users.map((u) => {
                          const avatarBg = ensureWhiteTextContrast(u.avatar_color);
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => onAssignTask(t.id, u.id)}
                              className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 min-h-[32px] rounded-full text-xs font-semibold bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-surface-control-hover)] border border-[var(--cdh-border-hairline)] text-[var(--cdh-text-primary)] transition-all active:scale-95 cursor-pointer"
                              title={`Attribuer à ${u.name}`}
                            >
                              <Avatar initials={u.initials} color={avatarBg} size="xs" />
                              <span>{u.name.split(' ')[0]}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {renderTaskEditDelete(t)}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="py-4 px-4 border border-dashed border-[var(--cdh-border-subtle)] rounded-cdh-lg text-center text-xs text-[var(--cdh-text-tertiary)] font-medium">
              Aucune tâche non attribuée en attente.
            </div>
          )}
        </MeetingSectionShell>
      )}

      {/* Sous-section 2 : Tâches attribuées par associé (Plan d'action Point N+1) */}
      {visibleUsers.map((u) => {
        const userPending = pendingAssigned.filter((t) => t.assigned_to === u.id);

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
                  <article
                    key={t.id}
                    className="cdh-surface-card rounded-cdh-lg p-3.5 sm:p-4 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {renderTaskHeaderBadges(t, 'assigned')}
                        <h4 className="text-[14.5px] sm:text-[15px] font-semibold text-[var(--cdh-text-primary)] break-words leading-snug">
                          {t.title}
                        </h4>
                      </div>
                      {renderTaskEditDelete(t)}
                    </div>

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

                    {isAdmin && !isReadOnly && (
                      <div className="pt-2 border-t border-[var(--cdh-border-hairline)] flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-semibold text-[var(--cdh-text-tertiary)] mr-0.5">
                            Réattribuer :
                          </span>
                          {users
                            .filter((other) => other.id !== u.id)
                            .map((other) => (
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
