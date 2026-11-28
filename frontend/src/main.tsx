/// <reference types="vite/client" />
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { ConfirmProvider } from './components/ui';
import './index.css';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // L'enregistrement PWA est optionnel si bloqué par le navigateur
    });
  });
}

// Empêcher le zoom par pincement sur iOS Safari / PWA standalone
if (typeof document !== 'undefined') {
  const preventPinchZoom = (e: Event) => e.preventDefault();
  document.addEventListener('gesturestart', preventPinchZoom, { passive: false });
  document.addEventListener('gesturechange', preventPinchZoom, { passive: false });
  document.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ConfirmProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ConfirmProvider>
    </ThemeProvider>
  </React.StrictMode>
);
