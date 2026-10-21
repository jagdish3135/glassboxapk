import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Landing } from './Landing';
import '../styles.css';
import './landing.css';

// Viewer links like localhost:5173/#/report/fooddash belong to the viewer, not the landing page.
if (/^#\/(report|sample|scan)\//.test(window.location.hash)) window.location.replace(`app.html${window.location.hash}`);
else createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
