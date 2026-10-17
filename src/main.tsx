import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Service worker: conserva la interfaz y los recursos esenciales para uso offline.
if ('serviceWorker' in navigator && import.meta.env.PROD && import.meta.env.VITE_SINGLEFILE !== '1') {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const urls = [
        location.origin + '/',
        ...performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .filter((u) => u.startsWith(location.origin)),
      ];
      (reg.active ?? navigator.serviceWorker.controller)?.postMessage({ type: 'CACHE_URLS', urls });
    } catch (e) {
      console.warn('Service worker no disponible', e);
    }
  });
}
