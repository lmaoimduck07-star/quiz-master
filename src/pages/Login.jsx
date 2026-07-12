import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { GraduationCap, Shield, User, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { login, loginWithGoogleReal, completeLogin, redirectLoading, redirectError, clearRedirectError, currentUser, activeRole } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);

  // Hiển thị lỗi redirect từ Google (nếu có)
  useEffect(() => {
    if (redirectError) {
      setError(redirectError);
      clearRedirectError();
    }
  }, [redirectError, clearRedirectError]);

  // Auto-redirect nếu đã đăng nhập (ví dụ sau Google redirect)
  useEffect(() => {
    if (currentUser && activeRole && !redirectLoading) {
      if (activeRole === 'Admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/client/dashboard', { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, activeRole, redirectLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Vui lòng nhập tên đăng nhập và mật khẩu!');
      return;
    }

    try {
      const result = await login(username, password);
      if (result.requiresRoleSelection) {
        setPendingUser(result.user);
        setShowRoleModal(true);
      } else {
        if (result.role === 'Admin') {
          navigate('/admin/dashboard');
        } else {
          navigate('/client/dashboard');
        }
      }
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại!');
    }
  };

  const handleSelectRole = (role) => {
    if (pendingUser) {
      completeLogin(pendingUser, role);
      setShowRoleModal(false);
      setPendingUser(null);
      if (role === 'Admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/client/dashboard');
      }
    }
  };

  // Đăng nhập bằng Google — dùng redirect (ổn định hơn popup trên production)
  // Đăng nhập bằng Google
  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const result = await loginWithGoogleReal();
      if (result.requiresRoleSelection) {
        setPendingUser(result.user);
        setShowRoleModal(true);
      } else {
        if (result.role === 'Admin') {
          navigate('/admin/dashboard');
        } else {
          navigate('/client/dashboard');
        }
      }
    } catch (err) {
      setError(err.message || 'Đăng nhập Google thất bại!');
    } finally {
      setGoogleLoading(false);
    }
  };

  // Hiển thị loading screen khi đang xử lý redirect result
  if (redirectLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-slate-600 dark:text-slate-300 font-semibold">Đang xác thực Google...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-200">
      <Card className="w-full max-w-md shadow-2xl border-none rounded-3xl overflow-hidden bg-white dark:bg-slate-900">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 dark:bg-blue-900/20 p-4 rounded-2xl text-primary dark:text-blue-400">
              <GraduationCap className="h-12 w-12" />
            </div>
          </div>
          <CardTitle className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Quiz Master</CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Hệ thống khảo thí mô phỏng</p>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="pt-6 px-8 space-y-5">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-semibold space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span>{error}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-red-200/50 text-[10px] font-mono text-left max-h-32 overflow-y-auto whitespace-pre-wrap opacity-80">
                  <strong>Auth Debug Logs:</strong>
                  {JSON.parse(localStorage.getItem('qm_auth_logs') || '[]').map((log, i) => (
                    <div key={i} className="leading-tight mt-1">{log}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Google login — gọi Firebase popup thật */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 border-slate-200 dark:border-slate-800 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl flex items-center justify-center gap-2.5 bg-transparent disabled:opacity-60"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              id="google-login-btn"
            >
              {googleLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              {googleLoading ? 'Đang mở Google...' : 'Đăng nhập bằng Google'}
            </Button>

            <div className="flex items-center gap-3 py-1">
              <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1" />
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">hoặc điền thông tin</span>
              <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" /> Tên đăng nhập / Email
              </label>
              <Input
                type="text"
                placeholder="Ví dụ: admin@edu.vn hoặc hs_tran"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12 rounded-xl border-slate-200 dark:border-slate-800 font-medium"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" /> Mật khẩu
              </label>
              <Input
                type="password"
                placeholder="Nhập mật khẩu của bạn"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl border-slate-200 dark:border-slate-800 font-medium"
              />
            </div>
          </CardContent>

          <CardFooter className="px-8 pb-8 pt-4 flex flex-col gap-4">
            <Button type="submit" className="w-full h-12 rounded-xl font-bold text-base shadow-md">
              Đăng nhập
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="text-xs font-bold text-primary dark:text-blue-400 hover:underline"
              >
                Chưa có tài khoản? Đăng ký ngay
              </button>
            </div>
          </CardFooter>
        </form>
      </Card>

      {/* Modal chọn vai trò */}
      {showRoleModal && pendingUser && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-sm border-none shadow-2xl rounded-3xl overflow-hidden bg-white dark:bg-slate-900">
            <CardHeader className="pt-6 pb-2 text-center">
              <CardTitle className="text-xl font-bold text-slate-800 dark:text-white">Chọn vai trò truy cập</CardTitle>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Tài khoản của bạn có nhiều quyền truy cập</p>
            </CardHeader>
            <CardContent className="space-y-3 px-6 pb-6 pt-4">
              <Button
                variant="outline"
                className="w-full justify-start py-6 border-slate-200 dark:border-slate-800 hover:bg-primary/5 dark:hover:bg-blue-950/20 hover:border-primary group transition-all rounded-xl bg-transparent"
                onClick={() => handleSelectRole('Admin')}
              >
                <Shield className="mr-3 h-5 w-5 text-purple-500 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <div className="font-bold text-slate-800 dark:text-slate-200">Vào quản trị (Admin)</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">Quản lý môn học, đề thi &amp; tài khoản</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start py-6 border-slate-200 dark:border-slate-800 hover:bg-primary/5 dark:hover:bg-blue-950/20 hover:border-primary group transition-all rounded-xl bg-transparent"
                onClick={() => handleSelectRole('Student')}
              >
                <User className="mr-3 h-5 w-5 text-blue-500 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <div className="font-bold text-slate-800 dark:text-slate-200">Vào học tập (Học sinh)</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">Luyện tập các đề thi &amp; thi mô phỏng</div>
                </div>
              </Button>
            </CardContent>
            <CardFooter className="bg-slate-50 dark:bg-slate-950/40 justify-center py-4 border-t border-slate-100 dark:border-slate-800/80">
              <Button variant="ghost" className="w-full rounded-xl font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 bg-transparent" onClick={() => {
                setShowRoleModal(false);
                setPendingUser(null);
              }}>
                Hủy bỏ
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
