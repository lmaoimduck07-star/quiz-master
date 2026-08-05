import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Monitor, Home } from 'lucide-react';

/**
 * MobileAdminBlock — Màn hình chặn truy cập Admin từ Mobile.
 * Full-screen, không bị nội dung khác che khuất.
 */
export default function MobileAdminBlock() {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900
                    flex flex-col items-center justify-center p-8 text-center">
      {/* Decorative background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-56 h-56 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-56 h-56 bg-orange-500/8 rounded-full blur-3xl" />
      </div>

      {/* Icon */}
      <div className="relative mb-6 flex items-center justify-center w-24 h-24 rounded-3xl
                      bg-slate-800/80 border border-red-500/30 shadow-xl">
        <ShieldAlert className="w-11 h-11 text-red-400" strokeWidth={1.5} />
      </div>

      {/* Title */}
      <h1 className="relative text-xl font-bold text-white mb-3 leading-snug">
        Truy Cập Bị Hạn Chế
      </h1>

      {/* Message */}
      <p className="relative text-sm text-slate-400 max-w-xs leading-relaxed mb-8">
        Yêu cầu sử dụng thiết bị{' '}
        <span className="text-red-400 font-semibold">Desktop</span>{' '}
        để truy cập quyền Admin.
      </p>

      {/* Desktop hint */}
      <div className="relative flex items-center gap-2.5 px-5 py-3 rounded-xl
                      bg-slate-700/60 border border-slate-600/40 text-slate-300 text-sm font-medium mb-5">
        <Monitor className="w-4 h-4 text-slate-400" />
        Vui lòng sử dụng Máy tính để tiếp tục
      </div>

      {/* Back to client */}
      <button
        onClick={() => navigate('/client/dashboard')}
        className="relative flex items-center gap-2 px-6 py-3 rounded-xl
                   bg-indigo-600 hover:bg-indigo-700 active:scale-95
                   text-white text-sm font-bold transition-all duration-150 shadow-lg"
        style={{ minHeight: 48 }}
      >
        <Home className="w-4 h-4" />
        Quay về Trang học
      </button>

      <p className="relative mt-8 text-xs text-slate-600">
        Quiz Master Admin — Yêu cầu màn hình Desktop
      </p>
    </div>
  );
}
