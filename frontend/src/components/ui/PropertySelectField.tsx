import React, { useId } from 'react';
import { Property } from '../../types';
import { PropertyMultiSelect } from './PropertyMultiSelect';

export interface PropertySelectFieldProps {
  isEdit: boolean;
  properties: Property[];
  propertyId: number | '';
  onChangePropertyId: (id: number | '') => void;
  selectedPropertyIds: number[];
  onToggleSelectedProperty: (id: number) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  orphanProperty?: { id: number; name?: string | null } | null;
}

/**
 * Sélecteur de logement unifié pour création multi-logements ou édition simple.
 * Partagé entre TaskModal et MeetingQuickTaskModal.
 */
export const PropertySelectField: React.FC<PropertySelectFieldProps> = ({
  isEdit,
  properties,
  propertyId,
  onChangePropertyId,
  selectedPropertyIds,
  onToggleSelectedProperty,
  onSelectAll,
  onSelectNone,
  orphanProperty,
}) => {
  const selectId = useId();

  return (
    <div className="pt-2.5 border-t border-[var(--cdh-border-hairline)] min-w-0">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label
          htmlFor={isEdit ? selectId : undefined}
          className="block text-[11px] font-bold text-[var(--cdh-text-secondary)] uppercase tracking-wider"
        >
          {isEdit ? 'Logement concerné' : 'Logement(s) concerné(s)'}
        </label>
        {!isEdit && properties.length > 0 && (
          <div className="flex items-center gap-2 text-[11px] font-semibold">
            <button
              type="button"
              onClick={onSelectAll}
              className="text-[var(--cdh-accent)] hover:underline cursor-pointer"
            >
              Tout sélectionner
            </button>
            {selectedPropertyIds.length > 0 && (
              <>
                <span className="text-[var(--cdh-border-subtle)]">|</span>
                <button
                  type="button"
                  onClick={onSelectNone}
                  className="text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] cursor-pointer"
                >
                  Aucun
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {isEdit ? (
        <select
          id={selectId}
          value={propertyId}
          onChange={(e) =>
            onChangePropertyId(e.target.value === '' ? '' : Number(e.target.value))
          }
          className="w-full px-2.5 py-1.5 bg-[var(--cdh-surface-input)] border border-[var(--cdh-border-subtle)] rounded-cdh-md text-sm text-[var(--cdh-text-primary)] focus:outline-none focus:border-[var(--cdh-border-focus)] focus:ring-2 focus:ring-[var(--cdh-accent-soft)] cursor-pointer"
        >
          <option value="">Aucun / Tâche générale</option>
          {orphanProperty && !properties.some((p) => p.id === orphanProperty.id) && (
            <option value={orphanProperty.id}>
              {orphanProperty.name || `Hébergement #${orphanProperty.id}`} (désactivé)
            </option>
          )}
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {Number(p.is_active) === 0 ? `${p.name} (désactivé)` : p.name}
            </option>
          ))}
        </select>
      ) : (
        <PropertyMultiSelect
          properties={properties}
          selectedIds={selectedPropertyIds}
          onToggle={onToggleSelectedProperty}
        />
      )}
    </div>
  );
};
