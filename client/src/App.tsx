import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

// Components & Views
import Sidebar from './components/Sidebar';
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import POSTerminal from './views/POSTerminal';
import Rooms from './views/Rooms';
import Menu from './views/Menu';
import Bills from './views/Bills';
import Messages from './views/Messages';
import Settings from './views/Settings';
import Inventory from './views/Inventory';
import KDS from './views/KDS';
import Guests from './views/Guests';
import SuperAdmin from './views/SuperAdmin';
import FloorPlan from './views/FloorPlan';
import Procurement from './views/Procurement';
import Reports from './views/Reports';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-bg-deep">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        <p className="text-text-secondary">Initializing System...</p>
      </div>
    </div>
  );
  
  if (!user) return <Navigate to="/login" />;
  
  return <>{children}</>;
};

const App: React.FC = () => {
  React.useEffect(() => {
    const savedTheme = localStorage.getItem('app_theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }, []);

  return (
    <Router>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/*" element={
              <ProtectedRoute>
                <div className="app-container">
                  <Sidebar />
                  <main className="main-content">
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/pos" element={<POSTerminal />} />
                      <Route path="/rooms" element={<Rooms />} />
                      <Route path="/menu" element={<Menu />} />
                      <Route path="/inventory" element={<Inventory />} />
                      <Route path="/kds" element={<KDS />} />
                      <Route path="/guests" element={<Guests />} />
                      <Route path="/bills" element={<Bills />} />
                      <Route path="/messages" element={<Messages />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/super-admin" element={<SuperAdmin />} />
                      <Route path="/floor-plan" element={<FloorPlan />} />
                      <Route path="/procurement" element={<Procurement />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                  </main>
                </div>
              </ProtectedRoute>
            } />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
};

export default App;
