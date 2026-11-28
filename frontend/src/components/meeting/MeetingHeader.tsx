import React from 'react';
import { Sprint, User } from '../../types';
import { Button } from '../ui';
import {
  CheckCircle2,
  Keyboard,
  Lock,
  Plus,
  Shield,
  Users,
} from 'lucide-react';

export type MeetingStepId = 'retro' | 'questions' | 'unassigned';

interface MeetingHeaderProps {
  sprint: Sprint;
  users: User[];
  isAdmin: boolean;
  isReadOnly: boolean;
  meetingStep: MeetingStepId;
  onChangeStep: (step: MeetingStepId) => void;
  animatorId: number;
  onChangeAnimator: (id: number) => void;
  scribeId: number;
  onChangeScribe: (id: number) => void;
  stats: {
    total: number;
    done: number;
    toCarryOver: number;
    unassigned: number;
  };
  undecidedQuestionsCount: number;
  pendingTotalCount: number;
  showAddPendingTask: boolean;
  onAddPendingTask: () => void;
  canCreateQuestion: boolean;
  onAddQuestion: () => void;
  onOpenShortcuts: () => void;
  onOpenCloseSprint: () => void;
}

/**
 * En-tête compact Liquid Glass de la Vue Réunion :
 * regroupe les chiffres clés, les rôles, le sélecteur d'étapes et les actions contextuelles.
 */
