/**
 * @fileoverview React 18 mounting entrypoint for AGY Token Telemetry UI.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(<App />);
}
