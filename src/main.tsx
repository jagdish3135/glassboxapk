import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Cursor } from './components/Cursor';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Cursor mode="ring" />
  </StrictMode>,
);
