'use client';

import React, { useState, useEffect } from 'react';
import LandingPage from './components/landingpage';
import Login from './loginsignup/login';
import Signup from './loginsignup/signup';
import Dashboard from './components/dashboard';
import About from './components/about';
import Contact from './components/contact';
import PrivacyPolicy from './components/PrivacyPolicy';
import Terms from './components/terms';
import CookiePolicy from './components/cookiepolicy';
import Status from './components/Status';

export default function Page() {
  const [currentPage, setCurrentPage] = useState('landing');
  const [user, setUser] = useState(null);
  const [scrollTarget, setScrollTarget] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for token on mount to auto-login and handle redirects
  useEffect(() => {
    const checkAuth = () => {
      try {
        const token = localStorage.getItem('crossposting_token');
        const params = new URLSearchParams(window.location.search);
        const hasOAuthParams = params.has('connect') || params.has('status');

        if (token) {
          // If user has a token, they should be in the dashboard
          setCurrentPage('dashboard');

          // Don't clean OAuth params here - let the Connect component handle them
          if (hasOAuthParams) {
            console.log('OAuth callback received, showing dashboard');
          }
        } else if (hasOAuthParams) {
          // OAuth callback but no token - redirect to login
          setCurrentPage('login');
        }

        // Mark loading as complete
        setIsLoading(false);
      } catch (error) {
        console.error('Auth check error:', error);
        setIsLoading(false);
      }
    };

    // Small delay to ensure localStorage is available
    setTimeout(checkAuth, 100);
  }, []);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event) => {
      const page = event.state?.page || 'landing';

      // Check if trying to access dashboard without authentication
      if (page === 'dashboard') {
        const token = localStorage.getItem('crossposting_token');
        if (!token) {
          // No token, redirect to login instead
          setCurrentPage('login');
          window.history.replaceState({ page: 'login' }, '', '/');
          return;
        }
      }

      setCurrentPage(page);
    };

    window.addEventListener('popstate', handlePopState);

    // Set initial state if not already set
    if (!window.history.state) {
      window.history.replaceState({ page: currentPage }, '', '/');
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Reset scroll on page change
  useEffect(() => {
    // Immediate scroll reset
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // Retry after render to ensure it sticks
    const timer = setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }, 50);

    return () => clearTimeout(timer);
  }, [currentPage]);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    navigateToPage('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('crossposting_token');
    // Use replaceState instead of pushState to prevent going back to dashboard
    setCurrentPage('landing');
    window.history.replaceState({ page: 'landing' }, '', '/');
  };

  // Helper function to navigate and update history
  const navigateToPage = (page) => {
    setCurrentPage(page);
    window.history.pushState({ page }, '', '/');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'landing':
        return (
          <LandingPage
            onLoginClick={() => navigateToPage('login')}
            onSignupClick={() => navigateToPage('signup')}
            onAboutClick={() => navigateToPage('about')}
            onContactClick={() => navigateToPage('contact')}
            onPrivacyClick={() => navigateToPage('privacy')}
            onTermsClick={() => navigateToPage('terms')}
            onCookieClick={() => navigateToPage('cookie')}
            scrollToSection={scrollTarget}
            onScrollComplete={() => setScrollTarget(null)}
            onLogin={(email) => {
              // Pass email to login if needed
              navigateToPage('login');
            }}
          />
        );
      case 'login':
        return (
          <Login
            onLoginSuccess={handleLoginSuccess}
            onSignupClick={() => navigateToPage('signup')}
          />
        );
      case 'signup':
        return (
          <Signup
            onSignupSuccess={() => navigateToPage('login')}
            onLoginClick={() => navigateToPage('login')}
            onHomeClick={() => navigateToPage('landing')}
          />
        );
      case 'dashboard':
        return (
          <Dashboard onLogout={handleLogout} />
        );
      case 'about':
        return (
          <About
            onLoginClick={() => navigateToPage('login')}
            onSignupClick={() => navigateToPage('signup')}
            onHomeClick={() => navigateToPage('landing')}
            onAboutClick={() => navigateToPage('about')}
            onContactClick={() => navigateToPage('contact')}
            onBenefitsClick={() => {
              setScrollTarget('benefits');
              navigateToPage('landing');
            }}
          />
        );
      case 'contact':
        return (
          <Contact
            onLoginClick={() => navigateToPage('login')}
            onSignupClick={() => navigateToPage('signup')}
            onHomeClick={() => navigateToPage('landing')}
            onAboutClick={() => navigateToPage('about')}
            onContactClick={() => navigateToPage('contact')}
            onBenefitsClick={() => {
              setScrollTarget('benefits');
              navigateToPage('landing');
            }}
          />
        );
      case 'privacy':
        return (
          <PrivacyPolicy
            onLoginClick={() => navigateToPage('login')}
            onSignupClick={() => navigateToPage('signup')}
            onHomeClick={() => navigateToPage('landing')}
            onAboutClick={() => navigateToPage('about')}
            onContactClick={() => navigateToPage('contact')}
            onBenefitsClick={() => {
              setScrollTarget('benefits');
              navigateToPage('landing');
            }}
          />
        );
      case 'terms':
        return (
          <Terms
            onLoginClick={() => navigateToPage('login')}
            onSignupClick={() => navigateToPage('signup')}
            onHomeClick={() => navigateToPage('landing')}
            onAboutClick={() => navigateToPage('about')}
            onContactClick={() => navigateToPage('contact')}
            onBenefitsClick={() => {
              setScrollTarget('benefits');
              navigateToPage('landing');
            }}
          />
        );
        return (
          <CookiePolicy
            onLoginClick={() => navigateToPage('login')}
            onSignupClick={() => navigateToPage('signup')}
            onHomeClick={() => navigateToPage('landing')}
            onAboutClick={() => navigateToPage('about')}
            onContactClick={() => navigateToPage('contact')}
            onBenefitsClick={() => {
              setScrollTarget('benefits');
              navigateToPage('landing');
            }}
          />
        );
      case 'status':
        return (
          <div className="pt-20">
            <Status />
          </div>
        );
      default:
        return <LandingPage />;
    }
  };

  return (
    <main className="min-h-screen bg-white text-black">
      {isLoading ? <LandingSkeleton /> : renderPage()}
    </main>
  );
}

