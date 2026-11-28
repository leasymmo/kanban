import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
  hasBottomDock?: boolean;
}

const TOAST_STYLES: Record<
  ToastType,
  { iconWrap: string; icon: React.ReactNode; role: 'status' | 'alert'; borderAccent: string }
> = {
  success: {
    iconWrap: 'bg-[var(--cdh-success-soft)] text-[var(--cdh-success)]',
    borderAccent: 'border-[var(--cdh-success-accent)]/30',
    icon: <CheckCircle2 className="w-4 h-4" strokeWidth={2.25} />,
    role: 'status'
  },
  error: {
    iconWrap: 'bg-[var(--cdh-danger-soft)] text-[var(--cdh-danger)]',
    borderAccent: 'border-[var(--cdh-danger-accent)]/35',
    icon: <AlertCircle className="w-4 h-4" strokeWidth={2.25} />,
    role: 'alert'
  },
  info: {
    iconWrap: 'bg-[var(--cdh-info-soft)] text-[var(--cdh-info)]',
    borderAccent: 'border-[var(--cdh-accent)]/25',
    icon: <Info className="w-4 h-4" strokeWidth={2.25} />,
    role: 'status'
  }
};

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
  hasBottomDock = false
}) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className={`fixed z-[60] ${
        hasBottomDock
          ? 'bottom-[max(5.25rem,calc(4.5rem+env(safe-area-inset-bottom)))] lg:bottom-5'
          : 'bottom-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-5'
      } left-3 right-3 sm:left-auto sm:right-5 sm:w-full sm:max-w-sm flex flex-col gap-2 pointer-events-none`}
    >
      {toasts.map((toast) => {
        const style = TOAST_STYLES[toast.type];
        return (
          <div
            key={toast.id}
            role={style.role}
            aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
            aria-atomic="true"
            className={`pointer-events-auto cdh-glass-overlay ${style.borderAccent} rounded-cdh-xl p-3 flex items-start gap-2.5 animate-toast-in transition-all`}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${style.iconWrap}`}>
              {style.icon}
            </span>
            <p className="text-[12.5px] font-medium leading-snug text-[var(--cdh-text-primary)] flex-1 pt-0.5 break-words">
              {toast.message}
            </p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Fermer la notification"
              className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-full cursor-pointer shrink-0 transition-colors active:scale-95 text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)]"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
