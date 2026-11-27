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
    wrapper: 'bg-slate-900/85 border-emerald-500/40 text-slate-100 shadow-xl shadow-emerald-950/30',
    iconWrap: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    closeBtn: 'text-slate-400 hover:text-slate-200 hover:bg-white/10',
    icon: <CheckCircle2 className="w-4 h-4" strokeWidth={2.25} />,
    role: 'status'
  },
  error: {
    wrapper: 'bg-slate-900/85 border-rose-500/40 text-slate-100 shadow-xl shadow-rose-950/30',
    iconWrap: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
    closeBtn: 'text-rose-400 hover:text-rose-200 hover:bg-rose-500/20',
    icon: <AlertCircle className="w-4 h-4" strokeWidth={2.25} />,
    role: 'alert'
  },
  info: {
    wrapper: 'bg-slate-900/85 border-cyan-500/40 text-slate-100 shadow-xl shadow-cyan-950/30',
    iconWrap: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
    closeBtn: 'text-slate-400 hover:text-slate-200 hover:bg-white/10',
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
            aria-atomic="true"
            className={`pointer-events-auto backdrop-blur-md border rounded-2xl p-3 flex items-start gap-2.5 animate-toast-in transition-all ${style.wrapper}`}
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
              className={`p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg cursor-pointer shrink-0 transition-colors active:scale-95 ${style.closeBtn}`}
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
