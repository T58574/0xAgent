import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider } from './context/ToastContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);

// PWA: register service worker (app-shell cache + offline fallback).
// Only meaningful on secure contexts (localhost or https). Over LAN http the
// native install banner still works; SW is a progressive enhancement.
if ('serviceWorker' in navigator && (location.hostname === 'localhost' || location.protocol === 'https:')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline/relative origin — non-fatal */
    });
  });
}

