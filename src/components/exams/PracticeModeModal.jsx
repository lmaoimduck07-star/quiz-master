import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Zap, BookOpen, Clock, Shuffle, ChevronRight, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';

/**
 * PracticeModeModal — Popup chọn chế độ luyện tập
 *
 * Props:
 *   isOpen       {boolean}
 *   onClose      {function}
 *   subject      {object}   — { id, name, ... }
 *   exam         {object}   — { id, config, questions, questionCount, ... }
 *   isUnlimited  {boolean}
 *   cooldownRemaining {number}
 *   formatCooldownTime {function}
 *   onStartStandard  {function(subject, exam, options)}
 */
export default function PracticeModeModal({
  isOpen,
  onClose,
  subject,
  exam,
  isUnlimited,
  cooldownRemaining,
  formatCooldownTime,
  onStartStandard,
}) {
  const navigate = useNavigate();

  const [timeMode, setTimeMode] = useState('default'); // 'default' | 'zen'
  const [questionCount, setQuestionCount] = useState('all'); // 'all' | 10 | 20 | 30

  if (!isOpen || !exam) return null;

  const totalQuestions = exam.questionCount || exam.questions?.length || 0;
  const defaultTime = exam.config?.time || Math.max(5, Math.round(totalQuestions * 1.5));
  const isCooldownBlocked = !isUnlimited && cooldownRemaining > 0;

  const getCount = () => {
    if (questionCount === 'all') return totalQuestions;
    return Math.min(parseInt(questionCount), totalQuestions);
  };

  const handleStartStandard = () => {
    if (isCooldownBlocked) return;
    onClose();
    onStartStandard(subject, exam, {
      timeMode,
      questionCount: getCount(),
    });
  };

  const handleStartInstant = () => {
    if (isCooldownBlocked) return;
    onClose();
    navigate(`/client/practice/instant/P_${subject.id}_${exam.id}_${Date.now().toString(36).toUpperCase()}`, {
      state: {
        examId: exam.id,
        subjectId: subject.id,
        title: exam.config?.title || exam.title,
        subjectName: subject.name,
        timeMode,
        questionCount: getCount(),
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{subject?.name}</p>
            <h2 className="text-base font-extrabold text-slate-800 dark:text-white line-clamp-1">
              {exam.config?.title || exam.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition bg-transparent rounded-xl p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Cooldown warning */}
          {isCooldownBlocked && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-semibold">
              <Clock className="h-4 w-4 shrink-0" />
              <span>Thời gian chờ còn <strong className="font-mono">{formatCooldownTime(cooldownRemaining)}</strong></span>
            </div>
          )}

          {/* 1. Chọn chế độ */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Chế độ luyện tập</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Tiêu chuẩn */}
              <button
                onClick={handleStartStandard}
                disabled={isCooldownBlocked}
                className="group relative flex flex-col items-start gap-2 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left bg-transparent"
              >
                <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-800 dark:text-slate-100">Tiêu chuẩn</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 leading-snug mt-0.5">Làm hết bài rồi nộp</div>
                </div>
                <ChevronRight className="absolute right-3 bottom-4 h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
              </button>

              {/* Tức thì */}
              <button
                onClick={handleStartInstant}
                disabled={isCooldownBlocked}
                className="group relative flex flex-col items-start gap-2 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left bg-transparent"
              >
                <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-800 dark:text-slate-100">Phản hồi tức thì</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 leading-snug mt-0.5">Kiểm tra đáp án từng câu</div>
                </div>
                <ChevronRight className="absolute right-3 bottom-4 h-4 w-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
              </button>
            </div>
          </div>

          {/* 2. Thời gian */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Thời gian làm bài</p>
            <div className="flex gap-2">
              <button
                onClick={() => setTimeMode('default')}
                className={`flex-1 py-2.5 px-3 rounded-xl border-2 text-sm font-bold transition-all ${
                  timeMode === 'default'
                    ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-transparent hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <Clock className="h-3.5 w-3.5 inline mr-1.5" />
                {defaultTime} phút
              </button>
              <button
                onClick={() => setTimeMode('zen')}
                className={`flex-1 py-2.5 px-3 rounded-xl border-2 text-sm font-bold transition-all ${
                  timeMode === 'zen'
                    ? 'border-violet-400 dark:border-violet-500 bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-transparent hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                🧘 Zen Mode
              </button>
            </div>
            {timeMode === 'zen' && (
              <p className="text-xs text-violet-500 dark:text-violet-400 font-medium pl-1">Không giới hạn thời gian, không áp lực đếm ngược.</p>
            )}
          </div>

          {/* 3. Số câu */}
          {totalQuestions > 10 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Shuffle className="h-3.5 w-3.5" /> Số câu hỏi
              </p>
              <div className="flex gap-2 flex-wrap">
                {['all', 10, 20, 30].map((c) => {
                  if (c !== 'all' && c >= totalQuestions) return null;
                  return (
                    <button
                      key={c}
                      onClick={() => setQuestionCount(c)}
                      className={`py-2 px-4 rounded-xl border-2 text-sm font-bold transition-all ${
                        questionCount === c
                          ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-transparent hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {c === 'all' ? `Tất cả (${totalQuestions})` : `${c} câu`}
                    </button>
                  );
                })}
              </div>
              {questionCount !== 'all' && (
                <p className="text-xs text-blue-500 dark:text-blue-400 font-medium pl-1">{getCount()} câu được chọn ngẫu nhiên từ đề.</p>
              )}
            </div>
          )}
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
          <Button
            variant="ghost"
            onClick={onClose}
            className="rounded-xl font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 bg-transparent"
          >
            Đóng lại
          </Button>
        </div>
      </div>
    </div>
  );
}
