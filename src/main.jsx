import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Fonts — Latin display/body plus Vazirmatn so Persian names and text render
// correctly. Subsets are unicode-ranged, so unused scripts are never downloaded.
import '@fontsource/baloo-2/latin-700.css';
import '@fontsource/baloo-2/latin-800.css';
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/vazirmatn/arabic-400.css';
import '@fontsource/vazirmatn/arabic-700.css';
import '@fontsource/vazirmatn/arabic-800.css';
import '@fontsource/vazirmatn/latin-400.css';
import '@fontsource/vazirmatn/latin-700.css';
import '@fontsource/vazirmatn/latin-800.css';

import './shared/styles/index.css';
import App from './games/pig/PigGame.jsx';
import { SoundProvider } from './shared/hooks/useSound.jsx';

const container = document.getElementById('root');

createRoot(container).render(
  <StrictMode>
    <SoundProvider>
      <App />
    </SoundProvider>
  </StrictMode>,
);
