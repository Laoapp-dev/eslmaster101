import { Routes, Route } from 'react-router-dom';
import { createContext, useContext, useEffect, Suspense, lazy } from 'react';
import { useVocabulary } from '@/hooks/useVocabulary';
import { useToast } from '@/hooks/useToast';
import { useAuth, AuthProvider } from '@/hooks/useAuth';
import { Sidebar } from '@/components/Sidebar';
import { MobileNav } from '@/components/MobileNav';
import { ToastContainer } from '@/components/ToastContainer';

// ── Lazy-loaded pages ────────────────────────────────────────────────────────
// Every page below is its own separate JS chunk, loaded on demand instead of
// all being bundled into one giant file that every visitor has to download
// (and that has to succeed loading perfectly) before anything can render.
// This is what keeps first open fast even though the app ships a 9,000+
// word vocabulary bundle.
const Dashboard      = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })));
const WordList       = lazy(() => import('@/pages/WordList').then(m => ({ default: m.WordList })));
const Favorites      = lazy(() => import('@/pages/Favorites').then(m => ({ default: m.Favorites })));
const LevelJourney   = lazy(() => import('@/pages/LevelJourney').then(m => ({ default: m.LevelJourney })));
const Categories     = lazy(() => import('@/pages/Categories').then(m => ({ default: m.Categories })));
const StudyLayout    = lazy(() => import('@/pages/StudyLayout').then(m => ({ default: m.StudyLayout })));
const Flashcards     = lazy(() => import('@/pages/Flashcards').then(m => ({ default: m.Flashcards })));
const Quiz           = lazy(() => import('@/pages/Quiz').then(m => ({ default: m.Quiz })));
const Matching       = lazy(() => import('@/pages/Matching').then(m => ({ default: m.Matching })));
const Spelling       = lazy(() => import('@/pages/Spelling').then(m => ({ default: m.Spelling })));
const Settings       = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })));
const Profile        = lazy(() => import('@/pages/Profile').then(m => ({ default: m.Profile })));
const AdminPanel     = lazy(() => import('@/pages/AdminPanel').then(m => ({ default: m.AdminPanel })));
const UserDashboard  = lazy(() => import('@/pages/UserDashboard').then(m => ({ default: m.UserDashboard })));
const PreTest        = lazy(() => import('@/pages/PreTest').then(m => ({ default: m.PreTest })));
const Practice       = lazy(() => import('@/pages/Practice').then(m => ({ default: m.Practice })));
const AuthPage       = lazy(() => import('@/pages/AuthPage').then(m => ({ default: m.AuthPage })));

function PageLoading() {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 border-[3px] border-[#1A1A2E]/20 border-t-[#1A1A2E] rounded-full animate-spin" />
    </div>
  );
}

function FullScreenLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 border-[3px] border-[#1A1A2E]/20 border-t-[#1A1A2E] rounded-full animate-spin" />
    </div>
  );
}

interface AppContextType {
  vocabulary: ReturnType<typeof useVocabulary>;
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => string;
}

export const AppContext = createContext<AppContextType | null>(null);
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

// Mounted only once a user is confirmed signed in AND their cloud data
// blob has already been fetched into cloudStorage (useAuth awaits that
// before it ever sets currentUser) — so useVocabulary's synchronous
// `useState(() => loadFromStorage(...))` initializers see real data
// immediately instead of racing an in-flight network request.
function AppShell({ currentUser }: { currentUser: NonNullable<ReturnType<typeof useAuth>['currentUser']> }) {
  const vocabulary = useVocabulary();
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    if (vocabulary.storageWarning) {
      addToast(vocabulary.storageWarning, 'error');
      vocabulary.clearStorageWarning();
    }
  }, [vocabulary.storageWarning]); // eslint-disable-line

  return (
    <AppContext.Provider value={{ vocabulary, addToast }}>
      <div className="flex h-screen w-screen overflow-hidden bg-background dot-grid-bg">
        <div className="sidebar-desktop hidden md:block">
          <Sidebar profile={vocabulary.profile} currentStreak={vocabulary.profile.currentStreak} />
        </div>
        <main className="flex-1 overflow-y-auto main-content">
          <div className="mx-auto max-w-[960px] px-4 py-6 md:px-8 md:py-8 main-content-mobile-pad md:pb-8">
            <Suspense fallback={<PageLoading />}>
              <Routes>
                <Route path="/"              element={<Dashboard />} />
                <Route path="/words"         element={<WordList />} />
                <Route path="/favorites"     element={<Favorites />} />
                <Route path="/pretest"       element={<PreTest />} />
                <Route path="/study"         element={<StudyLayout />}>
                  <Route path="level"        element={<LevelJourney />} />
                  <Route path="categories"   element={<Categories />} />
                  <Route path="flashcards"   element={<Flashcards />} />
                  <Route path="quiz"         element={<Quiz />} />
                  <Route path="matching"     element={<Matching />} />
                  <Route path="spelling"     element={<Spelling />} />
                </Route>
                <Route path="/settings"      element={<Settings />} />
                <Route path="/profile"       element={<Profile />} />
                <Route path="/my-account"    element={<UserDashboard />} />
                <Route path="/practice"      element={<Practice />} />
                {currentUser.role === 'admin' && (
                  <Route path="/admin" element={<AdminPanel />} />
                )}
              </Routes>
            </Suspense>
          </div>
        </main>
        <MobileNav />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    </AppContext.Provider>
  );
}

function AppInner() {
  const { currentUser, isAuthenticated, isLoading } = useAuth();

  // ── Where data lives now ─────────────────────────────────────────────────
  // Accounts and every learner's own words/progress/sessions/settings sync
  // through Cloudflare D1 (see /functions/api) instead of this browser's
  // localStorage, so the same account works identically on any device.
  // The 9,000+ word base curriculum is still bundled straight into the app
  // (public/data/vocabulary.json) since it's shared, read-only content.

  if (isLoading) return <FullScreenLoading />;

  if (!isAuthenticated || !currentUser) {
    return (
      <Suspense fallback={<FullScreenLoading />}>
        <AuthPage />
      </Suspense>
    );
  }

  return <AppShell currentUser={currentUser} />;
}

export default function App() {
  return <AuthProvider><AppInner /></AuthProvider>;
}
