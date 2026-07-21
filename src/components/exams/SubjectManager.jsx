import { useState } from 'react';
import SubjectCard from './SubjectCard';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { BookOpen, BarChart2, Plus, BookCheck } from 'lucide-react';

export default function SubjectManager({ subjects, onAddSubject, onDeleteSubject, onOpenSubject, onUpdateSubject }) {
  const [subName, setSubName] = useState('');

  const handleCreate = () => {
    if (!subName.trim()) {
      alert("Vui lòng nhập tên môn học!");
      return;
    }

    onAddSubject({
      id: 'sub_' + Date.now(),
      name: subName.trim(),
      isCompleted: false,
      status: 'normal',
      exams: []
    });

    setSubName('');
  };

  const activeSubs = subjects.filter(s => !s.isCompleted);
  const completedSubs = subjects.filter(s => s.isCompleted);

  return (
    <div className="max-w-5xl mx-auto p-8">

      {/* Banner */}
      <div className="flex flex-col items-center mb-10 relative">
        <div className="inline-block bg-primary/10 p-6 rounded-full text-primary mb-4">
          <BookOpen className="h-12 w-12" />
        </div>
        <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-2 text-center">HỆ THỐNG QUẢN LÝ BỘ MÔN</h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-center">Tạo và quản lý đề thi theo môn học</p>
      </div>

      {/* Box tạo môn mới */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-12 transition-colors">
        <div className="flex-1 w-full">
          <Input
            type="text"
            placeholder="Nhập tên môn học mới (VD: Hệ điều hành, Mạng...)"
            className="w-full text-lg border-2 border-dashed h-14 rounded-xl"
            value={subName}
            onChange={(e) => setSubName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
        </div>

        <Button onClick={handleCreate} className="h-14 w-full md:w-auto px-8 rounded-xl font-bold whitespace-nowrap shadow-md gap-2">
          <Plus className="h-5 w-5" /> THÊM MÔN
        </Button>
      </div>

      {/* DANH SÁCH MÔN ĐANG HỌC */}
      <div className="flex items-center gap-4 mb-6">
        <h3 className="text-lg font-black text-slate-700 dark:text-slate-300 m-0 flex items-center gap-2">
          <BookOpen className="h-5 w-5" /> CÁC MÔN ĐANG HỌC
        </h3>
        <div className="flex-1 h-0.5 bg-slate-200 dark:bg-slate-800 rounded"></div>
      </div>

      <div className="flex flex-col gap-4 mb-12">
        {activeSubs.length === 0 ? (
          <div className="text-center p-10 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl text-slate-500 dark:text-slate-400 font-semibold bg-slate-50 dark:bg-slate-900/50">
            Bạn chưa tạo môn học nào.
          </div>
        ) : (
          activeSubs.map(sub => <SubjectCard key={sub.id} subject={sub} onDelete={onDeleteSubject} onOpen={onOpenSubject} onUpdate={onUpdateSubject} />)
        )}
      </div>

      {/* DANH SÁCH MÔN ĐÃ HOÀN THÀNH */}
      {completedSubs.length > 0 && (
        <>
          <div className="flex items-center gap-4 mb-6">
            <h3 className="text-lg font-black text-emerald-600 dark:text-emerald-400 m-0 flex items-center gap-2">
              <BookCheck className="h-5 w-5" /> CÁC MÔN ĐÃ HOÀN THÀNH (LƯU TRỮ)
            </h3>
            <div className="flex-1 h-0.5 bg-emerald-200 dark:bg-emerald-950/40 rounded"></div>
          </div>
          <div className="flex flex-col gap-4">
            {completedSubs.map(sub => <SubjectCard key={sub.id} subject={sub} onDelete={onDeleteSubject} onOpen={onOpenSubject} onUpdate={onUpdateSubject} />)}
          </div>
        </>
      )}

    </div>
  );
}