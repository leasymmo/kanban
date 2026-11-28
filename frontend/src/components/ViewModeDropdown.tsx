import React, { useState, useRef, useEffect } from 'react';
import { LayoutGrid, Home, TableProperties, ChevronDown, Check } from 'lucide-react';
import { TaskViewMode } from '../utils/cookies';

interface ViewOption {
  id: TaskViewMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const VIEW_OPTIONS: ViewOption[] = [
  {
    id: 'kanban',
    label: 'Par statut',
    description: 'Tableau Kanban en 4 colonnes',
    icon: <LayoutGrid className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
  },
  {
    id: 'property',
    label: 'Par logement',
    description: 'Tâches groupées par bien',
    icon: <Home className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
  },
  {
    id: 'list',
    label: 'Liste du sprint',
    description: 'Tableau global triable en accordéon',
    icon: <TableProperties className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
  }
];

interface ViewModeDropdownProps {
  value: TaskViewMode;
  onChange: (mode: TaskViewMode) => void;
  align?: 'left' | 'right';
}

/**
 * Sélecteur de vue compact Liquid Glass :
 * l'icône du bouton s'adapte dynamiquement à la vue active pour l'identifier d'un coup d'œil.
 */
export const ViewModeDropdown: React.FC<ViewModeDropdownProps> = ({
  value,
  onChange,
  align = 'right'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const activeOption = VIEW_OPTIONS.find(opt => opt.id === value) ?? VIEW_OPTIONS[0];

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`Vue active : ${activeOption.label}. Changer de vue`}
        title={`Vue active : ${activeOption.label}`}
        className={`flex items-center gap-1.5 text-[12px] border rounded-cdh-md px-2.5 py-1.5 min-h-[38px] sm:min-h-[34px] font-semibold transition-all active:scale-[0.98] cursor-pointer ${
          isOpen
            ? 'bg-[var(--cdh-accent-soft)] border-[var(--cdh-accent)]/30 text-[var(--cdh-info)]'
            : 'bg-[var(--cdh-surface-control)] border-[var(--cdh-border-hairline)] text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control-hover)]'
        }`}
      >
        <span className="text-[var(--cdh-info)] flex items-center" aria-hidden="true">
          {activeOption.icon}
        </span>
        <span>Vue</span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-[var(--cdh-text-tertiary)] transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
          strokeWidth={2}
        />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Choisir une vue des tâches"
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0 sm:left-auto sm:right-0'
          } mt-1.5 w-64 max-w-[calc(100vw-2rem)] cdh-glass-overlay rounded-cdh-xl p-1.5 z-40 animate-fade-in space-y-0.5`}
        >
          <div className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cdh-text-tertiary)]">
            Affichage des tâches
          </div>

          {VIEW_OPTIONS.map(opt => {
            const isSelected = value === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  onChange(opt.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-cdh-md text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-info)]'
                    : 'text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)]'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-7 h-7 rounded-cdh-sm flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-[var(--cdh-accent)] text-white shadow-xs'
                        : 'bg-[var(--cdh-surface-control)] text-[var(--cdh-text-secondary)]'
                    }`}
                  >
                    {opt.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-semibold leading-tight truncate">
                      {opt.label}
                    </span>
                    <span
                      className={`block text-[11px] leading-tight mt-0.5 truncate ${
                        isSelected
                          ? 'text-[var(--cdh-info)] opacity-85'
                          : 'text-[var(--cdh-text-secondary)]'
                      }`}
                    >
                      {opt.description}
                    </span>
                  </span>
                </span>

                {isSelected && (
                  <Check className="w-3.5 h-3.5 shrink-0 text-[var(--cdh-info)]" strokeWidth={2.25} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
