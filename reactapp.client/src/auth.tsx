import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type User = {
  id: string;
  username: string;
  email: string;
};

export type AuthContextType = {
  isAuthenticated: boolean;
  user: User | null;
  login: (userData?: Partial<User>) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true); // zmiana utorzacji startowej
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const storedAuth = localStorage.getItem('isAuthenticated');
    const storedUser = localStorage.getItem('user');

    if (storedAuth === 'true' && storedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(storedUser));
    } else {
      // TESTOWO dla GH Pages – auto login na starcie:
      login();
    }
  }, []);

  const login = (userData?: Partial<User>) => {
    const defaultUser: User = {
      id: '1',
      username: 'jakub.filipek',
      email: 'jakub.filipek@gmail.com',
      ...userData,
    };
    setIsAuthenticated(true);
    setUser(defaultUser);
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('user', JSON.stringify(defaultUser));
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('user');
  };

  const updateUser = (updates: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  return (
      <AuthContext.Provider value={{ isAuthenticated, user, login, logout, updateUser }}>
        {children}
      </AuthContext.Provider>
  );
};
