import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Police d'apparat (rangs, titres) embarquée dans le bundle : aucun appel externe.
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import './styles.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
