import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/styles/globals.css';
import Router from '@/router/index';
import { registerAllAlgorithms } from '@/algorithms/register';

// Register all algorithms once at app startup
registerAllAlgorithms();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
);
