import React, { useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Home, Search, X } from 'lucide-react';
import { Property } from '../../types';

export interface PropertyMultiSelectProps {
  properties: Property[];
  selectedIds: number[];
  onToggle: (id: number) => void;
}

interface PropertyPillProps {
  property: Property;
  isSelected: boolean;
  onToggle: (id: number) => void;
}

const PropertyPill = React.memo<PropertyPillProps>(({ property, isSelected, onToggle }) => {
  const isDeactivated = Number(property.is_active) === 0;
  return (
    <button
      type="button"
      onClick={() => onToggle(property.id)}
      aria-pressed={isSelected}
      className={`inline-flex items-center px-2.5 py-1.5 sm:py-1 min-h-[34px] sm:min-h-[28px] mr-1.5 last:mr-0 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 cursor-pointer touch-manipulation transition-colors ${
        isSelected
          ? 'text-white border-transparent'
          : 'bg-white text-slate-700 border-black/[0.12] hover:border-black/[0.22] hover:bg-slate-50'
      }`}
      style={isSelected ? { backgroundColor: property.color || '#3B82F6' } : undefined}
    >
      <Home
        className={`w-3 h-3 mr-1 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`}
        strokeWidth={2}
      />
      <span>{isDeactivated ? `${property.name} (désactivé)` : property.name}</span>
      {isSelected && <Check className="w-3 h-3 ml-1 shrink-0" strokeWidth={2} />}
    </button>
  );
});

PropertyPill.displayName = 'PropertyPill';

/**
 * Sélecteur multi-logements léger, optimisé pour de grands volumes (~100+) et vieux navigateurs :
 * - Bandeau horizontal unique (flex-nowrap + marges classiques, sans CSS Grid complexe)
 * - Scroll tactile garanti sur mobile (`touch-action: pan-x`, `-webkit-overflow-scrolling: touch`)
 * - Flèches latérales sur desktop et filtre texte optionnel au-delà de 8 logements
 */
export const PropertyMultiSelect: React.FC<PropertyMultiSelectProps> = React.memo(
  ({ properties, selectedIds, onToggle }) => {
    const [filterQuery, setFilterQuery] = useState('');
    const trackRef = useRef<HTMLDivElement>(null);

    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

    const filteredProperties = useMemo(() => {
      const q = filterQuery.trim().toLowerCase();
      if (!q) return properties;
      return properties.filter((p) => p.name.toLowerCase().includes(q));
    }, [properties, filterQuery]);

    const scrollTrackBy = (delta: number) => {
      const el = trackRef.current;
      if (!el) return;
      try {
        el.scrollBy({ left: delta, behavior: 'smooth' });
      } catch {
        el.scrollLeft += delta;
      }
    };

    return (
      <div className="w-full min-w-0 p-2 rounded-2xl border border-black/[0.12] bg-slate-50/70 space-y-2">
        {properties.length > 8 && (
          <div className="relative flex items-center">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none"
              strokeWidth={2}
            />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder={`Filtrer parmi ${properties.length} logements…`}
              aria-label="Filtrer les logements"
              className="w-full pl-8 pr-7 py-1 text-xs bg-white border border-black/[0.1] rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                aria-label="Effacer le filtre logement"
                className="absolute right-1.5 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            )}
          </div>
        )}

        <div className="flex items-center w-full min-w-0">
          <button
            type="button"
            onClick={() => scrollTrackBy(-220)}
            aria-label="Défiler les logements vers la gauche"
            className="hidden sm:inline-flex items-center justify-center w-6 h-7 mr-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-white border border-transparent hover:border-black/[0.08] shrink-0 cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
          </button>

          <div
            ref={trackRef}
            className="flex flex-nowrap items-center flex-1 w-full min-w-0 overflow-x-auto overflow-y-hidden pb-1"
            style={{
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x',
              scrollbarWidth: 'thin'
            }}
          >
            {filteredProperties.length === 0 ? (
              <span className="text-xs text-slate-400 px-1 py-1 whitespace-nowrap">
                Aucun logement correspondant.
              </span>
            ) : (
              filteredProperties.map((p) => (
                <PropertyPill
                  key={p.id}
                  property={p}
                  isSelected={selectedSet.has(p.id)}
                  onToggle={onToggle}
                />
              ))
            )}
          </div>

          <button
            type="button"
            onClick={() => scrollTrackBy(220)}
            aria-label="Défiler les logements vers la droite"
            className="hidden sm:inline-flex items-center justify-center w-6 h-7 ml-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-white border border-transparent hover:border-black/[0.08] shrink-0 cursor-pointer transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>

        <p className="text-[11px] text-slate-500 px-0.5">
          {selectedIds.length === 0
            ? 'Sans logement (1 tâche générale).'
            : selectedIds.length === 1
            ? '1 logement sélectionné.'
            : `${selectedIds.length} logements → ${selectedIds.length} tâches créées.`}
        </p>
      </div>
    );
  }
);

PropertyMultiSelect.displayName = 'PropertyMultiSelect';
