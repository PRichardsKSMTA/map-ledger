import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import Layout from './components/Layout';
import { useAuthStore } from './store/authStore';
import { msalInstance } from './utils/msal';
import { env } from './utils/env';
import type { GroupTokenClaims } from './types';

const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Users = React.lazy(() => import('./pages/Users'));
const Clients = React.lazy(() => import('./pages/Clients'));
const Templates = React.lazy(() => import('./pages/Templates'));
const Import = React.lazy(() => import('./pages/Import'));
const Mapping = React.lazy(() => import('./pages/Mapping'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Integrations = React.lazy(() => import('./pages/Integrations'));
const QuickBooks = React.lazy(() => import('./pages/integrations/QuickBooks'));
const SageIntacct = React.lazy(() => import('./pages/integrations/SageIntacct'));

function ProtectedRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route
          index
          element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <Dashboard />
            </React.Suspense>
          }
        />
        <Route
          path="users"
          element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <Users />
            </React.Suspense>
          }
        />
        <Route
          path="clients"
          element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <Clients />
            </React.Suspense>
          }
        />
        <Route
          path="templates"
          element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <Templates />
            </React.Suspense>
          }
        />
        <Route
          path="import"
          element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <Import />
            </React.Suspense>
          }
        />
        <Route
          path="gl/mapping/:uploadId"
          element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <Mapping />
            </React.Suspense>
          }
        />
        <Route
          path="allocations"
          element={<Navigate to="/gl/mapping/demo?stage=allocation" replace />}
        />
        <Route
          path="integrations"
          element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <Integrations />
            </React.Suspense>
          }
        />
        <Route
          path="integrations/quickbooks"
          element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <QuickBooks />
            </React.Suspense>
          }
        />
        <Route
          path="integrations/sage"
          element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <SageIntacct />
            </React.Suspense>
          }
        />
        <Route
          path="settings"
          element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <Settings />
            </React.Suspense>
          }
        />
      </Route>
    </Routes>
  );
}

function App() {
  const { isAuthenticated } = useAuthStore();
  const [checkingAuth, setCheckingAuth] = React.useState(true);

  React.useEffect(() => {
    msalInstance
      .handleRedirectPromise()
      .then((res) => {
        const account = res?.account ?? msalInstance.getAllAccounts()[0];
        if (account) {
          msalInstance.setActiveAccount(account);
          const claims =
            (res?.idTokenClaims as GroupTokenClaims) ??
            (account.idTokenClaims as GroupTokenClaims);
          const groups = claims?.groups ?? [];
          const isAdmin = groups.includes(env.AAD_ADMIN_GROUP_ID);
          const domain = account.username.split('@')[1] || '';
          const isEmployee = env.AAD_EMPLOYEE_DOMAINS.includes(domain);
          const isGuest = !isEmployee;
          useAuthStore.getState().setAccount(account, {
            isAdmin,
            isEmployee,
            isGuest,
          });
        }
      })
      .finally(() => setCheckingAuth(false));
  }, []);

  if (checkingAuth) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <React.Suspense fallback={<div>Loading...</div>}>
                <Login />
              </React.Suspense>
            )
          }
        />
        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <ProtectedRoutes />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
