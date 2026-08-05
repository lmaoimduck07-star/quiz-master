import React from 'react';
import { Monitor } from 'lucide-react';

/**
 * TabletStandby — Màn hình thông báo cho Tablet.
 * Tất cả các trang trong thư mục tablet/ sẽ import component này.
 * Thông báo người dùng rằng tính năng đang được phát triển.
 */
export default function TabletStandby() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-8 text-center">
      {/* Decorative glow background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      {/* Icon */}
      <div className="relative mb-6 flex items-center justify-center w-24 h-24 rounded-3xl bg-slate-800/80 border border-slate-700/60 shadow-xl">
        <Monitor className="w-11 h-11 text-indigo-400" strokeWidth={1.5} />
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-3xl border-2 border-indigo-500/30 animate-ping" />
      </div>

      {/* Title */}
      <h1 className="relative text-2xl font-bold text-white mb-3 leading-snug">
        Đang Phát Triển
      </h1>

      {/* Subtitle */}
      <p className="relative text-base text-slate-400 max-w-xs leading-relaxed mb-6">
        Giao diện dành cho{' '}
        <span className="text-indigo-400 font-semibold">Máy tính bảng (Tablet)</span>{' '}
        hiện đang được phát triển.
      </p>

      {/* Call to action */}
      <div className="relative flex flex-col sm:flex-row gap-3 items-center">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 text-sm font-medium">
          <Monitor className="w-4 h-4" />
          Sử dụng Desktop/Laptop
        </div>
        <div className="text-slate-500 text-sm">hoặc</div>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700/60 border border-slate-600/40 text-slate-300 text-sm font-medium">
          📱 Sử dụng Điện thoại
        </div>
      </div>

      {/* Version hint */}
      <p className="relative mt-10 text-xs text-slate-600">
        Quiz Master — Phiên bản Tablet sẽ sớm ra mắt
      </p>
    </div>
  );
}
