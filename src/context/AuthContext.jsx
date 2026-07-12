import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';
import { storage } from '../utils/storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const user = localStorage.getItem('qm_current_user');
    return user ? JSON.parse(user) : null;
  });
  const [activeRole, setActiveRole] = useState(() => localStorage.getItem('qm_active_role') || null);
  const [redirectError, setRedirectError] = useState(null);
  const isAuthInProgress = useRef(false);

  // Theo dõi Firebase session hết hạn
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (isAuthInProgress.current) return;
      if (!firebaseUser && localStorage.getItem('qm_google_session') === 'true') {
        setCurrentUser(null);
        setActiveRole(null);
        localStorage.removeItem('qm_current_user');
        localStorage.removeItem('qm_active_role');
        localStorage.removeItem('qm_google_session');
      }
    });
    return () => unsubscribe();
  }, []);

  // Đăng nhập username/password
  const login = async (username, password) => {
    const users = await storage.loadUsers();
    const user = users.find(u => {
      const matchUsername = u.username?.toLowerCase() === username.trim().toLowerCase();
      const matchEmail = u.email?.toLowerCase() === username.trim().toLowerCase();
      return (matchUsername || matchEmail) && u.password === password;
    });
    if (!user) throw new Error('Sai tên đăng nhập hoặc mật khẩu!');
    if (user.status === 'Locked') throw new Error('Tài khoản của bạn đã bị khóa, vui lòng liên hệ với Admin để được hỗ trợ');
    if (user.roles?.length > 1) return { requiresRoleSelection: true, user };
    const role = user.roles?.[0] || 'Student';
    completeLogin(user, role);
    return { requiresRoleSelection: false, role };
  };

  const completeLogin = (user, role) => {
    setCurrentUser(user);
    setActiveRole(role);
    localStorage.setItem('qm_current_user', JSON.stringify(user));
    localStorage.setItem('qm_active_role', role);
    storage.addAuditLog({ user: user.username, role, category: 'System', action: `Đăng nhập thành công với vai trò ${role}`, severity: 'Info' });
  };

  const logout = async () => {
    if (currentUser) {
      storage.addAuditLog({ user: currentUser.username, role: activeRole, category: 'System', action: 'Đăng xuất khỏi hệ thống', severity: 'Info' });
    }
    if (localStorage.getItem('qm_google_session') === 'true') {
      try { await signOut(auth); } catch (_) { }
      localStorage.removeItem('qm_google_session');
    }
    setCurrentUser(null);
    setActiveRole(null);
    localStorage.removeItem('qm_current_user');
    localStorage.removeItem('qm_active_role');
    localStorage.removeItem('qm_active_session');
    localStorage.removeItem('qm_expired_sessions');
  };

  // Google login (popup) — chỉ cho user đã tồn tại trong DB
  const loginWithGoogleReal = async () => {
    isAuthInProgress.current = true;
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const googleEmail = result.user.email;
      const users = await storage.loadUsers();
      const user = users.find(u =>
        (u.email && u.email.toLowerCase() === googleEmail.toLowerCase()) ||
        (u.username && u.username.toLowerCase() === googleEmail.toLowerCase())
      );
      if (!user) {
        await signOut(auth).catch(() => { });
        throw new Error(`Email ${googleEmail} chưa được đăng ký trong hệ thống! Vui lòng đăng ký tài khoản trước hoặc liên hệ Admin.`);
      }
      if (user.status === 'Locked') {
        await signOut(auth).catch(() => { });
        throw new Error('Tài khoản của bạn đã bị khóa, vui lòng liên hệ Admin.');
      }
      localStorage.setItem('qm_google_session', 'true');
      if (user.roles?.length > 1) {
        return { requiresRoleSelection: true, user };
      }
      const role = user.roles?.[0] || 'Student';
      completeLogin(user, role);
      return { requiresRoleSelection: false, user, role };
    } finally {
      isAuthInProgress.current = false;
    }
  };

  // Google register (popup) — tạo mới nếu chưa có
  const registerWithGoogle = async () => {
    isAuthInProgress.current = true;
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const googleEmail = result.user.email;
      const users = await storage.loadUsers();
      const existing = users.find(u =>
        (u.email && u.email.toLowerCase() === googleEmail.toLowerCase()) ||
        (u.username && u.username.toLowerCase() === googleEmail.toLowerCase())
      );
      if (existing) {
        if (existing.status === 'Locked') {
          await signOut(auth).catch(() => { });
          throw new Error('Tài khoản của bạn đã bị khóa, vui lòng liên hệ Admin.');
        }
        localStorage.setItem('qm_google_session', 'true');
        completeLogin(existing, existing.roles?.[0] || 'Student');
        return { isNew: false };
      }
      // Tạo mới
      const googleName = result.user.displayName || googleEmail.split('@')[0];
      const base = 'gg_' + googleEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      let finalUsername = base;
      let counter = 1;
      while (users.some(u => u.username?.toLowerCase() === finalUsername.toLowerCase())) {
        finalUsername = base + counter++;
      }
      const newUser = {
        id: 'U_' + Date.now(),
        fullName: googleName,
        username: finalUsername,
        email: googleEmail,
        password: '',
        roles: ['Student'],
        status: 'Active',
        authProvider: 'google',
        permissions: { codingAccess: false },
      };
      await storage.saveUsers([...users, newUser]);
      storage.addAuditLog({ user: newUser.username, role: 'Student', category: 'System', action: `Đăng ký qua Google (${googleEmail})`, severity: 'Info' });
      localStorage.setItem('qm_google_session', 'true');
      completeLogin(newUser, 'Student');
      return { isNew: true };
    } finally {
      isAuthInProgress.current = false;
    }
  };

  return (
    <AuthContext.Provider value={{
      currentUser, activeRole, redirectError,
      login, loginWithGoogleReal, registerWithGoogle,
      completeLogin, logout, setActiveRole,
      clearRedirectError: () => setRedirectError(null),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
