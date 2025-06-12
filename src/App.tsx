import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { useAuthStore } from './store/authStore';

// Lazy load pages
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


function App() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <React.Suspense fallback={<div>Loading...</div>}>
        <Login />
      </React.Suspense>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <Dashboard />
            </React.Suspense>
          } />
          <Route path="users" element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <Users />
            </React.Suspense>
          } />
          <Route path="clients" element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <Clients />
            </React.Suspense>
          } />
          <Route path="templates" element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <Templates />
            </React.Suspense>
          } />
          <Route path="import" element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <Import />
            </React.Suspense>
          } />
          <Route path="mapping" element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <Mapping />
            </React.Suspense>
          } />
          <Route path="integrations" element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <Integrations />
            </React.Suspense>
          } />
          <Route path="integrations/quickbooks" element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <QuickBooks />
            </React.Suspense>
          } />
          <Route path="integrations/sage" element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <SageIntacct />
            </React.Suspense>
          } />
          <Route path="settings" element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <Settings />
            </React.Suspense>
          } />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;