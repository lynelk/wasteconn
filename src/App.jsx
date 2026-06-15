import { Suspense, useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ThemeProvider from '@/lib/ThemeProvider';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from '@/components/Layout';
import RoleGuard from '@/components/RoleGuard';
import { authenticatedRoutes, adminRoutes, fieldOperationsRoutes, publicRoutes } from '@/routes';
import ErrorBoundary from '@/lib/ErrorBoundary';

const Loader = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="w-9 h-9 border-4 border-secondary border-t-primary rounded-full animate-spin"></div>
      <p className="text-sm text-muted-foreground font-medium">Loading NLSWMS...</p>
    </div>
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  useEffect(() => {
    if (authError?.type === 'auth_required') {
      navigateToLogin();
    }
  }, [authError, navigateToLogin]);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <Loader />;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    if (authError.type === 'auth_required') {
      return null;
    }
  }

  const standalonePaths = ['/field-app', '/driver-app'];
  const layoutRoutes = [...authenticatedRoutes, ...adminRoutes, ...fieldOperationsRoutes.filter((route) => !standalonePaths.includes(route.path))];
  const standaloneFieldRoutes = fieldOperationsRoutes.filter((route) => standalonePaths.includes(route.path));

  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route element={<Layout />}>
          {layoutRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={<RoleGuard path={route.path}><route.component /></RoleGuard>} />
          ))}
        </Route>
        {publicRoutes.map((route) => (
          <Route key={route.path} path={route.path} element={<route.component />} />
        ))}
        {standaloneFieldRoutes.map((route) => (
          <Route key={route.path} path={route.path} element={<RoleGuard path={route.path}><route.component /></RoleGuard>} />
        ))}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ErrorBoundary>
              <AuthenticatedApp />
            </ErrorBoundary>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
