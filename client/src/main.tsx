import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './lib/i18n'; // initializes i18next - must run before App renders
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
