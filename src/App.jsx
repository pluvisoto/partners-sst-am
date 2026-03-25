import React, { useState, useEffect, useCallback } from 'react';
import { extractPartnerReferralFromPath } from './utils/partnerLanding.js';
import { resumeBackofficeSession, signOutBackoffice } from './utils/authAccess.js';
import ErrorBoundary from './components/ui/ErrorBoundary.jsx';
import SalesLandingPage from './components/public/SalesLandingPage.jsx';
import LeadDashboard from './components/public/LeadDashboard.jsx';

const SST_APP_URL = import.meta.env.VITE_SST_APP_URL || 'https://sst.amengenhariaseg.com.br';

const App = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [partnerRef, setPartnerRef] = useState(null);

  useEffect(() => {
    const slug = extractPartnerReferralFromPath(window.location.pathname);
    setPartnerRef(slug);

    resumeBackofficeSession().then((existingSession) => {
      if (existingSession && existingSession.role === 'lead') {
        setSession(existingSession);
      }
      setLoading(false);
    });
  }, []);

  const handleLogin = useCallback((newSession) => {
    if (newSession && newSession.role === 'lead') {
      setSession(newSession);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await signOutBackoffice();
    setSession(null);
  }, []);

  const handleNavigateToMainApp = useCallback((path) => {
    const url = `${SST_APP_URL}${path || ''}`;
    window.location.href = url;
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px', height: '40px', border: '3px solid #333',
            borderTopColor: '#d4af37', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem'
          }} />
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Carregando...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (session) {
    return (
      <ErrorBoundary>
        <LeadDashboard
          session={session}
          onLogout={handleLogout}
          onNavigateToMainApp={handleNavigateToMainApp}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <SalesLandingPage
        onLogin={handleLogin}
        partnerRefOverride={partnerRef}
        onNavigateToMainApp={handleNavigateToMainApp}
      />
    </ErrorBoundary>
  );
};

export default App;
