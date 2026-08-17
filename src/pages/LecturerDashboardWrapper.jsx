import { useState, useEffect } from 'react';
import LecturerDashboard from './LecturerDashboard';
import { Monitor, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';

function DesktopOnly() {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-slate-950 dark:via-slate-900 dark:to-amber-950/20 flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-6">

        {/* Theme toggle góc trên */}
        <div className="flex justify-end -mb-4">
          <button
            onClick={toggleTheme}
            className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            title={theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng'}
          >
            {theme === 'light'
              ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" /></svg>
              : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="5" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
            }
          </button>
        </div>

        {/* Icon */}
        <div className="relative mx-auto w-24 h-24">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl shadow-amber-500/30 mx-auto">
            <Monitor className="h-12 w-12 text-white" />
          </div>
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 opacity-20 blur-xl -z-10" />
        </div>

        {/* Text */}
        <div className="space-y-3">
          <h1 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">
            Cần dùng Máy tính
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
            Phân hệ <span className="font-bold text-amber-600 dark:text-amber-400">Giảng viên</span> hiện chỉ hỗ trợ trên{' '}
            <span className="font-bold text-slate-700 dark:text-slate-200">Máy tính / Laptop</span> để đảm bảo
            trải nghiệm soạn thảo đề thi và giám sát thi tốt nhất.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Vui lòng đăng nhập lại trên thiết bị có màn hình lớn hơn.
          </p>
        </div>

        {/* Decorative device hint */}
        <div className="flex items-center justify-center gap-4 py-4">
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-slate-400 dark:text-slate-500 font-bold">
            Desktop / Laptop chỉ
          </div>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="w-full py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-600 text-slate-600 dark:text-slate-300 font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 group"
        >
          <LogOut className="h-4 w-4 group-hover:rotate-12 transition-transform" />
          Đăng xuất
        </button>
      </div>
    </div>
  );
}

export default function LecturerDashboardWrapper() {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  if (!isDesktop) return <DesktopOnly />;
  return <LecturerDashboard />;
}
