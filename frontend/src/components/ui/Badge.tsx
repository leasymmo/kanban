import React from 'react';

export type BadgeVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dotColor?: string;
  pill?: boolean;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'bg-[var(--cdh-surface-control)] text-[var(--cdh-text-secondary)]',
  accent: 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-info)]',
  success: 'bg-[var(--cdh-success-soft)] text-[var(--cdh-success)]',
  warning: 'bg-[var(--cdh-warning-soft)] text-[var(--cdh-warning)]',
  danger: 'bg-[var(--cdh-danger-soft)] text-[var(--cdh-danger)]',
};

/**
 * Badge sémantique accessible (contraste >= 4.5:1) pour statuts, priorités et logements.
 */
export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  dotColor,
  pill = false,
  className = '',
  children,
  ...rest
}) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold leading-tight tracking-[0.01em] whitespace-nowrap ${
        pill ? 'rounded-full' : 'rounded-cdh-xs'
      } ${VARIANT_CLASSES[variant]} ${className}`.trim()}
      {...rest}
    >
      {dotColor && (
        <span
          aria-hidden="true"
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: dotColor }}
        />
      )}
      {children}
    </span>
  );
};
