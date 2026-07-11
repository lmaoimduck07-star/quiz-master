import { ArrowLeft, Save, Shuffle, Lock, ShieldAlert, Ban } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export default function Taskbar({ config, setConfig, onBack, onSave }) {
  // Hàm nhỏ để update từng giá trị vào Object config
  const handleChange = (field, value) => {
    setConfig({ ...config, [field]: value });
  };

  return (
    <div className="fixed top-0 left-0 right-0 h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shadow-sm z-50 transition-colors">
      
      {/* NÚT QUAY LẠI */}
      <Button 
        variant="ghost"
        onClick={onBack}
        className="font-semibold rounded-lg gap-2 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-750 dark:text-slate-300"
      >
        <ArrowLeft className="h-5 w-5" /> Hủy / Trở về
      </Button>

      {/* CÁC THÔNG SỐ CẤU HÌNH ĐỀ THI */}
      <div className="flex items-center gap-4">
        <Input 
          type="text" 
          placeholder="Tên bài kiểm tra..." 
          className="w-64 font-semibold"
          value={config.title}
          onChange={(e) => handleChange('title', e.target.value)}
        />
        
        <div className="flex items-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden h-10 focus-within:ring-2 focus-within:ring-primary dark:focus-within:ring-blue-500 focus-within:border-transparent transition-all">
          <input 
            type="number" 
            placeholder="Phút" 
            className="p-2 outline-none w-20 text-center text-sm bg-transparent text-slate-750 dark:text-slate-200"
            value={config.time || ''}
            onChange={(e) => handleChange('time', parseInt(e.target.value) || 0)}
          />
          <span className="pr-3 text-slate-500 dark:text-slate-400 text-xs font-bold">Phút</span>
        </div>

        <Input 
          type="text" 
          placeholder="Khóa mật khẩu..." 
          className="w-36"
          value={config.password}
          onChange={(e) => handleChange('password', e.target.value)}
        />

        {/* CÁC CHECKBOX */}
        <div className="flex items-center gap-4 ml-2 border-l border-slate-300 dark:border-slate-700 pl-4 h-10">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-600 dark:text-slate-300">
            <input type="checkbox" className="accent-primary w-4 h-4 rounded cursor-pointer" checked={config.shuffleQ} onChange={(e) => handleChange('shuffleQ', e.target.checked)} />
            <Shuffle className="h-4 w-4 text-slate-400" /> Câu
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-600 dark:text-slate-300">
            <input type="checkbox" className="accent-primary w-4 h-4 rounded cursor-pointer" checked={config.shuffleA} onChange={(e) => handleChange('shuffleA', e.target.checked)} />
            <Shuffle className="h-4 w-4 text-slate-400" /> Đáp án
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-600 dark:text-slate-300">
            <input type="checkbox" className="accent-primary w-4 h-4 rounded cursor-pointer" checked={config.encrypt} onChange={(e) => handleChange('encrypt', e.target.checked)} />
            <Lock className="h-4 w-4 text-slate-400" /> Mã hóa
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-3 py-1.5 rounded-md border border-red-100 dark:border-red-900/40" title="Bắt buộc toàn màn hình, cấm chuyển tab">
            <input type="checkbox" className="accent-red-600 w-4 h-4 rounded cursor-pointer" checked={config.strictMode} onChange={(e) => handleChange('strictMode', e.target.checked)} />
            <ShieldAlert className="h-4 w-4 text-red-500" /> Chống gian lận
          </label>
        </div>

        {/* Giới hạn số lượt làm */}
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 ml-2 border-l border-slate-300 dark:border-slate-700 pl-4">
          <Ban className="h-4 w-4 text-slate-400" /> Lượt làm:
          <Input 
            type="number" 
            min="0" 
            title="Nhập 0 để cho phép làm không giới hạn"
            className="w-16 text-center px-1"
            value={config.limitAttempts}
            onChange={(e) => handleChange('limitAttempts', parseInt(e.target.value) || 0)}
          />
        </div>
      </div>

      {/* NÚT LƯU ĐỀ THI */}
      <Button 
        onClick={onSave}
        className="font-bold px-6 shadow-md gap-2 border-transparent"
      >
        <Save className="h-5 w-5" /> LƯU ĐỀ THI
      </Button>

    </div>
  );
}