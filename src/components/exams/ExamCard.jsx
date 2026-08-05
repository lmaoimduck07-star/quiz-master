import { FileText, Pencil, Clock, HelpCircle, Play, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';

export default function ExamCard({ exam, isCompleted, onDelete, onEdit, onPlay }) {
  
  const handleRename = () => {
    let newName = prompt("Nhập tên mới cho bài thi này:", exam.config.title);
    if (newName !== null && newName.trim() !== "") {
      onEdit(exam.id, { ...exam.config, title: newName.trim() });
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 transition hover:shadow-md hover:border-primary dark:hover:border-blue-500 flex flex-col md:flex-row items-center justify-between gap-4 group w-full transition-colors">
      
      {/* KHỐI TRÁI: ICON VÀ TIÊU ĐỀ */}
      <div className="flex items-center gap-3.5 flex-1 min-w-0">
        <div className="p-2.5 rounded-xl flex-shrink-0 bg-primary/10 dark:bg-blue-900/30 text-primary dark:text-blue-400 shadow-inner">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 m-0 flex items-center gap-2">
            <span className="truncate" title={exam.config.title}>{exam.config.title}</span>
            {exam.code && (
              <span className="text-[10px] font-black font-mono bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/50 shrink-0">
                {exam.code}
              </span>
            )}
            {!isCompleted && (
              <button 
                onClick={handleRename}
                className="opacity-0 group-hover:opacity-100 transition text-slate-400 hover:text-amber-500 bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg p-1.5 flex-shrink-0"
                title="Đổi tên bài thi"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </h3>
          
          {/* Thông tin phụ nằm ngay dưới tiêu đề */}
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1.5">
            <span className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-350 px-2.5 py-0.5 rounded-md border border-amber-100 dark:border-amber-900/30">
              <Clock className="h-3.5 w-3.5" /> {exam.config.time > 0 ? `${exam.config.time} phút` : 'Làm tự do'}
            </span>
            <span className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-505 dark:text-indigo-350 px-2.5 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900/30">
              <HelpCircle className="h-3.5 w-3.5" /> {exam.questionCount ?? exam.questions?.length ?? 0} câu hỏi
            </span>
          </div>
        </div>
      </div>

      {/* KHỐI PHẢI: CÁC NÚT HÀNH ĐỘNG */}
      <div className="flex gap-2.5 flex-shrink-0 w-full md:w-auto">
        <Button 
          variant="success"
          onClick={() => onPlay(exam.id)}
          className="h-9 px-5 font-black rounded-xl text-xs gap-1.5 shadow-sm border-transparent"
        >
          <Play className="h-3.5 w-3.5 fill-current" /> LÀM BÀI
        </Button>
        
        {!isCompleted && (
          <Button 
            variant="outline"
            onClick={() => onEdit(exam.id, null)} 
            className="h-9 px-4 font-bold rounded-xl text-xs border-primary dark:border-blue-600 text-primary dark:text-blue-400 hover:bg-primary/5 dark:hover:bg-blue-900/10 gap-1.5 bg-transparent"
          >
            <Pencil className="h-3.5 w-3.5" /> Sửa Đề
          </Button>
        )}
        
        <Button 
          variant="outline"
          onClick={() => onDelete(exam.id)}
          className="h-9 w-9 p-0 border-red-200 dark:border-red-900/40 text-red-500 dark:text-red-400 hover:bg-red-600 hover:text-white rounded-xl bg-transparent flex items-center justify-center"
          title="Xóa đề thi"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

    </div>
  );
}