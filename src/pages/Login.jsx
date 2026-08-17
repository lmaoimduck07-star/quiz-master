import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthBackground from '../components/ui/AuthBackground';
import { GraduationCap, Shield, User, BookOpen, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { login, loginWithGoogleReal, completeLogin, redirectLoading, redirectError, clearRedirectError, currentUser, activeRole } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);

  useEffect(() => {
    try {
      const notice = sessionStorage.getItem('qm_auth_notice');
      if (notice) { setAuthNotice(notice); sessionStorage.removeItem('qm_auth_notice'); }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (redirectError) { setError(redirectError); clearRedirectError(); }
  }, [redirectError, clearRedirectError]);

  const getRedirectTarget = (role) => {
    try {
      const target = sessionStorage.getItem('qm_redirect_after_login');
      if (target) { sessionStorage.removeItem('qm_redirect_after_login'); return target; }
    } catch (e) {}
    if (role === 'Admin') return '/admin/dashboard';
    if (role === 'Lecturer') return '/lecturer/dashboard';
    return '/client/dashboard';
  };

  useEffect(() => {
    if (currentUser && activeRole && !redirectLoading) {
      navigate(getRedirectTarget(activeRole), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, activeRole, redirectLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) { setError('Vui lòng nhập tên đăng nhập và mật khẩu!'); return; }
    try {
      const result = await login(username, password);
      if (result.requiresRoleSelection) { setPendingUser(result.user); setShowRoleModal(true); }
      else { navigate(getRedirectTarget(result.role), { replace: true }); }
    } catch (err) { setError(err.message || 'Đăng nhập thất bại!'); }
  };

  const handleSelectRole = (role) => {
    if (pendingUser) {
      completeLogin(pendingUser, role);
      setShowRoleModal(false);
      setPendingUser(null);
      navigate(getRedirectTarget(role), { replace: true });
    }
  };

  // Đăng nhập bằng Google — dùng redirect (ổn định hơn popup trên production)
  // Đăng nhập bằng Google
  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const result = await loginWithGoogleReal();
      if (result.requiresRoleSelection) { setPendingUser(result.user); setShowRoleModal(true); }
      else { navigate(getRedirectTarget(result.role)); }
    } catch (err) { setError(err.message || 'Đăng nhập Google thất bại!'); }
    finally { setGoogleLoading(false); }
  };

  if (redirectLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
          <p className="text-slate-600 dark:text-slate-300 font-semibold">Đang xác thực Google...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <AuthBackground />
      <div className="w-full max-w-md animate-fade-up">
        <div className="rounded-3xl overflow-hidden shadow-2xl border border-white/60 dark:border-slate-700/50 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl">
          <div className="pt-10 pb-4 px-8 text-center">
            <div className="flex justify-center mb-5">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg animate-pulse-glow">
                  <GraduationCap className="h-10 w-10 text-white" />
                </div>
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 opacity-30 blur-lg -z-10" />
              </div>
            </div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Quiz Master</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Hệ thống khảo thí mô phỏng</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="px-8 pt-4 pb-0 space-y-4">
              {authNotice && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-700/50 rounded-2xl text-amber-700 dark:text-amber-300 text-sm font-medium animate-fade-up flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-amber-500 dark:text-amber-400" />
                  <div className="leading-relaxed">{authNotice}</div>
                </div>
              )}
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-700/50 rounded-2xl text-red-600 dark:text-red-300 text-sm font-semibold animate-shake flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <button type="button" onClick={handleGoogleLogin} disabled={googleLoading} id="google-login-btn"
                className="w-full h-12 border border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 rounded-xl flex items-center justify-center gap-3 bg-white dark:bg-slate-800/50 disabled:opacity-60 transition-all duration-200 hover:shadow-md">
                {googleLoading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : (
                  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                <span>{googleLoading ? 'Đang mở Google...' : 'Đăng nhập bằng Google'}</span>
              </button>
              <div className="flex items-center gap-3">
                <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1" />
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">hoặc điền thông tin</span>
                <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Tên đăng nhập / Email
                </label>
                <input type="text" placeholder="Nhập tên đăng nhập hoặc email" value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 px-4 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 dark:focus:border-blue-500 transition-all duration-200" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> Mật khẩu
                </label>
                <input type="password" placeholder="Nhập mật khẩu của bạn" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 px-4 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 dark:focus:border-blue-500 transition-all duration-200" />
              </div>
            </div>
            <div className="px-8 pt-5 pb-8 flex flex-col gap-4">
              <button type="submit"
                className="w-full h-12 rounded-xl font-bold text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-blue-500/30 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0">
                Đăng nhập
              </button>
              <div className="text-center">
                <button type="button" onClick={() => navigate('/register')}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline transition-colors">
                  Chưa có tài khoản? Đăng ký ngay
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {showRoleModal && pendingUser && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-up">
          <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-white/20 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl">
            <div className="pt-7 pb-3 px-7 text-center">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Chọn vai trò truy cập</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Tài khoản của bạn có {pendingUser.roles?.length || 1} quyền truy cập</p>
            </div>
            <div className="space-y-3 px-6 pb-5 pt-3">
              {/* Render linh hoạt dựa theo user.roles */}
              {(pendingUser.roles || ['Student']).map((role) => {
                const roleConfig = {
                  Admin: {
                    icon: <Shield className="h-5 w-5 text-purple-500 group-hover:scale-110 transition-transform" />,
                    bg: 'bg-purple-100 dark:bg-purple-900/30',
                    label: 'Vào quản trị (Admin)',
                    desc: 'Quản lý môn học, đề thi & tài khoản',
                  },
                  Lecturer: {
                    icon: <BookOpen className="h-5 w-5 text-amber-500 group-hover:scale-110 transition-transform" />,
                    bg: 'bg-amber-100 dark:bg-amber-900/30',
                    label: 'Vào giảng dạy (Giảng viên)',
                    desc: 'Soạn đề, giám sát thi & xem kết quả',
                  },
                  Student: {
                    icon: <User className="h-5 w-5 text-blue-500 group-hover:scale-110 transition-transform" />,
                    bg: 'bg-blue-100 dark:bg-blue-900/30',
                    label: 'Vào học tập (Học sinh)',
                    desc: 'Luyện tập các đề thi & thi mô phỏng',
                  },
                };
                const cfg = roleConfig[role] || roleConfig['Student'];
                return (
                  <button
                    key={role}
                    onClick={() => handleSelectRole(role)}
                    className="w-full py-4 px-5 border border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-300 dark:hover:border-blue-700 rounded-2xl flex items-center gap-4 group transition-all duration-200 bg-white dark:bg-slate-800/50"
                  >
                    <div className={`p-2 rounded-xl ${cfg.bg}`}>
                      {cfg.icon}
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{cfg.label}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">{cfg.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="bg-slate-50/80 dark:bg-slate-950/50 px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-center">
              <button onClick={() => { setShowRoleModal(false); setPendingUser(null); }}
                className="text-sm font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
