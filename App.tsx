import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Users from './views/admin/Users';
import QRCodeManager from './views/admin/QRCodeManager';
import CheckIns from './views/admin/CheckIns';
import Distributions from './views/admin/Distributions';
import TimeSlots from './views/admin/TimeSlots';
import Ranking from './views/admin/Ranking';
import Login from './views/admin/Login';
import CheckInPage from './views/public/CheckInPage';
import Signup from './views/auth/Signup';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Componente para proteger rotas administrativas
const ProtectedAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-lime-400 font-black tracking-widest uppercase">Carregando Sistema...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/admin/login" replace />;
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
            <Route path="/admin/usuarios" element={
              <ProtectedAdminRoute>
                <Users />
              </ProtectedAdminRoute>
            } />

            <Route path="/admin/qrcode" element={
              <ProtectedAdminRoute>
                <QRCodeManager />
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

            {/* Public Routes */}
            <Route path="/checkin" element={<CheckInPage />} />

            {/* Default Redirects */}
            <Route path="/admin" element={<Navigate to="/admin/usuarios" replace />} />
            <Route path="/" element={<Navigate to="/checkin" replace />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </Router>
  );
};

export default App;
