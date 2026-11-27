import React from 'react';

export interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Barre de progression minimaliste inspirée d'iOS/macOS, passant au vert à 100%.
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  size = 'sm',
  className = '',
}) => {
  const clamped = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  const isComplete = clamped >= 100;

  return (
    <div className={`w-full ${className}`.trim()}>
      <div
        role="progressbar"
        aria-label={label || 'Progression'}
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        className={`w-full rounded-full overflow-hidden bg-[var(--cdh-surface-control)] ${
          size === 'sm' ? 'h-1.5' : 'h-2'
        }`}
      >
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${clamped}%`,
            backgroundColor: isComplete ? 'var(--cdh-success-accent)' : 'var(--cdh-accent)',
          }}
        />
      </div>
    </div>
  );
};
