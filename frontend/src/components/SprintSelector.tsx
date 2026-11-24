import React from 'react';
import { Sprint, User } from '../types';
import { ChevronDown, Calendar, Lock, CheckCircle2 } from 'lucide-react';

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
  const currentSprint = sprints.find(s => s.id === currentSprintId);

  return (
    <div className="relative inline-block text-left shrink-0">
      <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-800/80 hover:bg-slate-800 text-white px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs sm:text-sm shadow-xs transition-all">
        <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-400 shrink-0" />
        <select
          value={currentSprintId || ''}
          onChange={(e) => onSelectSprint(Number(e.target.value))}
          className="bg-transparent text-white font-medium focus:outline-none cursor-pointer pr-1 max-w-[130px] xs:max-w-[180px] sm:max-w-[240px] md:max-w-none truncate"
        >
          {sprints.map((sprint) => (
            <option key={sprint.id} value={sprint.id} className="bg-slate-900 text-white">
              {sprint.name} {sprint.status === 'active' ? '🟢 (En cours)' : '🔒 (Archivé)'}
            </option>
          ))}
        </select>
        {isReadOnly ? (
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/30 font-medium shrink-0">
            <Lock className="w-3 h-3" /> Lecture seule
          </span>
        ) : (
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-500/30 font-medium shrink-0">
            <CheckCircle2 className="w-3 h-3" /> Actif
          </span>
        )}
      </div>
    </div>
  );
};
