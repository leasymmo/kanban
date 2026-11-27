/// <reference types="vite/client" />
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ConfirmProvider } from './components/ui';
import './index.css';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // L'enregistrement PWA est optionnel si bloqué par le navigateur
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfirmProvider>
      <App />
    </ConfirmProvider>
  </React.StrictMode>
);