function LandingSkeleton() {
  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif" }}>
      {/* Navbar Skeleton */}
      <div style={{ height: '72px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px' }}>
        <div style={{ width: '140px', height: '32px', background: '#f3f4f6', borderRadius: '4px' }}></div>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          <div style={{ width: '60px', height: '16px', background: '#f3f4f6', borderRadius: '4px' }}></div>
          <div style={{ width: '60px', height: '16px', background: '#f3f4f6', borderRadius: '4px' }}></div>
          <div style={{ width: '100px', height: '40px', background: '#f3f4f6', borderRadius: '100px' }}></div>
        </div>
      </div>

      {/* Hero Skeleton (Centered) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '120px', gap: '32px', position: 'relative' }}>
        {/* Title Lines */}
        <div style={{ width: '600px', height: '80px', background: '#f3f4f6', borderRadius: '16px' }}></div>
        <div style={{ width: '400px', height: '80px', background: '#f3f4f6', borderRadius: '16px' }}></div>

        {/* Subtitle */}
        <div style={{ width: '300px', height: '24px', background: '#f3f4f6', borderRadius: '8px', marginTop: '16px' }}></div>

        {/* Input Bar */}
        <div style={{ width: '520px', height: '64px', background: '#f3f4f6', borderRadius: '100px', marginTop: '32px' }}></div>

        {/* Floating Icons Placeholders - Faint */}
        <div style={{ position: 'absolute', top: '40%', left: '10%', width: '60px', height: '60px', borderRadius: '20px', background: '#f3f4f6', opacity: 0.5 }}></div>
        <div style={{ position: 'absolute', top: '35%', right: '12%', width: '64px', height: '64px', borderRadius: '20px', background: '#f3f4f6', opacity: 0.5 }}></div>
      </div>
    </div>
  );
}
