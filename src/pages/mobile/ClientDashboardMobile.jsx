import React, { useState } from 'react';
import {
  BookOpen, Play, Trophy, Target,
  ChevronRight, Loader2, X,
  ShieldAlert, Eye, Wrench, Clock, Lock
} from 'lucide-react';
import MobileNavbar from '../../components/mobile/MobileNavbar';
import { useClientDashboardLogic } from '../../hooks/useClientDashboardLogic';

// ── Helpers ──
const formatTimeTaken = (seconds) => {
  if (!seconds && seconds !== 0) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// ── Sub-components ──

function StatBadge({ label, value, color = 'slate' }) {
  const colorMap = {
    slate: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200',
    green: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    red: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  };
  return (
    <div className={`flex flex-col items-center rounded-2xl px-4 py-3 ${colorMap[color]}`}>
      <span className="text-xl font-black leading-none">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-60">{label}</span>
    </div>
  );
}

function SubjectCard({ subject, onPractice }) {
  const examCount = (subject.exams || []).length;
  const questionCount = (subject.exams || []).reduce((a, e) => a + (e.questions?.length || 0), 0);
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm">
      {/* Subject header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
            {subject.name}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {examCount} bộ đề · {questionCount} câu hỏi
          </p>
        </div>
        <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        {/* Luyện tập */}
        <button
          onClick={() => onPractice(subject)}
          className="flex items-center justify-center gap-1.5 py-3 rounded-xl
                     bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300
                     text-xs font-bold border border-indigo-200 dark:border-indigo-700/50
                     active:scale-95 transition-all duration-150"
          style={{ minHeight: 48 }}
        >
          <Play className="w-3.5 h-3.5" />
          Luyện tập
        </button>

        {/* Mô phỏng — Đang bảo trì */}
        <div
          className="flex flex-col items-center justify-center gap-0.5 py-3 rounded-xl
                     bg-slate-50 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500
                     text-xs font-bold border border-slate-200 dark:border-slate-700/40
                     cursor-not-allowed select-none"
          style={{ minHeight: 48 }}
          title="Tính năng này đang bảo trì"
        >
          <div className="flex items-center gap-1">
            <Wrench className="w-3 h-3" />
            <span>Mô phỏng</span>
          </div>
          <span className="text-[9px] font-black uppercase tracking-wider text-amber-500 dark:text-amber-400">
            Bảo trì
          </span>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ result, onView }) {
  const isPractice = !result.mode || result.mode === 'practice';
  const isPass = (result.score || 0) >= 5;
  return (
    <div
      className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700/50
                 rounded-xl p-3 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
              isPractice
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
            }`}>
              {isPractice ? 'Luyện tập' : 'Mô phỏng'}
            </span>
          </div>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 line-clamp-1 leading-snug">
            {result.title || result.subjectName || 'Bài thi'}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {result.correctCount ?? '--'}/{result.totalCount ?? '--'} đúng · {formatTimeTaken(result.timeTaken)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`text-base font-black ${isPass ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
            {result.score ?? '--'}/10
          </span>
          <button
            onClick={() => onView(result)}
            className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5"
            style={{ minHeight: 32 }}
          >
            <Eye className="w-3 h-3" />
            Xem
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sim Confirm Modal (Bottom Sheet style on mobile) ──
function SimConfirmModal({ code, enteredCode, onChange, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-t-3xl p-6 shadow-2xl animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Xác Nhận Bắt Đầu Thi</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Nhập mã xác nhận bên dưới để bắt đầu bài thi mô phỏng. Sau khi bắt đầu, đồng hồ sẽ chạy và không thể dừng.
        </p>
        <div className="text-center mb-5">
          <p className="text-xs text-slate-400 mb-1">Mã xác nhận của bạn:</p>
          <p className="text-3xl font-black tracking-widest text-indigo-600 dark:text-indigo-400">{code}</p>
        </div>
        <input
          type="number"
          value={enteredCode}
          onChange={e => onChange(e.target.value)}
          placeholder="Nhập mã xác nhận..."
          className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-center
                     text-lg font-bold tracking-widest mb-4
                     bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100
                     focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={onConfirm}
          className="w-full py-3.5 rounded-xl bg-red-600 text-white text-sm font-black
                     active:scale-95 transition-all"
          style={{ minHeight: 48 }}
        >
          🎯 Bắt Đầu Thi Mô Phỏng
        </button>
      </div>
    </div>
  );
}

// ── Practice List Modal (Bottom Sheet) ──
function PracticeListModal({ subject, onStart, onClose, isUnlimited, cooldownRemaining, cooldownFormatted }) {
  const exams = subject?.exams || [];
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl max-h-[75vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">{subject?.name} — Chọn Bài Luyện Tập</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-3 space-y-2 flex-1">
          {!isUnlimited && cooldownRemaining > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-semibold flex items-center gap-2 mb-2 border border-amber-200 dark:border-amber-800">
              <Clock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                Thời gian chờ (10 phút): Thử lại sau{' '}
                <strong className="font-mono text-amber-900 dark:text-amber-200 text-sm">{cooldownFormatted}</strong>
              </span>
            </div>
          )}

          {exams.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Chưa có bộ đề nào.</p>
          ) : (
            exams.map((exam) => {
              const isLocked = !!exam.isLocked;
              const isMaintenance = !!exam.isMaintenance;
              const isBlocked = isLocked || isMaintenance || (!isUnlimited && cooldownRemaining > 0);

              return (
                <button
                  key={exam.id}
                  disabled={isBlocked}
                  onClick={() => onStart(subject, exam)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all duration-150 ${
                    isBlocked
                      ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/50 active:scale-[0.98]'
                  }`}
                  style={{ minHeight: 56 }}
                >
                  <div className="flex-1 pr-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {exam.config?.title || exam.title || 'Bài thi'}
                      </p>
                      {isLocked && (
                        <span className="text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800">
                          🔒 Đã khóa
                        </span>
                      )}
                      {isMaintenance && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                          🚧 Bảo trì
                        </span>
                      )}
                      {!isUnlimited && cooldownRemaining > 0 && !isLocked && !isMaintenance && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 font-mono">
                          ⏱️ Chờ {cooldownFormatted}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{exam.questions?.length || exam.questionCount || 0} câu hỏi</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}


// ─── Main Component ───
export default function ClientDashboardMobile() {
  const logic = useClientDashboardLogic();
  const {
    subjects, isLoading,
    selectedSubject, showPracticeModal, setShowPracticeModal,
    examResults, filteredResults, isLoadingResults,
    resultsFilter, setResultsFilter,
    totalAttempts, avgScore, passRate,
    currentUser,
    handleSwitchToAdmin,
    startPractice, openPracticeList,
    handleViewResult,
  } = logic;

  const [activeTab, setActiveTab] = useState('exams'); // 'exams' | 'results'

  const pageTitle = activeTab === 'exams' ? 'Môn Học' : 'Kết Quả';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* MobileNavbar — cố định đầu trang */}
      <MobileNavbar title="Quiz Master" />

      {/* Content — padding-top để tránh Header che khuất */}
      <div className="flex-1 flex flex-col pt-14 pb-0">

        {/* ── User greeting ── */}
        <div className="px-4 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Xin chào,</p>
              <h1 className="text-base font-black text-slate-800 dark:text-slate-100">
                {currentUser?.fullName || currentUser?.email?.split('@')[0]}
              </h1>
            </div>
            {currentUser?.roles?.includes('Admin') && (
              <button
                onClick={handleSwitchToAdmin}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl
                           bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400
                           text-xs font-bold border border-purple-200 dark:border-purple-700/50
                           active:scale-95 transition-all"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Admin
              </button>
            )}
          </div>

          {/* Quick stats row */}
          {!isLoadingResults && (
            <div className="flex gap-2 mt-3">
              <StatBadge label="Lượt thi" value={totalAttempts} />
              <StatBadge
                label="Điểm TB"
                value={avgScore}
                color={avgScore !== '--' && parseFloat(avgScore) >= 5 ? 'green' : 'slate'}
              />
              <StatBadge
                label="Tỉ lệ đạt"
                value={passRate !== '--' ? `${passRate}%` : '--'}
                color={passRate !== '--' && passRate >= 50 ? 'green' : 'slate'}
              />
            </div>
          )}
        </div>

        {/* ── Tab Switcher ── */}
        <div className="flex bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 gap-1 pt-1">
          {[
            { key: 'exams', label: '📚 Môn Học' },
            { key: 'results', label: '🏆 Kết Quả' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all duration-150 ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400'
                  : 'border-transparent text-slate-400 dark:text-slate-500'
              }`}
              style={{ minHeight: 44 }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

          {/* === TAB: Môn Học === */}
          {activeTab === 'exams' && (
            <>
              {isLoading ? (
                <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Đang tải môn học...</span>
                </div>
              ) : subjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                  <BookOpen className="w-10 h-10 text-slate-200 dark:text-slate-700" />
                  <p className="text-sm text-center">Chưa có môn học nào được mở.<br />Vui lòng liên hệ giáo viên.</p>
                </div>
              ) : (
                subjects.map(subject => (
                  <SubjectCard
                    key={subject.id}
                    subject={subject}
                    onPractice={openPracticeList}
                  />
                ))
              )}
            </>
          )}

          {/* === TAB: Kết Quả === */}
          {activeTab === 'results' && (
            <>
              {/* Filter pills */}
              <div className="flex gap-2">
                {[
                  { key: 'all', label: 'Tất cả' },
                  { key: 'practice', label: 'Luyện tập' },
                  { key: 'simulation', label: 'Mô phỏng' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setResultsFilter(tab.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-150 ${
                      resultsFilter === tab.key
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {isLoadingResults ? (
                <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                  <Trophy className="w-10 h-10 text-slate-200 dark:text-slate-700" />
                  <p className="text-sm text-center">Chưa có kết quả nào.<br />Hãy làm bài để xem kết quả ở đây.</p>
                </div>
              ) : (
                filteredResults.map((result, idx) => (
                  <ResultCard
                    key={result.id || idx}
                    result={result}
                    onView={handleViewResult}
                  />
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {showPracticeModal && selectedSubject && (
        <PracticeListModal
          subject={selectedSubject}
          onStart={startPractice}
          onClose={() => setShowPracticeModal(false)}
          isUnlimited={logic.isUnlimited}
          cooldownRemaining={logic.cooldownRemaining}
          cooldownFormatted={logic.cooldownFormatted}
        />
      )}
    </div>
  );
}
