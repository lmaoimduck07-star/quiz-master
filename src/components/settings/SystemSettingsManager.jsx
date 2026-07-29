import { useState, useEffect } from 'react';
import { Settings, Server, Key, Save, CheckCircle2, AlertCircle, RefreshCw, Cpu } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { storage } from '../../utils/storage';
import { pingPiston } from '../../utils/pistonApi';
import { hasGeminiApiKey } from '../../utils/gemini';

export default function SystemSettingsManager({ onAddLog }) {
  const [pistonUrl, setPistonUrl] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pistonStatus, setPistonStatus] = useState(null); // null | 'testing' | 'success' | 'failed'
  const [geminiStatus, setGeminiStatus] = useState(null); // null | 'testing' | 'success' | 'failed'
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const config = await storage.loadSystemSettings();
      setPistonUrl(config.pistonUrl || 'https://emkc.org/api/v2/piston/execute');
      setGeminiKey(config.geminiKey || '');
      setLoading(false);
    }
    load();
  }, []);

  const handleTestPiston = async () => {
    setPistonStatus('testing');
    try {
      if (pistonUrl.trim()) {
        localStorage.setItem('qm_piston_url', pistonUrl.trim());
      }
      const ok = await pingPiston();
      setPistonStatus(ok ? 'success' : 'failed');
    } catch {
      setPistonStatus('failed');
    }
  };

  const handleTestGemini = async () => {
    setGeminiStatus('testing');
    if (geminiKey.trim()) {
      localStorage.setItem('qm_gemini_api_key', geminiKey.trim());
    }
    setTimeout(() => {
      const ok = hasGeminiApiKey();
      setGeminiStatus(ok ? 'success' : 'failed');
    }, 500);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    const success = await storage.saveSystemSettings({
      pistonUrl: pistonUrl.trim(),
      geminiKey: geminiKey.trim(),
      updatedAt: new Date().toISOString(),
    });

    if (success) {
      setMessage('✅ Đã lưu cấu hình hệ thống thành công lên Firestore & LocalStorage!');
      if (onAddLog) {
        onAddLog('System', 'Cập nhật cấu hình Piston API / Gemini Key', 'Info');
      }
    } else {
      setMessage('❌ Lưu cấu hình thất bại! Kiểm tra kết nối mạng.');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 animate-pulse font-medium">
        Đang tải cấu hình hệ thống...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col items-center mb-10 relative">
        <div className="inline-block bg-primary/10 p-6 rounded-full text-primary mb-4">
          <Settings className="h-12 w-12" />
        </div>
        <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-2 text-center">CẤU HÌNH HỆ THỐNG</h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-center">Quản lý kết nối Piston Execution Server và Gemini AI API Key</p>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl font-bold text-sm text-center animate-in fade-in ${message.includes('✅') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Piston Server Config */}
        <Card className="border-0 shadow-sm rounded-3xl overflow-hidden bg-white dark:bg-slate-900 transition-colors">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 p-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-3">
              <Server className="h-5 w-5 text-indigo-500" /> Máy Chủ Thực Thi Code (Piston API Server)
            </h2>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                URL Endpoint Thực Thi (Default: https://emkc.org/api/v2/piston/execute)
              </label>
              <div className="flex gap-3">
                <Input
                  type="url"
                  placeholder="https://emkc.org/api/v2/piston/execute"
                  value={pistonUrl}
                  onChange={(e) => setPistonUrl(e.target.value)}
                  className="h-12 rounded-xl bg-slate-50 border-slate-200 flex-1 font-mono text-sm"
                />
                <Button
                  type="button"
                  onClick={handleTestPiston}
                  disabled={pistonStatus === 'testing'}
                  variant="outline"
                  className="h-12 px-4 rounded-xl gap-2 font-bold min-w-[140px]"
                >
                  {pistonStatus === 'testing' ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-indigo-500" />
                  ) : pistonStatus === 'success' ? (
                    <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Kết nối tốt</span>
                  ) : pistonStatus === 'failed' ? (
                    <span className="flex items-center gap-1 text-red-500"><AlertCircle className="h-4 w-4" /> Không nối được</span>
                  ) : (
                    <span className="flex items-center gap-1"><Cpu className="h-4 w-4 text-indigo-500" /> Kiểm tra</span>
                  )}
                </Button>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Máy chủ Piston biên dịch và thực thi trực tiếp các ngôn ngữ Python, Java, C++, C.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Gemini AI Config */}
        <Card className="border-0 shadow-sm rounded-3xl overflow-hidden bg-white dark:bg-slate-900 transition-colors">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 p-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-3">
              <Key className="h-5 w-5 text-amber-500" /> Gemini API Key (Vấn Đáp AI)
            </h2>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                API Key (Google AI Studio)
              </label>
              <div className="flex gap-3">
                <Input
                  type="password"
                  placeholder="AIzaSy..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="h-12 rounded-xl bg-slate-50 border-slate-200 flex-1 font-mono text-sm"
                />
                <Button
                  type="button"
                  onClick={handleTestGemini}
                  disabled={geminiStatus === 'testing'}
                  variant="outline"
                  className="h-12 px-4 rounded-xl gap-2 font-bold min-w-[140px]"
                >
                  {geminiStatus === 'testing' ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-amber-500" />
                  ) : geminiStatus === 'success' ? (
                    <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Đã có Key</span>
                  ) : geminiStatus === 'failed' ? (
                    <span className="flex items-center gap-1 text-red-500"><AlertCircle className="h-4 w-4" /> Chưa nhập</span>
                  ) : (
                    <span className="flex items-center gap-1"><Key className="h-4 w-4 text-amber-500" /> Kiểm tra</span>
                  )}
                </Button>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Dùng cho tính năng vấn đáp trực tiếp (Viva AI) và tự động chấm điểm bài lập trình.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={saving} className="h-12 px-8 rounded-xl font-black gap-2 shadow-lg">
            {saving ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            Lưu Cấu Hình Hệ Thống
          </Button>
        </div>
      </form>
    </div>
  );
}
