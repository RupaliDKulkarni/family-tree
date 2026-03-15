import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { TreeProvider } from './contexts/TreeContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { UIProvider } from './contexts/UIContext';
import { migrateLegacyStorage } from './services/migrateLegacyStorage';
import App from './App.tsx';
import './index.css';

migrateLegacyStorage().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter basename="/family-tree">
        <AuthProvider>
          <TreeProvider>
            <NavigationProvider>
              <UIProvider>
                <App />
              </UIProvider>
            </NavigationProvider>
          </TreeProvider>
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );
});
