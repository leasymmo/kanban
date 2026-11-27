import React from 'react';

export const ADMIN_PRESET_COLORS = [
  '#1C69E3',
  '#7A4FD9',
  '#03875B',
  '#AB5803',
  '#C32777',
  '#13808A',
  '#5A5CE2',
  '#CC2827',
];

interface ColorSwatchPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  presetColors?: string[];
}

/**
 * Sélecteur de couleur accessible en Light et Dark Mode avec palette prédéfinie et sélecteur libre.
 */
export const ColorSwatchPicker: React.FC<ColorSwatchPickerProps> = ({
  label,
  value,
  onChange,
  presetColors = ADMIN_PRESET_COLORS,
}) => {
  return (
    <div className="space-y-1.5">
      <span className="block text-[12px] font-semibold text-[var(--cdh-text-secondary)]">
        {label}
      </span>
      <div className="flex items-center gap-2 flex-wrap">
        {presetColors.map((color) => {
          const isSelected = value.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              aria-label={`Choisir la couleur ${color}`}
              aria-pressed={isSelected}
              className={`w-7 h-7 rounded-full cursor-pointer transition-all shrink-0 ${
                isSelected
                  ? 'ring-2 ring-[var(--cdh-border-focus)] ring-offset-2 ring-offset-[var(--cdh-surface-card)] scale-105'
                  : 'opacity-85 hover:opacity-100 hover:scale-105 ring-1 ring-white/20'
              }`}
              style={{ backgroundColor: color }}
            />
          );
        })}

        <label
          title="Couleur personnalisée"
          className="relative inline-flex items-center justify-center w-7 h-7 rounded-full border border-[var(--cdh-border-subtle)] bg-[var(--cdh-surface-input)] cursor-pointer overflow-hidden hover:border-[var(--cdh-border-focus)] transition-colors shrink-0"
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Couleur personnalisée"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <span
            className="w-4 h-4 rounded-full ring-1 ring-black/15"
            style={{ backgroundColor: value }}
          />
        </label>
      </div>
    </div>
  );
};