export const MeetingHeader: React.FC<MeetingHeaderProps> = ({
  sprint,
  users,
  isAdmin,
  isReadOnly,
  meetingStep,
  onChangeStep,
  animatorId,
  onChangeAnimator,
  scribeId,
  onChangeScribe,
  stats,
  undecidedQuestionsCount,
  pendingTotalCount,
  showAddPendingTask,
  onAddPendingTask,
  canCreateQuestion,
  onAddQuestion,
  onOpenShortcuts,
  onOpenCloseSprint,
}) => {
  const steps: Array<{
    id: MeetingStepId;
    step: number;
    shortcut: string;
    mobileLabel: string;
    label: string;
    duration: string;
    badgeCount: number | null;
    badgeTone: 'accent' | 'warning';
  }> = [
    {
      id: 'retro',
      step: 1,
      shortcut: '1',
      mobileLabel: 'Rétro',
      label: 'Rétrospective',
      duration: '15 min',
      badgeCount: null,
      badgeTone: 'accent',
    },
    {
      id: 'questions',
      step: 2,
      shortcut: '2',
      mobileLabel: 'Questions',
      label: 'Questions & Décisions',
      duration: '30 min',
      badgeCount: undecidedQuestionsCount,
      badgeTone: 'accent',
    },
    {
      id: 'unassigned',
      step: 3,
      shortcut: '3',
      mobileLabel: 'Plan',
      label: "Plan d'Action",
      duration: '10 min',
      badgeCount: pendingTotalCount,
      badgeTone: 'warning',
    },
  ];

  const completionPct =
    stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="cdh-glass-chrome rounded-cdh-xl p-2.5 sm:px-4 sm:py-3 space-y-2.5">
      {/* Ligne 1 : Titre sprint, métriques compactes, rôles & action de clôture */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-cdh-md bg-[var(--cdh-accent-soft)] text-[var(--cdh-accent)] flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" strokeWidth={2} />
            </span>
            <h2 className="text-[15px] sm:text-[17px] font-bold tracking-[-0.015em] text-[var(--cdh-text-primary)] truncate">
              {sprint.name}
            </h2>
            {isReadOnly && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--cdh-warning-soft)] text-[var(--cdh-warning)] shrink-0">
                <Lock className="w-3 h-3" strokeWidth={2} />
                Clôturé
              </span>
            )}
          </div>

          <span
            aria-hidden="true"
            className="hidden md:block h-4 w-px bg-[var(--cdh-border-hairline)] shrink-0"
          />

          {/* Chiffres clés en pilules discrètes sur une ligne */}
          <div className="flex items-center gap-1.5 flex-wrap text-[11.5px] font-semibold tabular-nums">
            <span className="px-2 py-0.5 rounded-full bg-[var(--cdh-surface-control)] text-[var(--cdh-text-primary)]">
              {stats.done}/{stats.total} faites ({completionPct}%)
            </span>
            {stats.toCarryOver > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[var(--cdh-warning-soft)] text-[var(--cdh-warning)]">
                {stats.toCarryOver} à reporter
              </span>
            )}
            {stats.unassigned > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[var(--cdh-accent-soft)] text-[var(--cdh-accent)]">
                {stats.unassigned} à attribuer
              </span>
            )}
          </div>
        </div>

        {/* Rôles + Raccourcis + Clôture */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap shrink-0 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1.5 text-[11.5px]">
            <label className="inline-flex items-center gap-1.5 px-2 py-1 rounded-cdh-md bg-[var(--cdh-surface-control)] border border-[var(--cdh-border-hairline)]">
              <span className="text-[var(--cdh-text-tertiary)] font-semibold">Anim.</span>
              <select
                aria-label="Animateur de la réunion"
                value={animatorId}
                onChange={(e) => onChangeAnimator(Number(e.target.value))}
                className="bg-transparent text-[var(--cdh-text-primary)] font-semibold focus:outline-none cursor-pointer text-[12px]"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id} className="bg-[var(--cdh-bg-canvas)] text-[var(--cdh-text-primary)]">
                    {u.name.split(' ')[0]}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-flex items-center gap-1.5 px-2 py-1 rounded-cdh-md bg-[var(--cdh-surface-control)] border border-[var(--cdh-border-hairline)]">
              <span className="text-[var(--cdh-text-tertiary)] font-semibold">Réd.</span>
              <select
                aria-label="Rédacteur du compte rendu"
                value={scribeId}
                onChange={(e) => onChangeScribe(Number(e.target.value))}
                className="bg-transparent text-[var(--cdh-text-primary)] font-semibold focus:outline-none cursor-pointer text-[12px]"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id} className="bg-[var(--cdh-bg-canvas)] text-[var(--cdh-text-primary)]">
                    {u.name.split(' ')[0]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={onOpenShortcuts}
            aria-keyshortcuts="? h"
            title="Raccourcis clavier (?)"
            className="hidden lg:inline-flex items-center gap-1 px-2 py-1.5 min-h-[34px] rounded-cdh-md bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-surface-control-hover)] border border-[var(--cdh-border-hairline)] text-[12px] font-semibold text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] transition-colors cursor-pointer"
          >
            <Keyboard className="w-3.5 h-3.5 text-[var(--cdh-accent)]" strokeWidth={2} />
            <kbd className="font-mono text-[11px]">?</kbd>
          </button>

          {sprint.status === 'closed' ? (
            <span className="text-[11.5px] font-semibold text-[var(--cdh-text-secondary)] bg-[var(--cdh-surface-control)] px-3 py-1.5 rounded-cdh-md border border-[var(--cdh-border-hairline)]">
              Sprint archivé
            </span>
          ) : isAdmin ? (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenCloseSprint}
              aria-keyshortcuts="Shift+c"
              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.25} />}
            >
              <span className="sm:hidden">Clôturer</span>
              <span className="hidden sm:inline">Valider &amp; Clôturer</span>
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--cdh-text-secondary)] bg-[var(--cdh-surface-control)] px-2.5 py-1.5 rounded-cdh-md border border-[var(--cdh-border-hairline)]">
              <Shield className="w-3.5 h-3.5 text-[var(--cdh-accent)]" strokeWidth={1.75} />
              <span className="hidden sm:inline">Clôture réservée aux admins</span>
            </span>
          )}
        </div>
      </div>

      {/* Ligne 2 : Segmented Control des 3 étapes + Action contextuelle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[var(--cdh-border-hairline)]">
        <nav
          aria-label="Étapes de la réunion"
          className="flex-1 bg-[var(--cdh-surface-control)] p-1 rounded-cdh-md grid grid-cols-3 gap-1"
        >
          {steps.map((item) => {
            const isActive = meetingStep === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeStep(item.id)}
                aria-current={isActive ? 'step' : undefined}
                aria-keyshortcuts={item.shortcut}
                className={`flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 min-h-[38px] sm:min-h-[34px] rounded-cdh-sm text-[12px] font-semibold transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cdh-border-focus)] ${
                  isActive
                    ? 'bg-[var(--cdh-surface-card-hover)] text-[var(--cdh-text-primary)] shadow-cdh-card'
                    : 'text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)]'
                }`}
              >
                <span
                  className={`w-[18px] h-[18px] min-w-[18px] rounded-full flex items-center justify-center text-[10.5px] font-bold tabular-nums shrink-0 ${
                    isActive
                      ? 'bg-[var(--cdh-accent)] text-white'
                      : 'bg-[var(--cdh-surface-control-hover)] text-[var(--cdh-text-secondary)]'
                  }`}
                >
                  {item.step}
                </span>
                <span className="sm:hidden truncate">{item.mobileLabel}</span>
                <span className="hidden sm:inline truncate">{item.label}</span>
                <span className="hidden xl:inline text-[10.5px] font-medium text-[var(--cdh-text-tertiary)] tabular-nums shrink-0">
                  {item.duration}
                </span>
                {item.badgeCount !== null && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10.5px] font-bold leading-none tabular-nums shrink-0 ${
                      item.badgeTone === 'warning'
                        ? 'bg-[var(--cdh-warning-soft)] text-[var(--cdh-warning)]'
                        : 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-accent)]'
                    }`}
                  >
                    {item.badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {(canCreateQuestion || showAddPendingTask) && (
          <div className="flex items-center gap-1.5 shrink-0">
            {meetingStep === 'questions' && canCreateQuestion && (
              <Button
                variant="primary"
                size="sm"
                onClick={onAddQuestion}
                aria-keyshortcuts="q"
                leftIcon={<Plus className="w-3.5 h-3.5" strokeWidth={2.25} />}
                className="w-full sm:w-auto"
              >
                Poser une question
              </Button>
            )}
            {showAddPendingTask && (
              <Button
                variant={meetingStep === 'questions' ? 'secondary' : 'primary'}
                size="sm"
                onClick={onAddPendingTask}
                aria-keyshortcuts="n + ="
                leftIcon={<Plus className="w-3.5 h-3.5" strokeWidth={2.25} />}
                className="w-full sm:w-auto"
              >
                <span className="sm:hidden">Tâche en attente</span>
                <span className="hidden sm:inline">Nouvelle tâche en attente</span>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
