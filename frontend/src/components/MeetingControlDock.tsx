import React from 'react';
import { Question, SprintMeetingSummary, Task, User } from '../types';
import { hasFinalDecision } from '../utils/questions';
import { ensureWhiteTextContrast } from '../utils/color';
import { Plus, UserPlus } from 'lucide-react';

export interface MeetingControlDockProps {
  users: User[];
  tasks: Task[];
  questions: Question[];
  meetingSummary?: SprintMeetingSummary;
  meetingStep: 'retro' | 'questions' | 'unassigned';
  activeAnchor: number | 'pool' | null;
  pendingUnassignedCount: number;
  showAddPendingTask: boolean;
  onSelectParticipant: (elementId: string, anchorKey: number | 'pool') => void;
  onAddPendingTask: () => void;
}

/**
 * Bulle d'info latérale Liquid Glass pour les actions et ancres du dock (desktop lg+).
 */
const DockTooltip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    role="tooltip"
    className="hidden lg:flex items-center gap-1.5 pointer-events-none opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-150 motion-reduce:transition-none absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap px-2.5 py-1.5 rounded-cdh-md cdh-glass-overlay text-[var(--cdh-text-primary)] text-xs font-semibold"
  >
    {children}
  </span>
);

const DockSeparator: React.FC = () => (
  <span aria-hidden="true" className="w-px h-6 lg:w-6 lg:h-px bg-[var(--cdh-border-hairline)] shrink-0" />
);

const DockPoolButton: React.FC<{
  count: number;
  isActive: boolean;
  onClick: () => void;
}> = ({ count, isActive, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Afficher les tâches à attribuer"
    aria-current={isActive ? 'location' : undefined}
    className={`group relative w-11 h-11 rounded-full shrink-0 flex items-center justify-center transition-all motion-reduce:transition-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cdh-border-focus)] ${
      isActive
        ? 'bg-[var(--cdh-warning-soft)] ring-2 ring-[var(--cdh-warning-accent)] text-[var(--cdh-warning)]'
        : 'text-[var(--cdh-text-secondary)] hover:bg-[var(--cdh-surface-control)] hover:text-[var(--cdh-warning)]'
    }`}
  >
    <span className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--cdh-warning-soft)] text-[var(--cdh-warning)]">
      <UserPlus className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
    </span>

    {count > 0 && (
      <span
        aria-hidden="true"
        className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--cdh-warning-accent)] text-white text-[10.5px] leading-none font-bold flex items-center justify-center shadow-xs tabular-nums"
      >
        {count}
      </span>
    )}

    <DockTooltip>
      <span>À attribuer</span>
      <span className="px-1.5 py-0.5 rounded-full bg-[var(--cdh-warning-soft)] text-[var(--cdh-warning)] text-[11px] font-bold tabular-nums">
        {count}
      </span>
    </DockTooltip>
  </button>
);

