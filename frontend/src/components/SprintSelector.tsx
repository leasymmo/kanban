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
    <div className="relative inline-block text-left">
      <div className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg border border-slate-700 text-sm shadow-sm transition-all">
        <Calendar className="w-4 h-4 text-brand-500" />
        <select
          value={currentSprintId || ''}
          onChange={(e) => onSelectSprint(Number(e.target.value))}
          className="bg-transparent text-white font-medium focus:outline-none cursor-pointer pr-2"
        >
          {sprints.map((sprint) => (
            <option key={sprint.id} value={sprint.id} className="bg-slate-900 text-white">
              {sprint.name} {sprint.status === 'active' ? '🟢 (En cours)' : '🔒 (Archivé)'}
            </option>
          ))}
        </select>
        {isReadOnly ? (
          <span className="flex items-center gap-1 text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 font-medium">
            <Lock className="w-3 h-3" /> Lecture seule
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 font-medium">
            <CheckCircle2 className="w-3 h-3" /> Actif
          </span>
        )}
      </div>
    </div>
  );
};
