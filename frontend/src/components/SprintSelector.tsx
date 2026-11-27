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
      <div className="relative flex items-center gap-1.5 sm:gap-2 bg-slate-800/85 hover:bg-slate-800 text-white px-2.5 sm:px-3 py-1.5 min-h-[38px] sm:min-h-0 rounded-xl border border-white/[0.1] hover:border-white/[0.18] focus-within:ring-2 focus-within:ring-brand-500/60 text-xs sm:text-[13px] shadow-xs transition-all min-w-0 overflow-hidden">
        <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-400 shrink-0" strokeWidth={1.9} />
        <select
          aria-label="Sélectionner le sprint"
          value={currentSprintId || ''}
          onChange={(e) => onSelectSprint(Number(e.target.value))}
          className="appearance-none bg-transparent text-white font-semibold focus:outline-none cursor-pointer pr-5 min-w-0 max-w-[165px] xs:max-w-[210px] sm:max-w-[230px] md:max-w-[185px] lg:max-w-[260px] truncate text-sm sm:text-[13px]"
        >
          {sprints.map((sprint) => (
            <option key={sprint.id} value={sprint.id} className="bg-slate-900 text-white">
              {sprint.name} {sprint.status === 'active' ? '🟢 (En cours)' : '🔒 (Archivé)'}
            </option>
          ))}
        </select>
        <ChevronDown
          className="w-3.5 h-3.5 text-slate-400 pointer-events-none shrink-0 -ml-4"
          strokeWidth={2}
        />

        {isReadOnly && (
          <span
            className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] bg-amber-500/20 text-amber-300 px-1.5 sm:px-2 py-0.5 rounded-md border border-amber-500/30 font-medium shrink-0"
            title="Mode lecture seule"
          >
            <Lock className="w-3 h-3" strokeWidth={1.75} />
            <span className="hidden sm:inline">Lecture seule</span>
          </span>
        )}
      </div>
    </div>
  );
};
