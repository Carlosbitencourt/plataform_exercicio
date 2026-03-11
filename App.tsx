import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Users from './views/admin/Users';
import CheckIns from './views/admin/CheckIns';
import Distributions from './views/admin/Distributions';
import TimeSlots from './views/admin/TimeSlots';
import Ranking from './views/admin/Ranking';
import Login from './views/admin/Login';
import CheckInPage from './views/public/CheckInPage';
import Signup from './views/auth/Signup';
import Dashboard from './views/admin/Dashboard';
import Profile from './views/admin/Profile';
import ExternalSignup from './views/public/ExternalSignup';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ADMIN_EMAILS } from './constants';
import AppShell from './components/AppShell';
import AthleteLocations from './views/public/AthleteLocations';
import AthleteProfile from './views/public/AthleteProfile';
import AthleteRanking from './views/public/AthleteRanking';
import Withdrawals from './views/admin/Withdrawals';
import Integrations from './views/admin/Integrations';
import Settings from './views/admin/Settings';
import UnderAnalysis from './views/public/UnderAnalysis';
import DepositRequests from './views/admin/DepositRequests';

// Componente para proteger rotas administrativas
const ProtectedAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-lime-400 font-black tracking-widest uppercase">Carregando Sistema...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/admin/login" replace />;
  }

  // Verificar se o usuário é admin
  const isAdmin = ADMIN_EMAILS.includes(currentUser.email || '');

  if (!isAdmin) {
    return <Navigate to="/checkin" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <Layout>
          <Routes>
            {/* Auth Routes */}
            <Route path="/admin/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Admin Routes */}
            <Route path="/admin" element={
              <ProtectedAdminRoute>
                <Dashboard />
              </ProtectedAdminRoute>
            } />

            <Route path="/admin/perfil" element={
              <ProtectedAdminRoute>
                <Profile />
              </ProtectedAdminRoute>
            } />

            <Route path="/admin/usuarios" element={
              <ProtectedAdminRoute>
                <Users />
              </ProtectedAdminRoute>
            } />

            <Route path="/admin/horarios" element={
              <ProtectedAdminRoute>
                <TimeSlots />
              </ProtectedAdminRoute>
            } />

            <Route path="/admin/checkins" element={
              <ProtectedAdminRoute>
                <CheckIns />
              </ProtectedAdminRoute>
            } />

            <Route path="/admin/ranking" element={
              <ProtectedAdminRoute>
                <Ranking />
              </ProtectedAdminRoute>
            } />

            <Route path="/admin/distribuicoes" element={
              <ProtectedAdminRoute>
                <Distributions />
              </ProtectedAdminRoute>
            } />

            <Route path="/admin/integracoes" element={
              <ProtectedAdminRoute>
                <Integrations />
              </ProtectedAdminRoute>
            } />

            <Route path="/admin/configuracoes" element={
              <ProtectedAdminRoute>
                <Settings />
              </ProtectedAdminRoute>
            } />

            <Route path="/admin/resgates" element={
              <ProtectedAdminRoute>
                <Withdrawals />
              </ProtectedAdminRoute>
            } />

            <Route path="/admin/depositos" element={
              <ProtectedAdminRoute>
                <DepositRequests />
              </ProtectedAdminRoute>
            } />

            {/* Athlete App Shell Routes */}
            <Route path="/checkin" element={<AppShell><CheckInPage /></AppShell>} />
            <Route path="/ranking" element={<AppShell><AthleteRanking /></AppShell>} />
            <Route path="/locais" element={<AppShell><AthleteLocations /></AppShell>} />
            <Route path="/perfil/atleta" element={<AppShell><AthleteProfile /></AppShell>} />

            <Route path="/inscrever" element={<ExternalSignup />} />
            <Route path="/external-signup" element={<ExternalSignup />} />
            <Route path="/analise" element={<UnderAnalysis />} />

            {/* Default Redirects */}
            <Route path="/" element={<Navigate to="/checkin" replace />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </Router>
  );
};

export default App;
