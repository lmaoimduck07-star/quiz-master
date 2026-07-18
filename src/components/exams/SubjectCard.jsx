// src/components/exams/SubjectCard.jsx
import { useState, useEffect } from 'react';
import { BookOpen, CheckCircle, Trash2, ArrowRight, Code2, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/Button';
import { storage } from '../../utils/storage';

export default function SubjectCard({ subject, onDelete, onOpen, onUpdate }) {
  const isCompleted = subject.isCompleted;
  const [isCoding, setIsCoding] = useState(false);
  const [codingCount, setCodingCount] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [targetState, setTargetState] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [enteredCode, setEnteredCode] = useState('');

  useEffect(() => {
    // Đồng bộ trạng thái code dựa trên trường status của môn học từ Firebase
    const isCodingSub = subject.status === 'developer';
    setIsCoding(isCodingSub);
    
    if (isCodingSub) {
      const probs = storage.loadSubjectCodingProblems(subject.id);
      setCodingCount(probs.length);
    } else {
      setCodingCount(0);
    }
  }, [subject.id, subject.status]);

  const handleToggleClick = (e) => {
    // Ngăn chặn checkbox thay đổi giá trị trực tiếp trước khi xác nhận
    e.preventDefault();
    const nextState = !isCoding;
    setTargetState(nextState);
    
    // Sinh mã ngẫu nhiên
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setVerificationCode(code);
    setEnteredCode('');
    setShowConfirmModal(true);
  };

  const handleConfirmToggle = () => {
    if (enteredCode !== verificationCode) {
      alert('Mã xác nhận chưa chính xác!');
      return;
    }

    // Cập nhật trường status trực tiếp lên Firestore
    onUpdate({
      ...subject,
      status: targetState ? 'developer' : 'normal'
    });
    
    setShowConfirmModal(false);
  };

  return (
    <div className={`relative flex items-center justify-between p-6 bg-white dark:bg-slate-900 border rounded-xl transition hover:shadow-lg transform hover:-translate-y-1 ${isCompleted ? 'border-emerald-500 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
      
      <div className="flex items-center gap-4 flex-1">
        <div className={`p-4 rounded-xl ${
          isCoding 
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
            : isCompleted 
            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' 
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350'
        }`}>
          {isCoding ? (
            <Code2 className="h-8 w-8" />
          ) : isCompleted ? (
            <CheckCircle className="h-8 w-8" />
          ) : (
            <BookOpen className="h-8 w-8" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 m-0 leading-snug truncate">
              {subject.name}
            </h3>
            
            {/* Nút gạt chuyển chế độ Code bên cạnh tiêu đề môn học */}
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={isCoding} 
                onChange={handleToggleClick} 
                className="sr-only peer" 
              />
              <div className="relative w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
              <span className="ml-1.5 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Chế độ Code</span>
            </label>
          </div>
          
          <p className="text-sm text-slate-500 dark:text-slate-400 font-semibold m-0 mt-1 flex items-center gap-2">
            {isCoding ? (
              <span>{codingCount} Đề thi lập trình (Code)</span>
            ) : (
              <span>{subject.exams?.length || 0} Đề thi trắc nghiệm</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button 
          variant={isCompleted ? "success" : isCoding ? "primary" : "primary"}
          onClick={() => onOpen(subject.id)}
          className="h-12 px-6 font-bold"
        >
          {isCompleted ? 'Xem Môn Này' : <><span className="mr-2">Vào Môn Này</span> <ArrowRight className="h-4 w-4" /></>}
        </Button>

        <Button 
          variant="outline"
          onClick={() => onDelete(subject.id)}
          className="h-12 w-12 p-0 text-red-500 hover:text-white hover:bg-red-600 border-red-200 dark:border-red-900/40 bg-transparent animate-none"
          title="Xóa môn học"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>

      {/* Modal Xác nhận Chuyển đổi Chế độ Code */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-yellow-500">
              <ShieldAlert className="h-6 w-6" />
              <h3 className="font-extrabold text-sm uppercase tracking-wider">Xác nhận chuyển chế độ</h3>
            </div>
            
            <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-semibold">
              Bạn có chắc chắn muốn chuyển môn học <strong>{subject.name}</strong> sang{' '}
              <strong>{targetState ? 'CHẾ ĐỘ THI CODE' : 'CHẾ ĐỘ TRẮC NGHIỆM'}</strong> không?
            </p>

            <div className="flex gap-3 items-center bg-slate-50 dark:bg-slate-950 p-3.5 border border-slate-200 dark:border-slate-850 rounded-2xl">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Nhập mã xác nhận</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Mã 6 số..."
                  value={enteredCode}
                  onChange={(e) => setEnteredCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirmToggle()}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-base font-black tracking-widest text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 text-center"
                />
              </div>
              <div className="text-center bg-slate-900 dark:bg-slate-950 text-white rounded-xl px-4 py-2 border border-slate-800 shadow-inner">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Mã ngẫu nhiên</div>
                <div className="text-lg font-black tracking-widest text-emerald-400 font-mono select-none">{verificationCode}</div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button
                variant="ghost"
                onClick={() => setShowConfirmModal(false)}
                className="rounded-xl font-bold text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 bg-transparent border-transparent"
              >
                Hủy bỏ
              </Button>
              <Button
                onClick={handleConfirmToggle}
                disabled={enteredCode !== verificationCode}
                className="rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 disabled:opacity-50"
              >
                Xác nhận
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}