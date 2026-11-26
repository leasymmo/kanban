import React from 'react';
import { Question, Task, User } from '../types';
import { hasFinalDecision } from '../utils/questions';
import { ensureWhiteTextContrast } from '../utils/color';
import { Plus, UserPlus } from 'lucide-react';

export interface MeetingControlDockProps {
  users: User[];
  tasks: Task[];
  questions: Question[];
  meetingStep: 'retro' | 'questions' | 'unassigned';
  activeAnchor: number | 'pool' | null;
  pendingUnassignedCount: number;
  showAddPendingTask: boolean;
  onScrollToSection: (elementId: string, anchorKey: number | 'pool') => void;
  onAddPendingTask: () => void;
}

/**
 * Bulle d'info latérale unifiée pour les actions et ancres du dock (desktop lg+).
 */
const DockTooltip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    role="tooltip"
    className="hidden lg:flex items-center gap-1.5 pointer-events-none opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-150 motion-reduce:transition-none absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap px-2.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-lg border border-slate-700/80"
  >
    {children}
  </span>
);

/**
 * Séparateur adaptatif vertical sur desktop (lg+) et horizontal sur mobile/tablette.
 */
const DockSeparator: React.FC = () => (
  <span aria-hidden="true" className="w-px h-6 lg:w-6 lg:h-px bg-black/[0.12] shrink-0" />
);

/**
 * Bouton d'ancre vers le bloc « À attribuer » (étape 3).
 */
const DockPoolButton: React.FC<{
  count: number;
  isActive: boolean;
  onClick: () => void;
}> = ({ count, isActive, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Aller aux tâches non-attribuées"
    aria-current={isActive ? 'location' : undefined}
    className={`group relative w-11 h-11 rounded-full shrink-0 flex items-center justify-center transition-all motion-reduce:transition-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
      isActive
        ? 'bg-amber-50 ring-2 ring-amber-500 text-amber-700 shadow-xs'
        : 'text-slate-600 hover:bg-slate-100 hover:text-amber-700'
    }`}
  >
    <span className="w-8 h-8 rounded-full flex items-center justify-center bg-amber-100 text-amber-700 border border-amber-200">
      <UserPlus className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
    </span>

    {count > 0 && (
      <span
        aria-hidden="true"
        className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-700 text-white text-[11px] leading-none font-bold flex items-center justify-center shadow-xs ring-2 ring-white tabular-nums"
      >
        {count}
      </span>
    )}

    <DockTooltip>
      <span>À attribuer</span>
      <span className="px-1.5 py-0.5 rounded-full bg-amber-500/25 text-amber-200 text-[11px] font-bold tabular-nums">
        {count}
      </span>
    </DockTooltip>
  </button>
);

/**
 * Bouton d'ancre avatar associé avec compteur contextuel de l'étape active.
 */
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
    aria-label={`Aller à la section de ${user.name}`}
    aria-current={isActive ? 'location' : undefined}
    className={`group relative w-11 h-11 rounded-full shrink-0 flex items-center justify-center transition-all motion-reduce:transition-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
      isActive
        ? 'bg-indigo-50 ring-2 ring-indigo-600 shadow-xs'
        : 'hover:bg-slate-100 opacity-90 hover:opacity-100'
    }`}
  >
    <span
      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs border border-black/10 transition-transform motion-reduce:transition-none ${
        isActive ? 'scale-105' : 'group-hover:scale-105'
      }`}
      style={{ backgroundColor: ensureWhiteTextContrast(user.avatar_color, '#4B5563') }}
    >
      {user.initials}
    </span>

    {isActive && (
      <span
        aria-hidden="true"
        className="hidden lg:block absolute -left-1.5 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-brand-600"
      />
    )}

    <DockTooltip>
      <span>{user.name}</span>
      <span className="px-1.5 py-0.5 rounded-full bg-brand-500/30 text-blue-100 text-[11px] font-bold tabular-nums">
        {badgeCount} {badgeLabel}
      </span>
    </DockTooltip>
  </button>
);

/**
 * Bouton d'ajout rapide d'une tâche en attente intégré directement dans le dock.
 */
const DockAddPendingTaskButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Ajouter une tâche en attente"
    aria-keyshortcuts="n + ="
    title="Ajouter une tâche en attente (N, + ou =)"
    className="group relative w-11 h-11 rounded-full shrink-0 flex items-center justify-center transition-all motion-reduce:transition-none cursor-pointer hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
  >
    <span className="w-8 h-8 rounded-full flex items-center justify-center bg-brand-600 group-hover:bg-brand-700 text-white shadow-sm shadow-brand-600/25 group-hover:scale-105 active:scale-95 transition-transform motion-reduce:transition-none">
      <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
    </span>

    <DockTooltip>
      <span>Ajouter une tâche en attente</span>
      <span className="flex items-center gap-1 ml-0.5">
        <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-[11px] font-mono text-slate-100">
          N
        </kbd>
        <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-[11px] font-mono text-slate-100">
          +
        </kbd>
      </span>
    </DockTooltip>
  </button>
);

/**
 * Super-dock unifié de pilotage en réunion :
 * regroupe les ancres par associé (+ À attribuer) et l'action d'ajout de tâche en attente.
 */
export const MeetingControlDock: React.FC<MeetingControlDockProps> = ({
  users,
  tasks,
  questions,
  meetingStep,
  activeAnchor,
  pendingUnassignedCount,
  showAddPendingTask,
  onScrollToSection,
  onAddPendingTask
}) => {
  if (users.length === 0 && !showAddPendingTask) return null;

  const activeSprintTasks = tasks.filter(t => t.status !== 'pending');
  const pendingAssigned = tasks.filter(t => t.status === 'pending' && !!t.assigned_to);

  return (
    <nav
      aria-label="Barre de contrôle rapide de la réunion"
      className="fixed z-40 bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 sm:left-6 max-w-[calc(100vw-1.5rem)] lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:left-3 min-[1440px]:left-[max(1rem,calc(50%-43rem))] lg:max-w-none bg-white/95 backdrop-blur-md border border-black/[0.12] shadow-lg shadow-slate-900/10 rounded-full p-1.5 flex flex-row lg:flex-col items-center gap-1.5 overflow-x-auto lg:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {meetingStep === 'unassigned' && users.length > 0 && (
        <>
          <DockPoolButton
            count={pendingUnassignedCount}
            isActive={activeAnchor === 'pool'}
            onClick={() => onScrollToSection('meeting-section-unassigned-pool', 'pool')}
          />
          <DockSeparator />
        </>
      )}

      {users.map((user) => {
        const targetId = `meeting-section-${meetingStep}-${user.id}`;
        const badgeCount =
          meetingStep === 'retro'
            ? activeSprintTasks.filter(t => t.assigned_to === user.id).length
            : meetingStep === 'questions'
            ? questions.filter(q => q.user_id === user.id && !hasFinalDecision(q)).length
            : pendingAssigned.filter(t => t.assigned_to === user.id).length;

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
            onClick={() => onScrollToSection(targetId, user.id)}
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
