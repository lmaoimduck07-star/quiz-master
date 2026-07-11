import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { storage } from '../utils/storage';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { GraduationCap, ArrowLeft, Mail, Lock, User, UserPlus, AlertCircle, Loader2 } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const { completeLogin, registerWithGoogle } = useAuth();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim() || !username.trim() || !email.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ tất cả các trường!');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp!');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu phải chứa ít nhất 6 ký tự!');
      return;
    }

    try {
      const users = await storage.loadUsers();
      const isDuplicateUsername = users.some(u => u.username.toLowerCase() === username.trim().toLowerCase());
      const isDuplicateEmail = users.some(u => (u.email && u.email.toLowerCase() === email.trim().toLowerCase()) || u.username.toLowerCase() === email.trim().toLowerCase());

      if (isDuplicateUsername) { setError('Tên đăng nhập đã tồn tại trong hệ thống!'); return; }
      if (isDuplicateEmail) { setError('Email đã được đăng ký cho tài khoản khác!'); return; }

      const newUser = {
        id: 'U_' + Date.now(),
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
        roles: ['Student'],
        status: 'Active'
      };

      await storage.saveUsers([...users, newUser]);
      storage.addAuditLog({
        user: newUser.username,
        role: 'Student',
        category: 'System',
        action: `Đăng ký tài khoản học sinh thành công (Email: ${newUser.email})`,
        severity: 'Info'
      });

      completeLogin(newUser, 'Student');
      navigate('/client/dashboard');
    } catch (err) {
      setError(err.message || 'Đăng ký thất bại!');
    }
  };

  // Đăng ký bằng Google thật — mở Firebase popup
  const handleGoogleRegister = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const result = await registerWithGoogle();
      // result.isNew = true nếu vừa tạo mới, false nếu đã có tài khoản
      if (result.requiresRoleSelection) {
        // Tài khoản đã có và có nhiều role — xử lý ở Login
        navigate('/login');
      } else {
        navigate('/client/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Đăng ký Google thất bại!');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-200">
      <Card className="w-full max-w-lg shadow-2xl border-none rounded-3xl overflow-hidden bg-white dark:bg-slate-900">
        <CardHeader className="text-center pb-2 pt-8 relative">
          <button 
            type="button"
            onClick={() => navigate('/login')}
            className="absolute left-6 top-8 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Quay lại đăng nhập"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          
          <div className="flex justify-center mb-3">
            <div className="bg-primary/10 dark:bg-blue-900/20 p-3 rounded-2xl text-primary dark:text-blue-400">
              <UserPlus className="h-10 w-10" />
            </div>
          </div>
          <CardTitle className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Tạo tài khoản mới</CardTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Đăng ký tài khoản ôn luyện trắc nghiệm</p>
        </CardHeader>

        <form onSubmit={handleRegister}>
          <CardContent className="pt-4 px-8 space-y-4">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-semibold flex items-center gap-2 animate-in fade-in duration-200">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Google signup — Firebase popup thật */}
            <Button 
              type="button"
              variant="outline" 
              className="w-full h-12 border-slate-200 dark:border-slate-800 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl flex items-center justify-center gap-2.5 bg-transparent disabled:opacity-60"
              onClick={handleGoogleRegister}
              disabled={googleLoading}
              id="google-register-btn"
            >
              {googleLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {googleLoading ? 'Đang mở Google...' : 'Đăng ký nhanh bằng Google'}
            </Button>

            <div className="flex items-center gap-3 py-2">
              <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1" />
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">hoặc điền thông tin</span>
              <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" /> Họ và tên
                </label>
                <Input 
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-11 rounded-xl border-slate-200 dark:border-slate-800 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" /> Email
                </label>
                <Input 
                  type="email"
                  placeholder="example@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl border-slate-200 dark:border-slate-800 font-semibold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                Tên đăng nhập
              </label>
              <Input 
                type="text"
                placeholder="Ví dụ: hs_nguyenvana"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11 rounded-xl border-slate-200 dark:border-slate-800 font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" /> Mật khẩu
                </label>
                <Input 
                  type="password"
                  placeholder="Tối thiểu 6 ký tự"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-xl border-slate-200 dark:border-slate-800 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" /> Nhập lại mật khẩu
                </label>
                <Input 
                  type="password"
                  placeholder="Xác nhận mật khẩu"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11 rounded-xl border-slate-200 dark:border-slate-800 font-semibold"
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="px-8 pb-8 pt-4 flex flex-col gap-4">
            <Button type="submit" className="w-full h-12 rounded-xl font-bold text-base shadow-md">
              Hoàn tất đăng ký
            </Button>
            <div className="text-center">
              <button 
                type="button"
                onClick={() => navigate('/login')}
                className="text-xs font-bold text-primary dark:text-blue-400 hover:underline"
              >
                Đã có tài khoản? Đăng nhập ngay
              </button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
