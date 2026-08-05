import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Menu, X, Home, BookOpen,
  Code2, LogOut, Moon, Sun, User, ChevronRight, Wrench
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { label: 'Trang Chủ', icon: Home, path: '/client/dashboard', roles: ['Student', 'Admin'] },
  { label: 'Lập Trình', icon: Code2, path: '/coding/dashboard', roles: ['Student', 'Admin'], devOnly: true },
];

/**
 * MobileNavbar — Thanh điều hướng cho thiết bị Mobile.
 * Gồm Header cố định + Off-canvas Drawer trượt ra khi bấm Hamburger.
 * Drawer che ~50% màn hình, phần còn lại là overlay tối để đóng bằng cách bấm ra ngoài.
 */
export default function MobileNavbar({ title = 'Quiz Master' }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [devToast, setDevToast] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const drawerRef = useRef(null);

  const showDevToast = () => {
    setDevToast(true);
    setTimeout(() => setDevToast(false), 2500);
  };

  // Đóng drawer khi đổi route
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Đóng drawer khi bấm Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Khoá scroll khi drawer mở
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const handleLogout = async () => {
    setDrawerOpen(false);
    await logout();
    navigate('/login');
  };

  const handleNavItem = (item) => {
    if (item.devOnly) {
      showDevToast();
      setDrawerOpen(false);
      return;
    }
    navigate(item.path);
    setDrawerOpen(false);
  };

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* ─── Fixed Header Bar ─── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4
                         bg-white/90 dark:bg-slate-900/90 backdrop-blur-md
                         border-b border-slate-200/80 dark:border-slate-700/60
                         shadow-sm">
        {/* Hamburger Button */}
        <button
          id="mobile-hamburger-btn"
          onClick={() => setDrawerOpen(true)}
          aria-label="Mở menu"
          className="flex items-center justify-center w-10 h-10 rounded-xl
                     text-slate-600 dark:text-slate-300
                     hover:bg-slate-100 dark:hover:bg-slate-800
                     active:scale-95 transition-all duration-150"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Page Title */}
        <span className="text-base font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
          {title}
        </span>

        {/* Dark Mode Toggle (quick access on header) */}
        <button
          id="mobile-theme-toggle-header"
          onClick={toggleTheme}
          aria-label="Đổi giao diện"
          className="flex items-center justify-center w-10 h-10 rounded-xl
                     text-slate-600 dark:text-slate-300
                     hover:bg-slate-100 dark:hover:bg-slate-800
                     active:scale-95 transition-all duration-150"
        >
          {theme === 'dark'
            ? <Sun className="w-4.5 h-4.5 text-amber-400" />
            : <Moon className="w-4.5 h-4.5 text-indigo-500" />
          }
        </button>
      </header>

      {/* Dev Toast Notification */}
      {devToast && (
        <div className="fixed top-20 left-4 right-4 z-[60] bg-amber-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-fade-in">
          <Wrench className="w-5 h-5" />
          <span className="text-sm font-medium">Tính năng đang trong quá trình phát triển!</span>
        </div>
      )}

      {/* ─── Off-canvas Drawer Overlay ─── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Menu điều hướng"
        >
          {/* Dimmed overlay — bấm để đóng */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer Panel — chiếm ~50% màn hình từ trái */}
          <div
            ref={drawerRef}
            className="relative flex flex-col w-1/2 max-w-xs min-h-full
                       bg-white dark:bg-slate-900
                       border-r border-slate-200 dark:border-slate-700/80
                       shadow-2xl animate-fade-up"
            style={{ animation: 'slideInLeft 0.25s ease-out both' }}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-4 py-4
                            border-b border-slate-200 dark:border-slate-700/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-bold text-slate-800 dark:text-white">
                  Quiz Master
                </span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Đóng menu"
                className="w-8 h-8 rounded-lg flex items-center justify-center
                           text-slate-400 hover:text-slate-600
                           dark:text-slate-500 dark:hover:text-slate-300
                           hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* User Info */}
            {user && (
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50
                                  flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {user.displayName || user.email?.split('@')[0]}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {user.email}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Items */}
            <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavItem(item)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left
                                transition-all duration-150 active:scale-95
                                ${
                                  item.devOnly
                                    ? 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    : active
                                      ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold'
                                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${active && !item.devOnly ? 'text-indigo-600 dark:text-indigo-400' : ''}`} />
                    <span className="text-sm flex-1">{item.label}</span>
                    {item.devOnly ? (
                      <span className="text-[9px] font-black uppercase tracking-wider text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full">
                        Đang PT
                      </span>
                    ) : active ? (
                      <ChevronRight className="w-3.5 h-3.5 text-indigo-500" />
                    ) : null}
                  </button>
                );
              })}
            </nav>

            {/* Footer Actions */}
            <div className="px-3 py-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
              {/* Dark Mode Toggle */}
              <button
                id="mobile-theme-toggle-drawer"
                onClick={toggleTheme}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl
                           text-slate-600 dark:text-slate-300
                           hover:bg-slate-100 dark:hover:bg-slate-800
                           transition-all duration-150 active:scale-95"
              >
                {theme === 'dark'
                  ? <Sun className="w-5 h-5 text-amber-400" />
                  : <Moon className="w-5 h-5 text-indigo-500" />
                }
                <span className="text-sm">
                  {theme === 'dark' ? 'Chế độ Sáng' : 'Chế độ Tối'}
                </span>
              </button>

              {/* Logout */}
              <button
                id="mobile-logout-btn"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl
                           text-red-500 dark:text-red-400
                           hover:bg-red-50 dark:hover:bg-red-900/20
                           transition-all duration-150 active:scale-95"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium">Đăng Xuất</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS keyframe cho slide-in animation */}
      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
