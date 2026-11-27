import React from 'react';
import { Sprint } from '../types';
import { Calendar, Lock, ChevronDown } from 'lucide-react';

interface SprintSelectorProps {
  sprints: Sprint[];
  currentSprintId: number | null;
  onSelectSprint: (id: number) => void;
  isReadOnly: boolean;
}

export const SprintSelector: React.FC<SprintSelectorProps> = ({
  sprints,
  currentSprintId,
  onSelectSprint,
  isReadOnly
}) => {
  return (
    <div className="relative inline-flex items-center min-w-0 max-w-full">
      <div className="relative flex items-center gap-1.5 sm:gap-2 bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-surface-control-hover)] text-[var(--cdh-text-primary)] px-2.5 sm:px-3 py-1.5 min-h-[38px] sm:min-h-[34px] rounded-cdh-md border border-[var(--cdh-border-hairline)] focus-within:ring-2 focus-within:ring-[var(--cdh-accent-soft)] focus-within:border-[var(--cdh-border-focus)] text-xs sm:text-[13px] transition-all min-w-0 overflow-hidden">
        <Calendar className="w-3.5 h-3.5 text-[var(--cdh-accent)] shrink-0" strokeWidth={2} />
        <select
          aria-label="Sélectionner le sprint"
          value={currentSprintId || ''}
          onChange={(e) => onSelectSprint(Number(e.target.value))}
          className="appearance-none bg-transparent text-[var(--cdh-text-primary)] font-semibold focus:outline-none cursor-pointer pr-5 min-w-0 max-w-[160px] xs:max-w-[205px] sm:max-w-[230px] md:max-w-[185px] lg:max-w-[260px] truncate text-[13px]"
        >
          {sprints.map((sprint) => (
            <option
              key={sprint.id}
              value={sprint.id}
              className="bg-[var(--cdh-bg-canvas)] text-[var(--cdh-text-primary)]"
            >
              {sprint.name} {sprint.status === 'active' ? '· En cours' : '· Archivé'}
            </option>
          ))}
        </select>
        <ChevronDown
          className="w-3.5 h-3.5 text-[var(--cdh-text-tertiary)] pointer-events-none shrink-0 -ml-4"
          strokeWidth={2}
        />

        {isReadOnly && (
          <span
            className="inline-flex items-center gap-1 text-[10.5px] bg-[var(--cdh-warning-soft)] text-[var(--cdh-warning)] px-1.5 sm:px-2 py-0.5 rounded-cdh-xs font-semibold shrink-0"
            title="Mode lecture seule"
          >
            <Lock className="w-3 h-3" strokeWidth={2} />
            <span className="hidden sm:inline">Lecture seule</span>
          </span>
        )}
      </div>
    </div>
  );
};
