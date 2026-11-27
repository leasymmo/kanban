import React from 'react';
import { Search, X } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const BASE_INPUT_CLASSES =
  'w-full rounded-cdh-md bg-[var(--cdh-surface-input)] border border-[var(--cdh-border-subtle)] px-3 py-2 text-[13.5px] text-[var(--cdh-text-primary)] placeholder:text-[var(--cdh-text-tertiary)] transition-all duration-150 focus:outline-none focus:border-[var(--cdh-border-focus)] focus:ring-[3px] focus:ring-[var(--cdh-accent-soft)] disabled:opacity-45 disabled:cursor-not-allowed';

/**
 * Champ de saisie standardisé avec libellé visible et message d'erreur associé.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = '', ...rest }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[12px] font-semibold text-[var(--cdh-text-secondary)]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error || undefined}
          className={`${BASE_INPUT_CLASSES} ${
            error ? 'border-[var(--cdh-danger-accent)] focus:ring-[var(--cdh-danger-soft)]' : ''
          } ${className}`.trim()}
          {...rest}
        />
        {error ? (
          <p className="text-[11.5px] font-medium text-[var(--cdh-danger)]">{error}</p>
        ) : (
          hint && <p className="text-[11.5px] text-[var(--cdh-text-tertiary)]">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  value: string;
  onClear?: () => void;
  shortcutHint?: string;
}

/**
 * Barre de recherche Apple-style creusée avec bouton d'effacement rapide.
 */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onClear, shortcutHint, className = '', placeholder = 'Rechercher…', ...rest }, ref) => {
    return (
      <div className={`relative flex items-center ${className}`.trim()}>
        <Search
          aria-hidden="true"
          className="w-3.5 h-3.5 text-[var(--cdh-text-tertiary)] absolute left-3 pointer-events-none"
          strokeWidth={2}
        />
        <input
          ref={ref}
          type="search"
          value={value}
          placeholder={placeholder}
          className="w-full min-h-[36px] pl-8 pr-8 py-1.5 rounded-cdh-md bg-[var(--cdh-surface-control)] border border-transparent text-[13px] text-[var(--cdh-text-primary)] placeholder:text-[var(--cdh-text-tertiary)] transition-all duration-150 focus:outline-none focus:bg-[var(--cdh-surface-input)] focus:border-[var(--cdh-border-focus)] focus:ring-[3px] focus:ring-[var(--cdh-accent-soft)]"
          {...rest}
        />
        {value && onClear ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Effacer la recherche"
            className="absolute right-1.5 p-1 rounded-full text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control-hover)] cursor-pointer transition-colors"
          >
            <X className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        ) : (
          shortcutHint && (
            <kbd
              aria-hidden="true"
              className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-[var(--cdh-surface-input)] border border-[var(--cdh-border-hairline)] text-[var(--cdh-text-tertiary)] absolute right-2 pointer-events-none"
            >
              {shortcutHint}
            </kbd>
          )
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