const DockUserAnchorButton: React.FC<{
  user: User;
  badgeCount: number;
  badgeLabel: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ user, badgeCount, badgeLabel, isActive, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`Intervenant : ${user.name}`}
    aria-current={isActive ? 'location' : undefined}
    className={`group relative w-11 h-11 rounded-full shrink-0 flex items-center justify-center transition-all motion-reduce:transition-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cdh-border-focus)] ${
      isActive
        ? 'bg-[var(--cdh-accent-soft)] ring-2 ring-[var(--cdh-accent)]'
        : 'hover:bg-[var(--cdh-surface-control)] opacity-90 hover:opacity-100'
    }`}
  >
    <span
      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs ring-1 ring-white/30 transition-transform motion-reduce:transition-none ${
        isActive ? 'scale-105' : 'group-hover:scale-105'
      }`}
      style={{ backgroundColor: ensureWhiteTextContrast(user.avatar_color, '#4B5563') }}
    >
      {user.initials}
    </span>

    <DockTooltip>
      <span>{user.name}</span>
      <span className="px-1.5 py-0.5 rounded-full bg-[var(--cdh-accent-soft)] text-[var(--cdh-accent)] text-[11px] font-bold tabular-nums">
        {badgeCount} {badgeLabel}
      </span>
    </DockTooltip>
  </button>
);

const DockAddPendingTaskButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Ajouter une tâche en attente"
    aria-keyshortcuts="n + ="
    title="Ajouter une tâche en attente (N, + ou =)"
    className="group relative w-11 h-11 rounded-full shrink-0 flex items-center justify-center transition-all motion-reduce:transition-none cursor-pointer hover:bg-[var(--cdh-accent-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cdh-border-focus)]"
  >
    <span className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--cdh-accent)] hover:bg-[var(--cdh-accent-hover)] text-white shadow-sm group-hover:scale-105 active:scale-95 transition-transform motion-reduce:transition-none">
      <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
    </span>

    <DockTooltip>
      <span>Ajouter une tâche en attente</span>
      <span className="flex items-center gap-1 ml-0.5">
        <kbd className="px-1.5 py-0.5 rounded bg-[var(--cdh-surface-control)] border border-[var(--cdh-border-subtle)] text-[10.5px] font-mono text-[var(--cdh-text-primary)]">
          N
        </kbd>
        <kbd className="px-1.5 py-0.5 rounded bg-[var(--cdh-surface-control)] border border-[var(--cdh-border-subtle)] text-[10.5px] font-mono text-[var(--cdh-text-primary)]">
          +
        </kbd>
      </span>
    </DockTooltip>
  </button>
);

/**
 * Super-dock Liquid Glass de pilotage en réunion :
 * permet de basculer rapidement d'un intervenant à l'autre (+ À attribuer) et d'ajouter une tâche en attente.
 */
export const MeetingControlDock: React.FC<MeetingControlDockProps> = ({
  users,
  tasks,
  questions,
  meetingSummary,
  meetingStep,
  activeAnchor,
  pendingUnassignedCount,
  showAddPendingTask,
  onSelectParticipant,
  onAddPendingTask,
}) => {
  if (users.length === 0 && !showAddPendingTask) return null;

  const activeSprintTasks = tasks.filter((t) => t.status !== 'pending');
  const pendingAssigned = tasks.filter((t) => t.status === 'pending' && !!t.assigned_to);

  return (
    <nav
      aria-label="Barre de contrôle rapide de la réunion"
      className="fixed z-40 bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 sm:left-6 max-w-[calc(100vw-1.5rem)] lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:left-3 min-[1520px]:left-[max(1rem,calc(50%-47rem))] lg:max-w-none cdh-glass-overlay rounded-full p-1.5 flex flex-row lg:flex-col items-center gap-1.5 overflow-x-auto lg:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {meetingStep === 'unassigned' && users.length > 0 && (
        <>
          <DockPoolButton
            count={pendingUnassignedCount}
            isActive={activeAnchor === 'pool'}
            onClick={() => onSelectParticipant('meeting-section-unassigned-pool', 'pool')}
          />
          <DockSeparator />
        </>
      )}

      {users.map((user) => {
        const targetId = `meeting-section-${meetingStep}-${user.id}`;
        const uKey = String(user.id);
        const summaryTasks = meetingSummary?.per_user_tasks?.[uKey];
        const summaryQuestions = meetingSummary?.per_user_questions?.[uKey];
        const badgeCount =
          meetingStep === 'retro'
            ? summaryTasks?.active ?? activeSprintTasks.filter((t) => t.assigned_to === user.id).length
            : meetingStep === 'questions'
            ? summaryQuestions?.undecided ?? questions.filter((q) => q.user_id === user.id && !hasFinalDecision(q)).length
            : summaryTasks?.pending ?? pendingAssigned.filter((t) => t.assigned_to === user.id).length;

        const badgeLabel =
          meetingStep === 'retro'
            ? 'tâches'
            : meetingStep === 'questions'
            ? 'à trancher'
            : 'planifiées';

        return (
          <DockUserAnchorButton
            key={user.id}
            user={user}
            badgeCount={badgeCount}
            badgeLabel={badgeLabel}
            isActive={activeAnchor === user.id}
            onClick={() => onSelectParticipant(targetId, user.id)}
          />
        );
      })}

      {showAddPendingTask && (
        <>
          {users.length > 0 && <DockSeparator />}
          <DockAddPendingTaskButton onClick={onAddPendingTask} />
        </>
      )}
    </nav>
  );
};
