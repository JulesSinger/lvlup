import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Police d'apparat (rangs, titres) embarquée dans le bundle : aucun appel externe.
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import './styles.css';
import App from './App.tsx';
import { watchSystemTheme } from './core/lib/theme';

// Le thème est déjà posé par le script d'index.html ; il reste à suivre
// l'appareil quand le choix est « Système ».
watchSystemTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA : offline de base + installation sur l'écran d'accueil.
// En dev, Vite sert les modules à la volée — on n'enregistre qu'en production.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Pas bloquant : l'app fonctionne sans offline.
    });
  });
}
