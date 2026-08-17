import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Code2, BarChart3, LogOut,
  Sun, Moon, GraduationCap, Users, ChevronRight,
  Trophy, Clock, CheckCircle, TrendingUp
} from 'lucide-react';
import SubjectManager from '../components/exams/SubjectManager';
import ExamManager from '../components/exams/ExamManager';
import ExamEditor from '../components/exams/ExamEditor';
import CodingProblemManager from '../components/exams/CodingProblemManager';

import { storage } from '../utils/storage';
import { storageV2 } from '../utils/storageV2';
import { generateExamId } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className={`relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200 group`}>
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br ${color} opacity-5`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-3xl font-black text-slate-800 dark:text-white">{value}</p>
          {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">{sub}</p>}
        </div>
        <div className={`p-3 rounded-2xl bg-gradient-to-br ${color} shadow-lg`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ─── Results Tab ─────────────────────────────────────────────────────────────
function ResultsTab({ examResults, subjects }) {
  const [search, setSearch] = useState('');

  const filteredResults = examResults.filter(r =>
    r.studentName?.toLowerCase().includes(search.toLowerCase()) ||
    r.examTitle?.toLowerCase().includes(search.toLowerCase())
  );

  const totalStudents = new Set(examResults.map(r => r.userId || r.studentName)).size;
  const avgScore = examResults.length > 0
    ? Math.round(examResults.reduce((sum, r) => sum + (r.score || 0), 0) / examResults.length)
    : 0;
  const passCount = examResults.filter(r => (r.score || 0) >= 5).length;
  const passRate = examResults.length > 0 ? Math.round((passCount / examResults.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-center mb-8 relative">
        <div className="inline-block bg-emerald-500/10 dark:bg-emerald-500/20 p-5 rounded-full text-emerald-500 mb-4">
          <BarChart3 className="h-10 w-10" />
        </div>
        <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-1 text-center">KẾT QUẢ THI</h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-center text-sm">Thống kê điểm số và kết quả bài thi của học sinh</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="h-5 w-5 text-white" />}
          label="Học sinh tham gia"
          value={totalStudents}
          color="from-blue-500 to-indigo-600"
        />
        <StatCard
          icon={<Trophy className="h-5 w-5 text-white" />}
          label="Tổng lượt nộp bài"
          value={examResults.length}
          color="from-amber-400 to-orange-500"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-white" />}
          label="Điểm trung bình"
          value={`${avgScore}/10`}
          color="from-emerald-500 to-teal-600"
        />
        <StatCard
          icon={<CheckCircle className="h-5 w-5 text-white" />}
          label="Tỷ lệ đạt (≥5đ)"
          value={`${passRate}%`}
          sub={`${passCount}/${examResults.length} lượt`}
          color="from-violet-500 to-purple-600"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex gap-3">
          <input
            type="text"
            placeholder="Tìm kiếm theo tên học sinh hoặc đề thi..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 h-10 rounded-xl px-4 text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-wider border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Học sinh</th>
                <th className="px-6 py-4">Đề thi</th>
                <th className="px-6 py-4">Điểm</th>
                <th className="px-6 py-4">Đúng / Tổng</th>
                <th className="px-6 py-4">Thời gian</th>
                <th className="px-6 py-4">Kết quả</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 font-medium">
                    {examResults.length === 0 ? 'Chưa có kết quả thi nào.' : 'Không tìm thấy kết quả khớp.'}
                  </td>
                </tr>
              ) : (
                filteredResults.slice(0, 50).map((r, i) => {
                  const score = r.score ?? 0;
                  const isPassed = score >= 5;
                  const submittedAt = r.submittedAt
                    ? new Date(r.submittedAt).toLocaleString('vi-VN')
                    : r.date || '—';
                  return (
                    <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{r.studentName || '—'}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{r.userId || ''}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 font-medium max-w-[200px] truncate">{r.examTitle || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xl font-black ${isPassed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                          {score.toFixed ? score.toFixed(1) : score}
                        </span>
                        <span className="text-slate-400 text-xs">/10</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-600 dark:text-slate-300">
                        {r.correct ?? '—'}/{r.total ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400 dark:text-slate-500 font-medium">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {submittedAt}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${isPassed ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400'}`}>
                          {isPassed ? 'Đạt' : 'Không đạt'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function LecturerDashboard() {
  const navigate = useNavigate();
  const { logout, currentUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('subjects');
  const [subjects, setSubjects] = useState([]);
  const [currentSubject, setCurrentSubject] = useState(null);
  const [editingExamId, setEditingExamId] = useState(null);
  const [examResults, setExamResults] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    setDataLoading(true);
    const unsubSubj = storageV2.subscribeSubjectsV2(s => {
      setSubjects(s || []);
      setCurrentSubject(prev => {
        if (!prev?.id) return null;
        return s.find(subj => subj.id === prev.id) || null;
      });
      setDataLoading(false);
    });
    const unsubResults = storage.subscribeExamResults(null, res => {
      setExamResults(res || []);
    });
    storage.cleanStaleSessions();
    return () => {
      if (typeof unsubSubj === 'function') unsubSubj();
      if (typeof unsubResults === 'function') unsubResults();
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { tab: 'subjects', icon: <BookOpen className="h-5 w-5" />, label: 'Môn học & Đề thi' },
    { tab: 'coding', icon: <Code2 className="h-5 w-5" />, label: 'Đề Lập trình' },
    { tab: 'results', icon: <BarChart3 className="h-5 w-5" />, label: 'Kết quả thi' },
  ];

  // ─── Subject/Exam handlers ─────────────────────────────────
  const handleAddSubject = (newSubj) => storageV2.saveSubjectV2(newSubj);
  const handleDeleteSubject = (subjId) => {
    storageV2.deleteSubjectV2(subjId);
    if (currentSubject?.id === subjId) setCurrentSubject(null);
  };
  const handleUpdateSubject = (updatedSubject) => storageV2.saveSubjectV2(updatedSubject);

  const handleSaveExam = async (examId, config, questions) => {
    const subjCode = currentSubject.code ||
      (currentSubject.name || 'MON').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9 ]/g, '').split(' ').filter(Boolean)
        .map(w => w[0].toUpperCase()).join('').slice(0, 6);

    let newExamId = examId;
    let examCode = config.code;
    if (!examId) {
      // Dùng generateExamId() — scan số đã dùng, luôn chọn số nhỏ nhất chưa tồn tại
      newExamId = await generateExamId(currentSubject.id, subjCode);
      const padded = newExamId.split('_bai_')[1] || '01';
      examCode = config.code || `${subjCode}_BAI_${padded}`;
    } else {
      examCode = config.code || examId.toUpperCase().replace(/_/g, '_');
    }

    const newExam = {
      id: newExamId,
      subjectId: currentSubject.id,
      subjectCode: subjCode,
      code: examCode,
      title: config.title || 'Đề thi',
      config,
      created: new Date().toLocaleDateString('vi-VN'),
    };
    await storageV2.saveExamV2(newExam);
    if (questions?.length > 0) await storageV2.saveQuestionsV2(newExamId, questions);
    setEditingExamId(null);
  };

  // ─── Render subjects/exam panel ────────────────────────────
  const renderSubjectsTab = () => {
    if (editingExamId !== null && currentSubject) {
      return (
        <ExamEditor
          subject={currentSubject}
          examId={editingExamId === 'new' ? null : editingExamId}
          onBack={() => setEditingExamId(null)}
          onSaveExam={handleSaveExam}
        />
      );
    }
    if (currentSubject) {
      if (!currentSubject.id) { setCurrentSubject(null); return null; }
      const isCoding = currentSubject.status === 'developer';
      if (isCoding) {
        return (
          <CodingProblemManager
            subject={currentSubject}
            onBack={() => setCurrentSubject(null)}
          />
        );
      }
      const handlePlayExam = async (examId) => {
        const exams = await storageV2.loadExamsV2(currentSubject.id);
        const exam = exams.find(e => e.id === examId);
        if (!exam) return;
        navigate('/client/exam', {
          state: {
            examId: exam.id,
            title: exam.config?.title || exam.title,
            timeLimit: exam.config?.time ? exam.config.time * 60 : 15 * 60,
            mode: 'practice',
            subjectName: currentSubject.name,
          },
        });
      };
      return (
        <ExamManager
          subject={currentSubject}
          onBack={() => setCurrentSubject(null)}
          onOpenEditor={(id) => setEditingExamId(id || 'new')}
          onPlayExam={handlePlayExam}
        />
      );
    }
    return (
      <SubjectManager
        subjects={subjects}
        onAddSubject={handleAddSubject}
        onDeleteSubject={handleDeleteSubject}
        onUpdateSubject={handleUpdateSubject}
        onOpenSubject={(subjOrId) => {
          const target = typeof subjOrId === 'string' ? subjects.find(s => s.id === subjOrId) : subjOrId;
          setCurrentSubject(target || null);
        }}
      />
    );
  };

  // ─── Render coding tab ─────────────────────────────────────
  const renderCodingTab = () => {
    const codingSubjects = subjects.filter(s => s.status === 'developer');
    if (currentSubject?.status === 'developer') {
      return (
        <CodingProblemManager
          subject={currentSubject}
          onBack={() => setCurrentSubject(null)}
        />
      );
    }
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center mb-8">
          <div className="inline-block bg-violet-500/10 dark:bg-violet-500/20 p-5 rounded-full text-violet-500 mb-4">
            <Code2 className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-1 text-center">ĐỀ LẬP TRÌNH</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-center text-sm">Quản lý bài tập lập trình, test cases và cấu hình chấm điểm</p>
        </div>
        {dataLoading ? (
          <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : codingSubjects.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-16 text-center">
            <Code2 className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">Chưa có môn học lập trình nào.</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Hãy tạo môn học với loại <strong>Lập trình</strong> trong tab <strong>Môn học & Đề thi</strong>.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {codingSubjects.map(subj => (
              <button
                key={subj.id}
                onClick={() => setCurrentSubject(subj)}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 text-left hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md transition-all duration-200 group"
              >
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded-xl bg-violet-100 dark:bg-violet-900/30 mb-3 group-hover:scale-110 transition-transform">
                    <Code2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-violet-400 transition-colors mt-1" />
                </div>
                <div className="font-bold text-slate-800 dark:text-white text-sm">{subj.name}</div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono">{subj.code || subj.id}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const showSidebar = editingExamId === null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex transition-colors duration-200">
      {/* ─── Sidebar ─────────────────────────────────────────── */}
      {showSidebar && (
        <div className="w-64 bg-slate-900 text-slate-300 flex flex-col fixed top-0 bottom-0 left-0 z-30 border-r border-slate-800">
          {/* Logo */}
          <div className="p-6 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 shadow-lg shadow-amber-900/30">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white leading-none">Giảng viên</h2>
                <p className="text-[10px] text-amber-400 font-bold mt-0.5 uppercase tracking-wider">Lecturer Panel</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto">
            {navItems.map(({ tab, icon, label, badge }) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setCurrentSubject(null); setEditingExamId(null); }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium transition-all duration-150 text-sm ${activeTab === tab
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-900/30'
                  : 'hover:bg-slate-800 hover:text-white text-slate-400'}`}
              >
                <span className="flex items-center gap-3">{icon} {label}</span>
                {badge}
              </button>
            ))}
          </nav>

          {/* User & Logout */}
          <div className="p-4 border-t border-slate-800 space-y-2">
            {currentUser && (
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-black text-sm shadow-sm shrink-0">
                  {(currentUser.fullName || 'L').charAt(0).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-slate-200 truncate">{currentUser.fullName || currentUser.username}</p>
                  <p className="text-[10px] text-amber-400 font-bold">Giảng viên</p>
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-red-400 hover:text-red-300 hover:bg-slate-800 transition-colors text-sm"
            >
              <LogOut className="h-5 w-5" /> Đăng xuất
            </button>
          </div>
        </div>
      )}

      {/* ─── Main Content ────────────────────────────────────── */}
      <div className={`flex-1 flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 ${showSidebar ? 'pl-64' : ''}`}>
        {/* Header */}
        {showSidebar && (
          <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex justify-end items-center transition-colors shadow-sm gap-3">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 h-9 w-9 rounded-xl flex items-center justify-center transition-colors"
              title={theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng'}
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5 text-yellow-400" />}
            </button>
          </header>
        )}

        {/* Tab content */}
        <main className={`flex-1 overflow-y-auto ${showSidebar ? 'p-6' : 'p-0'}`}>

          {activeTab === 'subjects' && (
            <div className="space-y-6">{renderSubjectsTab()}</div>
          )}
          {activeTab === 'coding' && (
            <div className="space-y-6">{renderCodingTab()}</div>
          )}
          {activeTab === 'results' && (
            <ResultsTab examResults={examResults} subjects={subjects} />
          )}
        </main>
      </div>
    </div>
  );
}
