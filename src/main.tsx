import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { OnlineProvider } from './state/online';
import { StoreProvider } from './state/store';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <OnlineProvider>
        <App />
      </OnlineProvider>
    </StoreProvider>
  </StrictMode>,
);
