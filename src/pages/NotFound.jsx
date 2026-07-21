import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Compass, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="relative mb-6">
        <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full blur-2xl opacity-40 animate-pulse" />
        <div className="relative w-24 h-24 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-center shadow-2xl mx-auto text-blue-400">
          <Compass className="w-12 h-12 animate-spin-slow" />
        </div>
      </div>

      <div className="inline-block px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider mb-3">
        Lỗi 404 - Đường dẫn không tồn tại
      </div>

      <h1 className="text-3xl font-black text-white mb-2">Trang bạn tìm kiếm không khả thi</h1>
      <p className="text-slate-400 text-sm max-w-md mb-8 leading-relaxed">
        Đường dẫn URL có thể đã bị gõ sai, thay đổi hoặc không tồn tại trên hệ thống. Vui lòng quay về trang chính để tiếp tục.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={() => navigate(-1)}
          variant="outline"
          className="border-slate-800 text-slate-300 hover:bg-slate-900 rounded-xl px-5 py-2.5 font-bold text-sm inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại
        </Button>

        <Button
          onClick={() => navigate('/')}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-2.5 font-bold text-sm shadow-lg shadow-blue-500/20 inline-flex items-center gap-2"
        >
          <Home className="w-4 h-4" /> Quay về Trang chủ
        </Button>
      </div>
    </div>
  );
}
