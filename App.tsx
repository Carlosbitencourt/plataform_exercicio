
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

// Componente para proteger rotas administrativas
const ProtectedAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = sessionStorage.getItem('isAdminAuthenticated') === 'true';
  
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          {/* Admin Routes */}
          <Route path="/admin/login" element={<Login />} />
          
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
    </Router>
  );
};

export default App;
