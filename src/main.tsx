import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { browserPathToHashUrl } from './lib/spaHash';
import './index.css';

const hashUrl = browserPathToHashUrl(
  window.location.pathname,
  window.location.search,
  window.location.hash,
  import.meta.env.BASE_URL,
);
if (hashUrl !== null) {
  window.location.replace(hashUrl);
} else {
  registerSW({ immediate: true });

  const root = document.getElementById('root');
  if (!root) {
    throw new Error('root element not found');
  }

  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
