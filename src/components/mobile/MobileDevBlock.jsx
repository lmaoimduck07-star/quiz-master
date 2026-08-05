import React from 'react';
import { Smartphone, Monitor } from 'lucide-react';

/**
 * MobileDevBlock — Màn hình thông báo "Đang phát triển" cho Mobile.
 * Dùng cho các tính năng chưa hỗ trợ trên điện thoại (VD: Coding Workspace).
 */
export default function MobileDevBlock({ feature = 'Tính năng này' }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-8 text-center">
      {/* Decorative background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-56 h-56 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-48 h-48 bg-blue-500/8 rounded-full blur-3xl" />
      </div>

      {/* Icon */}
      <div className="relative mb-6 flex items-center justify-center w-24 h-24 rounded-3xl
                      bg-slate-800/80 border border-indigo-500/30 shadow-xl">
        <Smartphone className="w-10 h-10 text-indigo-400" strokeWidth={1.5} />
        <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
          <span className="text-white text-xs font-bold">!</span>
        </span>
      </div>

      {/* Title */}
      <h1 className="relative text-xl font-bold text-white mb-3 leading-snug">
        Đang Phát Triển
      </h1>

      {/* Message */}
      <p className="relative text-sm text-slate-400 max-w-xs leading-relaxed mb-8">
        <span className="text-indigo-300 font-medium">{feature}</span>{' '}
        trên điện thoại đang được phát triển. Vui lòng sử dụng máy tính để có trải nghiệm tốt nhất.
      </p>

      {/* Desktop CTA */}
      <div className="relative flex items-center gap-2.5 px-5 py-3 rounded-xl
                      bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 text-sm font-medium">
        <Monitor className="w-4 h-4" />
        Sử dụng Desktop/Laptop để tiếp tục
      </div>

      <p className="relative mt-8 text-xs text-slate-600">
        Quiz Master — Phiên bản Mobile đang phát triển
      </p>
    </div>
  );
}
