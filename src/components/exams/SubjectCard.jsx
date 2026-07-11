import { BookOpen, CheckCircle, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';

export default function SubjectCard({ subject, onDelete, onOpen }) {
  const isCompleted = subject.isCompleted;
  
  return (
    <div className={`flex items-center justify-between p-6 bg-white dark:bg-slate-900 border rounded-xl transition hover:shadow-lg transform hover:-translate-y-1 ${isCompleted ? 'border-emerald-500 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
      
      <div className="flex items-center gap-4">
        <div className={`p-4 rounded-xl ${isCompleted ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350'}`}>
          {isCompleted ? <CheckCircle className="h-8 w-8" /> : <BookOpen className="h-8 w-8" />}
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 m-0">{subject.name}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-semibold m-0 mt-1 flex items-center gap-2">
            <span>{subject.exams?.length || 0} Đề thi</span>
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button 
          variant={isCompleted ? "success" : "primary"}
          onClick={() => onOpen(subject.id)}
          className="h-12 px-6 font-bold"
        >
          {isCompleted ? 'Xem Môn Này' : <><span className="mr-2">Vào Môn Này</span> <ArrowRight className="h-4 w-4" /></>}
        </Button>

        <Button 
          variant="outline"
          onClick={() => onDelete(subject.id)}
          className="h-12 w-12 p-0 text-red-500 hover:text-white hover:bg-red-600 border-red-200 dark:border-red-900/40 bg-transparent"
          title="Xóa môn học"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}