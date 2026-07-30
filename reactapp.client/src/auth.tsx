import { createContext, useContext, useState, ReactNode } from 'react';

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

type AuthState = {
  isAuthenticated: boolean;
  user: User | null;
};

const readStoredAuth = (): AuthState => {
  if (localStorage.getItem('isAuthenticated') !== 'true') {
    return { isAuthenticated: false, user: null };
  }

  try {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      return { isAuthenticated: false, user: null };
    }

    return {
      isAuthenticated: true,
      user: JSON.parse(storedUser) as User,
    };
  } catch {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('user');
    return { isAuthenticated: false, user: null };
  }
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>(readStoredAuth);

  const login = (userData?: Partial<User>) => {
    const defaultUser: User = {
      id: '1',
      username: 'jakub.filipek',
      email: 'jakub.filipek@gmail.com',
      ...userData,
    };
    setAuthState({ isAuthenticated: true, user: defaultUser });
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('user', JSON.stringify(defaultUser));
  };

  const logout = () => {
    setAuthState({ isAuthenticated: false, user: null });
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('user');
  };

  const updateUser = (updates: Partial<User>) => {
    if (!authState.user) return;
    const updatedUser = { ...authState.user, ...updates };
    setAuthState((current) => ({ ...current, user: updatedUser }));
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  return (
      <AuthContext.Provider value={{
        isAuthenticated: authState.isAuthenticated,
        user: authState.user,
        login,
        logout,
        updateUser,
      }}>
        {children}
      </AuthContext.Provider>
  );
};
