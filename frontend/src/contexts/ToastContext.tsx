import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ToastContainer, ToastItem, ToastType } from '../components/ToastContainer';

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
  showSuccessToast: (message: string) => void;
  showErrorToast: (message: string) => void;
  setHasBottomDock: (hasBottomDock: boolean) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [hasBottomDock, setHasBottomDock] = useState(false);
  const toastIdRef = useRef(0);
  const toastTimersRef = useRef<Map<number, number>>(new Map());

  const dismissToast = useCallback((id: number) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
    const duration = type === 'error' ? 5500 : 3200;
    const timer = window.setTimeout(() => {
      toastTimersRef.current.delete(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
    toastTimersRef.current.set(id, timer);
  }, []);

  const showSuccessToast = useCallback((msg: string) => showToast(msg, 'success'), [showToast]);
  const showErrorToast = useCallback((msg: string) => showToast(msg, 'error'), [showToast]);

  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const value = useMemo(
    () => ({ showToast, showSuccessToast, showErrorToast, setHasBottomDock }),
    [showToast, showSuccessToast, showErrorToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} hasBottomDock={hasBottomDock} />
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return ctx;
}
