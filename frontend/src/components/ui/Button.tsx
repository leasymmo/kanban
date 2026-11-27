import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--cdh-accent)] text-[var(--cdh-on-accent)] shadow-sm hover:bg-[var(--cdh-accent-hover)] active:bg-[var(--cdh-accent-active)] border border-white/15',
  secondary:
    'bg-[var(--cdh-surface-input)] text-[var(--cdh-text-primary)] border border-[var(--cdh-border-subtle)] shadow-cdh-card hover:bg-[var(--cdh-surface-card-hover)]',
  ghost:
    'bg-transparent text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] border border-transparent',
  danger:
    'bg-[var(--cdh-danger-soft)] text-[var(--cdh-danger)] border border-transparent hover:bg-[var(--cdh-danger-accent)] hover:text-white',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[36px] sm:min-h-[32px] px-2.5 py-1 text-[12px] rounded-cdh-sm gap-1.5',
  md: 'min-h-[44px] sm:min-h-[36px] px-3.5 py-1.5 text-[13px] rounded-cdh-md gap-2',
  lg: 'min-h-[44px] px-5 py-2.5 text-[14px] rounded-cdh-lg gap-2',
};

/**
 * Bouton standardisé du Design System Carré d'Hôtes avec états normal, hover, active, focus-visible et disabled.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      className = '',
      type = 'button',
      children,
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;
    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={isLoading || undefined}
        className={`inline-flex items-center justify-center font-medium select-none cursor-pointer transition-all duration-150 active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cdh-border-focus)] ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`.trim()}
        {...rest}
      >
        {isLoading ? (
          <span
            aria-hidden="true"
            className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0"
          />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {children}
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
