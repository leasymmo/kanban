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
  { wrapper: string; iconWrap: string; closeBtn: string; icon: React.ReactNode; role: 'status' | 'alert' }
> = {
  success: {
    wrapper: 'bg-white/95 border-emerald-300/90 text-slate-800 shadow-lg shadow-emerald-950/10',
    iconWrap: 'bg-emerald-100 text-emerald-700',
    closeBtn: 'text-slate-400 hover:text-slate-700 hover:bg-slate-100',
    icon: <CheckCircle2 className="w-4 h-4" strokeWidth={2.25} />,
    role: 'status'
  },
  error: {
    wrapper: 'bg-red-50/95 border-red-300 text-red-900 shadow-lg shadow-red-950/15',
    iconWrap: 'bg-red-100 text-red-700',
    closeBtn: 'text-red-500 hover:text-red-800 hover:bg-red-100',
    icon: <AlertCircle className="w-4 h-4" strokeWidth={2.25} />,
    role: 'alert'
  },
  info: {
    wrapper: 'bg-white/95 border-indigo-200 text-slate-800 shadow-lg shadow-slate-900/10',
    iconWrap: 'bg-indigo-100 text-indigo-700',
    closeBtn: 'text-slate-400 hover:text-slate-700 hover:bg-slate-100',
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
      aria-live="polite"
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
            className={`pointer-events-auto backdrop-blur-md border rounded-2xl p-3 flex items-start gap-2.5 animate-fade-in transition-all ${style.wrapper}`}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${style.iconWrap}`}>
              {style.icon}
            </span>
            <p className="text-xs font-semibold leading-snug flex-1 pt-0.5 break-words">
              {toast.message}
            </p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Fermer la notification"
              className={`p-1 rounded-lg cursor-pointer shrink-0 transition-colors ${style.closeBtn}`}
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
