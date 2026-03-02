import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate, useParams } from 'react-router-dom';
import { AdminDashboard } from './components/AdminDashboard';
import { UserDashboard } from './components/UserDashboard';
import { UniversityCompare } from './components/UniversityCompare';
import { Header } from './components/Header';
import { Login } from './components/Login';
import { ChatWidget } from './components/ChatWidget';
import { CurrencyConverter } from './components/CurrencyConverter';
import { SocialFab } from './components/SocialFab';
import { LegalPages, LegalPageType } from './components/LegalPages';
import { LandingPage } from './components/LandingPage';
import { getAllFeedback, syncUsers } from './services/db';
import { getSettings, DEFAULT_SETTINGS } from './services/settings';
import { FeedbackEntry, User, AppSettings } from './types';

// Color Palettes for Dynamic Theming
const COLOR_PALETTES: Record<string, Record<number, string>> = {
  indigo: { 50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81', 950: '#1e1b4b' },
  blue: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a', 950: '#172554' },
  emerald: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b', 950: '#022c22' },
  rose: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519' },
  orange: { 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12', 950: '#431407' },
  violet: { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065' },
};

// Helper Component for WhatsApp Icon
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

// Protected Route Component
const ProtectedRoute = ({ children, role, user }: { children?: React.ReactNode, role?: 'admin' | 'student', user: User | null }) => {
  if (!user) return <Navigate to="/auth" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [showCurrencyConverter, setShowCurrencyConverter] = useState(false);
  const [heroNeetScore, setHeroNeetScore] = useState('');

  const [isFabOpen, setIsFabOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });

  // Apply Theme & Dynamic Colors
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);

    if (settings?.themeConfig?.primaryColor) {
      const palette = COLOR_PALETTES[settings.themeConfig.primaryColor];
      if (palette) {
        Object.entries(palette).forEach(([shade, value]) => {
          root.style.setProperty(`--c-${shade}`, value);
        });
      }
    }
  }, [theme, settings?.themeConfig?.primaryColor]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [data, settingsData] = await Promise.all([
        getAllFeedback(),
        getSettings(),
        syncUsers()
      ]);
      setFeedbackList(data);
      setSettings(settingsData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('mr_active_user');
    const savedToken = localStorage.getItem('mr_auth_token');
    if (savedUser && savedToken) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Failed to parse user", e);
        localStorage.removeItem('mr_active_user');
        localStorage.removeItem('mr_auth_token');
      }
    } else {
      // Clear both if one is missing
      localStorage.removeItem('mr_active_user');
      localStorage.removeItem('mr_auth_token');
    }
    refreshData();
  }, []);

  const handleLoginSuccess = (user: User) => {
    localStorage.setItem('mr_active_user', JSON.stringify(user));
    setCurrentUser(user);
    if (user.role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/user');
    }
    refreshData();
  };

  const handleLogout = () => {
    localStorage.removeItem('mr_active_user');
    localStorage.removeItem('mr_auth_token');
    setCurrentUser(null);
    navigate('/');
    refreshData();
  };

  const handleHeaderAction = () => {
    if (currentUser) {
      if (currentUser.role === 'admin') navigate('/admin');
      else navigate('/user');
    } else {
      navigate('/auth');
    }
  };

  const handleLogoClick = () => {
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEligibilityCheck = () => {
    if (!heroNeetScore) {
      alert("Please enter your NEET Score.");
      return;
    }
    localStorage.setItem('mr_neet_score', heroNeetScore);
    navigate('/auth');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const FAQ_DATA = [
    { q: "Is NEET qualification mandatory for MBBS in Russia?", a: "Yes, qualifying NEET is mandatory for Indian students to pursue MBBS abroad and appear for the NExT/FMGE exam in India." },
    { q: "What is the duration of the course?", a: "The course typically lasts 5.8 to 6 years, including a mandatory clinical rotation (internship) in Russia." },
    { q: "Is the degree valid in India?", a: "Yes, degrees from WHO and NMC-recognized Russian universities are valid in India. You must clear the NExT exam to practice." },
    { q: "What is the approximate cost?", a: "Tuition fees range from ₹18 Lakhs to ₹40 Lakhs for the entire 6-year course, depending on the university and city." },
    { q: "Is it safe for Indian students?", a: "Russia is generally safe for international students. Universities provide secure hostels with CCTV and warden supervision." },
    { q: "Can I work while studying?", a: "Students can work part-time, but it is recommended to focus on studies due to the rigorous medical curriculum." }
  ];

  const hideHeader = location.pathname.startsWith('/admin') || location.pathname.startsWith('/user') || location.pathname.startsWith('/legal');
  const isDashboardView = location.pathname.startsWith('/admin') || location.pathname.startsWith('/user');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 relative overflow-x-hidden">
      {!hideHeader && (
        <Header
          onToggleAdmin={handleHeaderAction}
          onLogoClick={handleLogoClick}
          onLogout={handleLogout}
          onNavigate={(view) => {
            if (view === 'compare') navigate('/compare');
            else navigate('/');
          }}
          onToggleCurrency={settings?.currencyConverter?.enabled ? () => setShowCurrencyConverter(!showCurrencyConverter) : undefined}
          isAdmin={currentUser?.role === 'admin'}
          isAuthenticated={!!currentUser}
          userName={currentUser?.name}
          userAvatar={currentUser?.avatar}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}

      <main className={isDashboardView ? "" : "max-w-7xl mx-auto px-4 py-8"}>
        <Routes>
          <Route path="/" element={
            <LandingPage
              settings={settings}
              heroNeetScore={heroNeetScore}
              setHeroNeetScore={setHeroNeetScore}
              handleEligibilityCheck={handleEligibilityCheck}
              handleSpecificNavigation={(v) => {
                if (v === 'compare') navigate('/compare');
              }}
              refreshData={refreshData}
              WhatsAppIcon={WhatsAppIcon}
              FAQ_DATA={FAQ_DATA}
            />
          } />

          <Route path="/auth" element={
            !currentUser ? (
              <Login
                onAuthSuccess={handleLoginSuccess}
                onCancel={() => navigate('/')}
                onShowLegal={(page) => navigate(`/legal/${page}`)}
              />
            ) : <Navigate to={currentUser.role === 'admin' ? '/admin' : '/user'} replace />
          } />

          <Route path="/compare" element={<UniversityCompare />} />

          <Route path="/legal/:page" element={
            <LegalPageWrapper navigate={navigate} />
          } />

          {/* Admin Dashboard - Protected */}
          <Route path="/admin" element={
            <ProtectedRoute role="admin" user={currentUser}>
              <AdminDashboard
                feedbackList={feedbackList}
                onRefresh={refreshData}
                onLogout={handleLogout}
                isLoading={isLoading}
                currentUser={currentUser!}
                theme={theme}
                toggleTheme={toggleTheme}
              />
            </ProtectedRoute>
          } />

          {/* User Dashboard - Protected */}
          <Route path="/user" element={
            <ProtectedRoute role="student" user={currentUser}>
              <UserDashboard
                user={currentUser!}
                onLogout={handleLogout}
                onInquirySubmitted={refreshData}
                onFabToggle={setIsFabOpen}
                theme={theme}
                toggleTheme={toggleTheme}
                onToggleCurrency={settings?.currencyConverter?.enabled ? () => setShowCurrencyConverter(!showCurrencyConverter) : undefined}
              />
            </ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {!hideHeader && location.pathname !== '/auth' && (
        <footer className="mt-20 bg-gradient-to-b from-slate-900 to-slate-950 text-white relative overflow-hidden transition-colors duration-300">
          {/* Gradient Accent Bar */}
          <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

          {/* Decorative Background Elements */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl" />
          </div>

          {/* Main Footer Content */}
          <div className="max-w-7xl mx-auto px-6 pt-16 pb-10 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-10">

              {/* Brand Column */}
              <div className="lg:col-span-1">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-lg shadow-indigo-500/30 rotate-3 border border-indigo-400/30">
                    MR
                  </div>
                  <span className="text-xl font-black tracking-tight">MedRussia</span>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  Your trusted partner for MBBS admissions in Russia. Expert counseling, university insights, and complete end-to-end support for aspiring doctors.
                </p>
                {/* Social Icons */}
                <div className="flex gap-2.5">
                  <a href="https://youtube.com/@amit_gurjar-w1" target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:bg-red-500 hover:border-red-400 hover:text-white hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300 hover:-translate-y-0.5"
                    aria-label="YouTube">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                  </a>
                  <a href="https://www.instagram.com/med_vlog716/" target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:bg-gradient-to-br hover:from-purple-500 hover:to-pink-500 hover:border-purple-400 hover:text-white hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300 hover:-translate-y-0.5"
                    aria-label="Instagram">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
                  </a>
                  <a href="https://wa.me/917375017401" target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:bg-emerald-500 hover:border-emerald-400 hover:text-white hover:shadow-lg hover:shadow-emerald-500/20 transition-all duration-300 hover:-translate-y-0.5"
                    aria-label="WhatsApp">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" /></svg>
                  </a>
                </div>
              </div>

              {/* Navigation Column */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-300 mb-5 flex items-center gap-2">
                  <span className="w-5 h-px bg-indigo-500" />Navigation
                </h4>
                <ul className="space-y-3">
                  <li><button onClick={() => navigate('/')} className="text-sm text-slate-400 hover:text-white hover:translate-x-1 transition-all duration-200 flex items-center gap-2 group"><span className="w-0 group-hover:w-2 h-px bg-indigo-400 transition-all duration-200" />Home</button></li>
                  <li><button onClick={() => navigate('/compare')} className="text-sm text-slate-400 hover:text-white hover:translate-x-1 transition-all duration-200 flex items-center gap-2 group"><span className="w-0 group-hover:w-2 h-px bg-indigo-400 transition-all duration-200" />Compare Universities</button></li>
                  <li><button onClick={() => navigate('/auth')} className="text-sm text-slate-400 hover:text-white hover:translate-x-1 transition-all duration-200 flex items-center gap-2 group"><span className="w-0 group-hover:w-2 h-px bg-indigo-400 transition-all duration-200" />Student Portal</button></li>
                  <li><a href="https://wa.me/917375017401" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-400 hover:text-white hover:translate-x-1 transition-all duration-200 flex items-center gap-2 group"><span className="w-0 group-hover:w-2 h-px bg-indigo-400 transition-all duration-200" />Contact Us</a></li>
                </ul>
              </div>

              {/* Resources Column */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-300 mb-5 flex items-center gap-2">
                  <span className="w-5 h-px bg-purple-500" />Resources
                </h4>
                <ul className="space-y-3">
                  <li><button onClick={() => navigate('/legal/privacy')} className="text-sm text-slate-400 hover:text-white hover:translate-x-1 transition-all duration-200 flex items-center gap-2 group"><span className="w-0 group-hover:w-2 h-px bg-purple-400 transition-all duration-200" />Privacy Policy</button></li>
                  <li><button onClick={() => navigate('/legal/terms')} className="text-sm text-slate-400 hover:text-white hover:translate-x-1 transition-all duration-200 flex items-center gap-2 group"><span className="w-0 group-hover:w-2 h-px bg-purple-400 transition-all duration-200" />Terms of Service</button></li>
                  <li><button onClick={() => navigate('/legal/disclaimer')} className="text-sm text-slate-400 hover:text-white hover:translate-x-1 transition-all duration-200 flex items-center gap-2 group"><span className="w-0 group-hover:w-2 h-px bg-purple-400 transition-all duration-200" />Disclaimer</button></li>
                </ul>
              </div>

              {/* Contact & Trust Column */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-300 mb-5 flex items-center gap-2">
                  <span className="w-5 h-px bg-pink-500" />Get In Touch
                </h4>
                <div className="space-y-4">
                  <a href="https://wa.me/917375017401" className="flex items-start gap-3 group" target="_blank" rel="noopener noreferrer">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5 group-hover:bg-emerald-500/20 transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">WhatsApp</p>
                      <p className="text-sm text-slate-300 group-hover:text-white transition-colors">+91 73750 17401</p>
                    </div>
                  </a>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0 mt-0.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Based in</p>
                      <p className="text-sm text-slate-300">India & Russia</p>
                    </div>
                  </div>
                </div>

                {/* Trust Badges */}
                <div className="mt-6 pt-5 border-t border-white/5">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3">Recognized By</p>
                  <div className="flex gap-2 flex-wrap">
                    {['NMC', 'WHO', 'FMGE'].map(badge => (
                      <span key={badge} className="px-2.5 py-1 text-[10px] font-bold bg-white/5 border border-white/10 rounded-md text-slate-400 tracking-wide">{badge}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-white/5 relative z-10">
            <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col md:flex-row justify-between items-center gap-3">
              <p className="text-xs text-slate-500 font-medium">
                © {new Date().getFullYear()} MedRussia. All rights reserved. Made with ❤️ for future doctors.
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-medium">Platform Active</span>
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* Floating WhatsApp FAB - Only on Public Pages */}
      {!isDashboardView && location.pathname === '/' && settings?.features?.whatsappFab && (
        <SocialFab onToggle={setIsFabOpen} />
      )}

      {/* Currency Converter Modal (Triggered by Header) */}
      {showCurrencyConverter && settings?.currencyConverter.enabled && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowCurrencyConverter(false)}
              className="absolute -top-3 -right-3 z-10 w-8 h-8 bg-white dark:bg-slate-700 text-slate-500 dark:text-white rounded-full flex items-center justify-center font-bold shadow-lg hover:scale-110 transition-transform"
            >
              ✕
            </button>
            <CurrencyConverter apiKey={settings.currencyConverter.apiKey} />
          </div>
        </div>
      )}

      {/* AI Chat Widget */}
      {settings?.features?.chatWidget && (
        <ChatWidget isLifted={isFabOpen} />
      )}
    </div>
  );
};

// Wrapper to handle params
const LegalPageWrapper = ({ navigate }: { navigate: any }) => {
  const { page } = useParams();
  return <LegalPages page={page as LegalPageType} onBack={() => navigate('/')} />;
}

export default App;