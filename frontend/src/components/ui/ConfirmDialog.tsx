import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useModalDialog } from '../../hooks/useModalDialog';
import { Button } from './Button';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Hook retournant une fonction asynchrone `confirm(options)` affichant une modale Liquid Glass.
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm doit être utilisé à l’intérieur d’un ConfirmProvider.');
  }
  return ctx;
}

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<(ConfirmOptions & { isOpen: boolean }) | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const closeWith = useCallback((result: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setState(null);
    resolve?.(result);
  }, []);

  const confirm = useCallback<ConfirmFn>((options) => {
    if (resolverRef.current) {
      resolverRef.current(false);
    }
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({ ...options, isOpen: true });
    });
  }, []);

  const dialogRef = useModalDialog<HTMLDivElement>({
    isOpen: !!state?.isOpen,
    onClose: () => closeWith(false),
    initialFocusRef: confirmBtnRef,
  });

  const variant = state?.variant ?? 'danger';
  const titleId = React.useId();

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {state?.isOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 pb-[var(--cdh-vv-bottom,0px)] sm:p-4 bg-[var(--cdh-backdrop-scrim)] backdrop-blur-[6px] animate-backdrop-in"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeWith(false);
            }
          }}
        >
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="cdh-glass-overlay w-full max-w-md rounded-t-cdh-2xl sm:rounded-cdh-2xl overflow-hidden animate-sheet-up sm:animate-modal-in focus:outline-none"
          >
            <div className="px-5 pt-5 pb-4 flex items-start gap-3.5">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  variant === 'danger'
                    ? 'bg-[var(--cdh-danger-soft)] text-[var(--cdh-danger)]'
                    : variant === 'warning'
                    ? 'bg-[var(--cdh-warning-soft)] text-[var(--cdh-warning)]'
                    : 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-accent)]'
                }`}
              >
                {variant === 'danger' ? (
                  <Trash2 className="w-5 h-5" strokeWidth={2} />
                ) : (
                  <AlertTriangle className="w-5 h-5" strokeWidth={2} />
                )}
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <h3
                  id={titleId}
                  className="text-[15.5px] font-semibold tracking-[-0.015em] text-[var(--cdh-text-primary)]"
                >
                  {state.title}
                </h3>
                <p className="text-[13px] text-[var(--cdh-text-secondary)] mt-1 leading-relaxed">
                  {state.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => closeWith(false)}
                aria-label="Fermer"
                className="p-1.5 rounded-full text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>

            <div className="px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:py-3.5 border-t border-[var(--cdh-border-hairline)] flex items-center justify-end gap-2">
              <Button variant="secondary" size="md" onClick={() => closeWith(false)}>
                {state.cancelLabel || 'Annuler'}
              </Button>
              <Button
                ref={confirmBtnRef}
                variant={variant === 'danger' ? 'danger' : 'primary'}
                size="md"
                onClick={() => closeWith(true)}
                className={
                  variant === 'danger'
                    ? '!bg-[var(--cdh-danger-accent)] !text-white hover:opacity-90'
                    : ''
                }
              >
                {state.confirmLabel || 'Confirmer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};
