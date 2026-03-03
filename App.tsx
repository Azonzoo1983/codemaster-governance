import React, { useState, useCallback } from 'react';
import { StoreProvider, useStore } from './store';
import { Layout } from './components/Layout';
import { ToastContainer } from './components/ToastContainer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dashboard } from './pages/Dashboard';
import { NewRequest } from './pages/NewRequest';
import { RequestDetail } from './pages/RequestDetail';
import { Admin } from './pages/Admin';
import { Reports } from './pages/Reports';
import { Register } from './pages/Register';

const LoadingScreen: React.FC = () => (
  <div className="h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
      <h2 className="text-lg font-semibold text-gray-700">Loading CodeMaster...</h2>
      <p className="text-sm text-gray-400 mt-1">Connecting to database</p>
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const { loading } = useStore();
  const [activePage, setActivePage] = useState('dashboard');
  const [detailId, setDetailId] = useState<string | undefined>(undefined);

  // Check URL for registration link on mount
  React.useEffect(() => {
    if (window.location.pathname === '/register') {
      setActivePage('register');
    }
  }, []);

  const navigate = useCallback((page: string, id?: string) => {
    setActivePage(page);
    setDetailId(id);
  }, []);

  if (loading) return <LoadingScreen />;

  const renderPage = () => {
    switch (activePage) {
      case 'register':
        return <Register onNavigate={navigate} />;
      case 'dashboard':
        return <Dashboard onNavigate={navigate} />;
      case 'new-request':
        return <NewRequest onNavigate={navigate} />;
      case 'edit-request':
        return detailId ? <NewRequest onNavigate={navigate} requestId={detailId} /> : <Dashboard onNavigate={navigate} />;
      case 'request-detail':
        return detailId ? <RequestDetail id={detailId} onNavigate={navigate} /> : <Dashboard onNavigate={navigate} />;
      case 'admin':
        return <Admin />;
      case 'reports':
        return <Reports onNavigate={navigate} />;
      default:
        return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <>
      <Layout activePage={activePage} setActivePage={navigate}>
        {renderPage()}
      </Layout>
      <ToastContainer />
    </>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <AppContent />
      </StoreProvider>
    </ErrorBoundary>
  );
};

export default App;
