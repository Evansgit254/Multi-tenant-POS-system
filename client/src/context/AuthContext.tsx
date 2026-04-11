import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'hotel_admin' | 'cashier';
  tenantId: string | null;
}

interface Tenant {
  id: string;
  name: string;
  currency: string;
  taxRate: number;
  logoUrl?: string;
  receiptFooter?: string;
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  login: (token: string, user: User, tenant?: Tenant) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedTenant = localStorage.getItem('tenant');
    const token = localStorage.getItem('token');

    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      if (storedTenant) setTenant(JSON.parse(storedTenant));
    }
    setLoading(false);
  }, []);

  const login = (token: string, user: User, tenant?: Tenant) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    if (tenant) localStorage.setItem('tenant', JSON.stringify(tenant));
    
    setUser(user);
    if (tenant) setTenant(tenant);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant');
    setUser(null);
    setTenant(null);
  };

  return (
    <AuthContext.Provider value={{ user, tenant, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
