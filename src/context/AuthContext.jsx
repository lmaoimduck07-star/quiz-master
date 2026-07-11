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

  const [activeRole, setActiveRole] = useState(() => {
    return localStorage.getItem('qm_active_role') || null;
  });

  // Flag: đang trong quá trình login/register — ngăn onAuthStateChanged can thiệp
  const isAuthInProgress = useRef(false);

  // Lắng nghe Firebase auth state — chỉ để xử lý session hết hạn khi reload trang
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // Không can thiệp khi đang login/register
      if (isAuthInProgress.current) return;

      // Firebase session hết hạn (user bị sign out từ bên ngoài hoặc token expire)
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

  // Đăng nhập bằng username/password
  const login = async (username, password) => {
    const users = await storage.loadUsers();
    const user = users.find(u => {
      const matchUsername = u.username && typeof u.username === 'string' && u.username.toLowerCase() === username.trim().toLowerCase();
      const matchEmail = u.email && typeof u.email === 'string' && u.email.toLowerCase() === username.trim().toLowerCase();
      const matchPassword = u.password === password;
      return (matchUsername || matchEmail) && matchPassword;
    });

    if (!user) throw new Error('Sai tên đăng nhập hoặc mật khẩu!');
    if (user.status === 'Locked') throw new Error('Tài khoản của bạn đã bị khóa, vui lòng liên hệ với Admin để được hỗ trợ');

    if (user.roles && user.roles.length > 1) {
      return { requiresRoleSelection: true, user };
    }
    const role = user.roles ? user.roles[0] : 'Student';
    completeLogin(user, role);
    return { requiresRoleSelection: false, role };
  };

  const completeLogin = (user, role) => {
    setCurrentUser(user);
    setActiveRole(role);
    localStorage.setItem('qm_current_user', JSON.stringify(user));
    localStorage.setItem('qm_active_role', role);
    storage.addAuditLog({
      user: user.username,
      role,
      category: 'System',
      action: `Đăng nhập thành công với vai trò ${role}`,
      severity: 'Info'
    });
  };

  const logout = async () => {
    if (currentUser) {
      storage.addAuditLog({
        user: currentUser.username,
        role: activeRole,
        category: 'System',
        action: 'Đăng xuất khỏi hệ thống',
        severity: 'Info'
      });
    }
    if (localStorage.getItem('qm_google_session') === 'true') {
      try { await signOut(auth); } catch (_) {}
      localStorage.removeItem('qm_google_session');
    }
    setCurrentUser(null);
    setActiveRole(null);
    localStorage.removeItem('qm_current_user');
    localStorage.removeItem('qm_active_role');
  };

  // Đăng nhập Google thật — email phải đã có trong Firestore
  const loginWithGoogleReal = async () => {
    isAuthInProgress.current = true; // Khóa onAuthStateChanged
    try {
      let firebaseUser;
      try {
        const result = await signInWithPopup(auth, googleProvider);
        firebaseUser = result.user;
      } catch (err) {
        if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
          throw new Error('Đã hủy đăng nhập Google.');
        }
        throw new Error('Đăng nhập Google thất bại: ' + (err.message || 'Lỗi không xác định'));
      }

      const googleEmail = firebaseUser.email;
      const users = await storage.loadUsers();
      const user = users.find(u => {
        const matchEmail = u.email && typeof u.email === 'string' && u.email.toLowerCase() === googleEmail.toLowerCase();
        const matchUsername = u.username && typeof u.username === 'string' && u.username.toLowerCase() === googleEmail.toLowerCase();
        return matchEmail || matchUsername;
      });

      if (!user) {
        // Sign out khỏi Firebase nhưng KHÔNG để onAuthStateChanged xóa state app
        await signOut(auth).catch(() => {});
        throw new Error(`Email ${googleEmail} chưa được đăng ký trong hệ thống! Vui lòng đăng ký tài khoản trước hoặc liên hệ Admin.`);
      }

      if (user.status === 'Locked') {
        await signOut(auth).catch(() => {});
        throw new Error('Tài khoản của bạn đã bị khóa, vui lòng liên hệ với Admin để được hỗ trợ');
      }

      localStorage.setItem('qm_google_session', 'true');

      if (user.roles && user.roles.length > 1) {
        return { requiresRoleSelection: true, user };
      }
      const role = user.roles ? user.roles[0] : 'Student';
      completeLogin(user, role);
      return { requiresRoleSelection: false, role };

    } finally {
      // Luôn mở khóa sau khi xong
      isAuthInProgress.current = false;
    }
  };

  // Đăng ký Google — tự tạo tài khoản mới nếu chưa có
  const registerWithGoogle = async () => {
    isAuthInProgress.current = true; // Khóa onAuthStateChanged
    try {
      let firebaseUser;
      try {
        const result = await signInWithPopup(auth, googleProvider);
        firebaseUser = result.user;
      } catch (err) {
        if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
          throw new Error('Đã hủy đăng ký bằng Google.');
        }
        throw new Error('Đăng ký Google thất bại: ' + (err.message || 'Lỗi không xác định'));
      }

      const googleEmail = firebaseUser.email;
      const googleName = firebaseUser.displayName || googleEmail.split('@')[0];
      const users = await storage.loadUsers();

      // Email đã có → đăng nhập luôn
      const existingUser = users.find(u => {
        const matchEmail = u.email && u.email.toLowerCase() === googleEmail.toLowerCase();
        const matchUsername = u.username && u.username.toLowerCase() === googleEmail.toLowerCase();
        return matchEmail || matchUsername;
      });

      if (existingUser) {
        if (existingUser.status === 'Locked') {
          await signOut(auth).catch(() => {});
          throw new Error('Tài khoản của bạn đã bị khóa, vui lòng liên hệ Admin.');
        }
        localStorage.setItem('qm_google_session', 'true');
        if (existingUser.roles && existingUser.roles.length > 1) {
          return { requiresRoleSelection: true, user: existingUser, isNew: false };
        }
        const role = existingUser.roles ? existingUser.roles[0] : 'Student';
        completeLogin(existingUser, role);
        return { requiresRoleSelection: false, role, isNew: false };
      }

      // Tạo tài khoản mới
      const base = 'gg_' + googleEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      let finalUsername = base;
      let counter = 1;
      while (users.some(u => u.username && u.username.toLowerCase() === finalUsername.toLowerCase())) {
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
      };

      await storage.saveUsers([...users, newUser]);
      storage.addAuditLog({
        user: newUser.username,
        role: 'Student',
        category: 'System',
        action: `Đăng ký tài khoản qua Google thành công (Email: ${googleEmail})`,
        severity: 'Info'
      });

      localStorage.setItem('qm_google_session', 'true');
      completeLogin(newUser, 'Student');
      return { requiresRoleSelection: false, role: 'Student', isNew: true };

    } finally {
      isAuthInProgress.current = false;
    }
  };

  return (
    <AuthContext.Provider value={{
      currentUser, activeRole,
      login, loginWithGoogleReal, registerWithGoogle,
      completeLogin, logout, setActiveRole
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
