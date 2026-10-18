import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { AuthProvider } from './contexts/AuthContext.js';
import { LanguageProvider } from './contexts/LanguageContext.js';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </LanguageProvider>
  </React.StrictMode>
);
