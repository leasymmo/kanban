import React from 'react';
import { hexToSoftTint } from '../../utils/color';

export interface PropertyPillProps {
  name: string;
  color?: string | null;
  className?: string;
}

/**
 * Pilule colorée homogène affichant un hébergement avec pastille et fond doux.
 */
export const PropertyPill: React.FC<PropertyPillProps> = React.memo(
  ({ name, color, className = '' }) => (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-cdh-xs text-[var(--cdh-text-primary)] max-w-full ${className}`.trim()}
      style={{
        backgroundColor: hexToSoftTint(color || undefined, 0.14),
      }}
    >
      <span
        aria-hidden="true"
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color || '#007AFF' }}
      />
      <span className="truncate">{name}</span>
    </span>
  )
);

PropertyPill.displayName = 'PropertyPill';
