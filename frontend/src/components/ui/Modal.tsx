import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalDialog } from '../../hooks/useModalDialog';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerBadge?: React.ReactNode;
  maxWidthClass?: string;
  canClose?: boolean;
  bodyClassName?: string;
  footerClassName?: string;
  footer?: React.ReactNode;
  asForm?: boolean;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}

/**
 * Modale Liquid Glass accessible rendue via portal (focus trap, Échap, restauration du focus via useModalDialog).
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  headerBadge,
  maxWidthClass = 'max-w-lg',
  canClose = true,
  bodyClassName = 'p-5 max-h-[75dvh] overflow-y-auto',
  footerClassName = 'px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:py-3.5 border-t border-[var(--cdh-border-hairline)] flex items-center justify-end gap-2',
  footer,
  asForm = false,
  onSubmit,
  initialFocusRef,
  children,
}) => {
  const dialogRef = useModalDialog<HTMLDivElement>({
    isOpen,
    onClose,
    canClose,
    initialFocusRef,
  });
  const titleId = React.useId();

  if (!isOpen || typeof document === 'undefined') return null;

  const headerNode = (
    <div className="px-5 py-4 border-b border-[var(--cdh-border-hairline)] flex items-start justify-between gap-3 shrink-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2
            id={titleId}
            className="text-[16px] font-semibold tracking-[-0.015em] text-[var(--cdh-text-primary)] truncate"
          >
            {title}
          </h2>
          {headerBadge}
        </div>
        {subtitle && (
          <p className="text-[12.5px] text-[var(--cdh-text-secondary)] mt-0.5">{subtitle}</p>
        )}
      </div>
      <button
        type="button"
        disabled={!canClose}
        onClick={() => canClose && onClose()}
        aria-label="Fermer la fenêtre"
        className="p-1.5 min-w-[36px] min-h-[36px] rounded-full flex items-center justify-center text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
      >
        <X className="w-4 h-4" strokeWidth={2} />
      </button>
    </div>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 pb-[var(--cdh-vv-bottom,0px)] sm:p-4 bg-[var(--cdh-backdrop-scrim)] backdrop-blur-[6px] animate-backdrop-in"
      onMouseDown={(e) => {
        if (canClose && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`cdh-glass-overlay w-full ${maxWidthClass} rounded-t-cdh-2xl sm:rounded-cdh-2xl overflow-hidden max-h-[min(92dvh,calc(var(--cdh-vv-height,100dvh)-16px))] sm:max-h-[90dvh] flex flex-col animate-sheet-up sm:animate-modal-in focus:outline-none`}
      >
        {headerNode}

        {asForm ? (
          <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
            <div className={bodyClassName}>{children}</div>
            {footer && <div className={footerClassName}>{footer}</div>}
          </form>
        ) : (
          <>
            <div className={bodyClassName}>{children}</div>
            {footer && <div className={footerClassName}>{footer}</div>}
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
