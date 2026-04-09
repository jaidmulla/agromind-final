import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authApi } from '../services/api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  location?: string;
  farm_size?: number;
  latitude?: number;
  longitude?: number;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load stored auth on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('agromind_token');
    const storedUser = localStorage.getItem('agromind_user');
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        // Verify token is still valid
        authApi.getMe().then(u => {
          setUser(u);
          localStorage.setItem('agromind_user', JSON.stringify(u));
        }).catch(() => {
          localStorage.removeItem('agromind_token');
          localStorage.removeItem('agromind_user');
          setToken(null);
          setUser(null);
        });
      } catch {
        localStorage.removeItem('agromind_token');
        localStorage.removeItem('agromind_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    localStorage.setItem('agromind_token', data.token);
    localStorage.setItem('agromind_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }, []);

  const register = useCallback(async (body: RegisterData) => {
    const data = await authApi.register(body);
    localStorage.setItem('agromind_token', data.token);
    localStorage.setItem('agromind_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('agromind_token');
    localStorage.removeItem('agromind_user');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  }, []);

  const updateUser = useCallback((u: User) => {
    setUser(u);
    localStorage.setItem('agromind_user', JSON.stringify(u));
  }, []);

  return (
    <AuthContext.Provider value={{
      user, token, isLoading,
      isAuthenticated: !!token && !!user,
      login, register, logout, updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
