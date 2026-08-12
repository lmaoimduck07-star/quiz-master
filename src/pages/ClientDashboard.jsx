import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { storage } from '../utils/storage';
import { storageV2 } from '../utils/storageV2';
import {
  isUserUnlimited,
  getRemainingCooldownSeconds,
  formatCooldownTime,
} from '../utils/cooldownManager';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import {
  BookOpen, Clock, LogOut, ShieldAlert, Award, FileText, ChevronRight,
  Play, Sun, Moon, TrendingUp, AlertTriangle, Loader2, Code2,
  Trophy, Calendar, Eye, CheckSquare, Square, BarChart3, Target
} from 'lucide-react';

// 🔧 Chế độ bảo trì cổng lập trình — đặt true để tạm khóa truy cập, false để mở lại
const CODING_MAINTENANCE = false;

// Format seconds to mm:ss
const formatTimeTaken = (seconds) => {
  if (!seconds && seconds !== 0) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export default function ClientDashboard() {
  const navigate = useNavigate();
  const { currentUser, logout, activeRole, setActiveRole } = useAuth();

  const [subjects, setSubjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [showPracticeModal, setShowPracticeModal] = useState(false);

  // Cooldown 10 phút luyện tập theo tài khoản
  const isUnlimited = isUserUnlimited(currentUser);
  const [cooldownRemaining, setCooldownRemaining] = useState(() =>
    currentUser?.id ? getRemainingCooldownSeconds(currentUser.id) : 0
  );

  useEffect(() => {
    if (!currentUser?.id || isUnlimited) {
      setCooldownRemaining(0);
      return;
    }
    const updateCd = () => {
      setCooldownRemaining(getRemainingCooldownSeconds(currentUser.id));
    };
    updateCd();
    const interval = setInterval(updateCd, 1000);
    return () => clearInterval(interval);
  }, [currentUser?.id, isUnlimited]);

  // Simulation states
  const [showExamSelectModal, setShowExamSelectModal] = useState(false); // modal chọn đề
  const [showSimModal, setShowSimModal] = useState(false);               // modal xác nhận mã
  const [simSubject, setSimSubject] = useState(null);
  const [simMode, setSimMode] = useState('random');                      // 'random' | 'selected'
  const [selectedExamIds, setSelectedExamIds] = useState([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [enteredCode, setEnteredCode] = useState('');

  // Coding transition states
  const [isEnteringCoding, setIsEnteringCoding] = useState(false);
  const [codingStep, setCodingStep] = useState(0);

  // Results history states
  const [examResults, setExamResults] = useState([]);
  const [isLoadingResults, setIsLoadingResults] = useState(true);
  const [resultsFilter, setResultsFilter] = useState('all'); // 'all' | 'practice' | 'simulation'

  // Theme
  const { theme, toggleTheme } = useTheme();

  // Subscribe realtime subjects + exams (bao gồm isLocked, isMaintenance)
  useEffect(() => {
    localStorage.removeItem('qm_active_session');
    setIsLoading(true);
    const unsub = storageV2.subscribeSubjectsWithExams((data) => {
      setSubjects(data.filter(s => s.isActive !== false));
      setIsLoading(false);
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);

  // Load exam results real-time từ Firestore
  useEffect(() => {
    if (!currentUser?.id) return;
    setIsLoadingResults(true);
    const unsub = storage.subscribeExamResults(currentUser.id, (data) => {
      setExamResults(data);
      setIsLoadingResults(false);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [currentUser?.id]);

  // ── Computed stats for sidebar ──
  const filteredResults = examResults.filter(r => {
    if (resultsFilter === 'practice') return r.mode === 'practice' || !r.mode || r.mode === undefined;
    if (resultsFilter === 'simulation') return r.mode === 'simulation';
    return true;
  });

  const totalAttempts = examResults.length;
  const avgScore = totalAttempts > 0
    ? (examResults.reduce((sum, r) => sum + (r.score || 0), 0) / totalAttempts).toFixed(1)
    : '--';
  const passRate = totalAttempts > 0
    ? Math.round((examResults.filter(r => (r.score || 0) >= 5).length / totalAttempts) * 100)
    : '--';

  // ── Handlers ──
  const handleEnterCoding = (subjectId = null) => {
    if (CODING_MAINTENANCE) return;
    const cleanSubjectId = typeof subjectId === 'string' ? subjectId : null;
    setIsEnteringCoding(true);
    setCodingStep(0);
    setTimeout(() => setCodingStep(1), 800);
    setTimeout(() => setCodingStep(2), 1600);
    setTimeout(() => {
      setIsEnteringCoding(false);
      navigate('/coding/dashboard', { state: { subjectId: cleanSubjectId } });
    }, 2400);
  };

  // Sinh Mã Session theo quy luật: [CHẾ_ĐỘ]_[USER_ID]_[MÃ_MÔN]_[HHMMSS]_[HASH3]
  // Ví dụ: P_U01_ENG_201405_X8K (Practice) | SIM_U01_ENG_201445_M3A (Simulation)
  // Thêm giây + hash3 để tránh trùng khi bấm lại trong cùng 1 phút
  const buildSessionId = (mode, subjectName) => {
    const modePrefix = mode === 'simulation' ? 'SIM' : 'P';
    // Lấy phần đầu ID user (tối đa 6 ký tự, chữ hoa)
    const userId = (currentUser?.id || 'USR').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
    // Lấy chữ cái đầu của tên môn (tối đa 4 ký tự, bỏ dấu)
    const subjectCode = (subjectName || 'MON')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .split(' ')
      .filter(Boolean)
      .map(w => w[0].toUpperCase())
      .join('')
      .slice(0, 4);
    // HHMMSS hiện tại theo giờ VN — thêm giây để phân biệt các session trong cùng phút
    const now = new Date();
    const hhmmss =
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0');
    // Hàm sinh hash 3 ký tự ngẫu nhiên (A-Z, 0-9)
    const genHash3 = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bỏ O,0,I,1 dễ nhầm
      return Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    };
    // Sinh mã và tự động thử lại nếu (hiếm) trùng với expired list
    const getExpiredList = () => {
      try { return JSON.parse(localStorage.getItem('qm_expired_sessions') || '[]'); } catch { return []; }
    };
    let candidate;
    let attempts = 0;
    do {
      candidate = `${modePrefix}_${userId}_${subjectCode}_${hhmmss}_${genHash3()}`;
      attempts++;
    } while (getExpiredList().includes(candidate) && attempts < 10);
    return candidate;
  };

  const generateVerificationCode = () =>
    Math.floor(100000 + Math.random() * 900000).toString();

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleSwitchToAdmin = () => {
    setActiveRole('Admin');
    localStorage.setItem('qm_active_role', 'Admin');
    navigate('/admin/dashboard');
  };

  // Launch Practice Test
  const startPractice = async (subject, exam) => {
    // Kiểm tra nhanh từ state local trước
    if (exam.isLocked) {
      alert('🔒 Đề thi này đã bị Quản trị viên khóa! Vui lòng chọn bài thi khác.');
      return;
    }
    if (exam.isMaintenance) {
      alert('🚧 Đề thi này đang trong quá trình bảo trì! Vui lòng quay lại sau.');
      return;
    }
    if (!isUnlimited && cooldownRemaining > 0) {
      alert(`⏱️ Tài khoản đang trong thời gian chờ (10 phút) giữa các lượt luyện tập!\nVui lòng thử lại sau ${formatCooldownTime(cooldownRemaining)}.`);
      return;
    }

    // ── Verify tươi từ Firestore để tránh race condition ──
    // (Admin có thể vừa khóa đề sau khi học sinh mở modal)
    if (exam.id) {
      try {
        const freshExam = await storageV2.getExamV2(exam.id);
        if (!freshExam) {
          alert('❌ Không tìm thấy đề thi này. Vui lòng thử lại.');
          return;
        }
        if (freshExam.isLocked) {
          alert('🔒 Đề thi vừa bị khóa bởi Quản trị viên! Vui lòng chọn bài thi khác.');
          return;
        }
        if (freshExam.isMaintenance) {
          alert('🚧 Đề thi vừa chuyển sang chế độ bảo trì! Vui lòng quay lại sau.');
          return;
        }
      } catch (err) {
        console.warn('[startPractice] Không thể verify exam từ Firestore, tiếp tục với state hiện tại:', err);
      }
    }

    const sessionId = buildSessionId('practice', subject.name);
    const qCount = exam.questionCount || exam.questions?.length || 10;
    const timeInMinutes = exam.config?.time || Math.max(5, Math.round(qCount * 1.5));
    navigate(`/client/exam/${sessionId}`, {
      state: {
        examId: exam.id,
        title: exam.config?.title || exam.title,
        questions: [],
        timeLimit: timeInMinutes * 60,
        mode: 'practice',
        subjectName: subject.name,
        examSessionCode: sessionId
      }
    });
  };

  // Open simulation exam select modal
  const openSimulationModal = (subject) => {
    const totalQCount = (subject.exams || []).reduce((sum, ex) => sum + (ex.questionCount || ex.questions?.length || 0), 0);
    if (totalQCount === 0) {
      alert('Môn học này chưa có câu hỏi nào để tạo đề thi mô phỏng! (Mã lỗi: DASH-01)');
      return;
    }
    setSimSubject(subject);
    setSimMode('random');
    setSelectedExamIds([]);
    setShowExamSelectModal(true);
  };

  // Proceed from exam select modal to confirmation modal
  const handleProceedToConfirm = () => {
    if (simMode === 'selected' && selectedExamIds.length === 0) {
      alert('Vui lòng chọn ít nhất một bài thi! (Mã lỗi: DASH-03)');
      return;
    }
    setShowExamSelectModal(false);
    setVerificationCode(generateVerificationCode());
    setEnteredCode('');
    setShowSimModal(true);
  };

  // Toggle exam selection in modal
  const toggleExamSelect = (examId) => {
    setSelectedExamIds(prev =>
      prev.includes(examId) ? prev.filter(id => id !== examId) : [...prev, examId]
    );
  };

  const selectAllExams = () => {
    setSelectedExamIds((simSubject?.exams || []).map(ex => ex.id));
  };

  const deselectAllExams = () => {
    setSelectedExamIds([]);
  };

  // Confirm simulation — build questions and navigate
  const handleConfirmSimulation = async () => {
    if (enteredCode !== verificationCode) {
      alert('Mã xác nhận chưa chính xác! (Mã lỗi: DASH-02)');
      return;
    }
    setShowSimModal(false);

    const exams = simSubject?.exams || [];
    let targetExams = simMode === 'random' ? exams : exams.filter(ex => selectedExamIds.includes(ex.id));

    let questionPool = [];
    for (const ex of targetExams) {
      const qs = await storageV2.loadQuestionsV2(ex.id);
      if (qs && qs.length > 0) questionPool.push(...qs);
    }

    if (questionPool.length === 0) {
      alert('Không tìm thấy câu hỏi nào cho bài thi mô phỏng này!');
      return;
    }

    const shuffled = [...questionPool].sort(() => 0.5 - Math.random());
    const simulationQuestions = shuffled.slice(0, 50);

    // Build title showing which exams were selected
    let simTitle = 'Khảo thí mô phỏng: ' + simSubject.name;
    if (simMode === 'selected' && selectedExamIds.length > 0) {
      const selectedNames = targetExams
        .map(ex => ex.config?.title || ex.title)
        .join(', ');
      simTitle = `Khảo thí mô phỏng: ${simSubject.name} (${selectedNames})`;
    }

    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error('Fullscreen error:', err);
      });
    }

    const sessionId = buildSessionId('simulation', simSubject.name);
    navigate(`/client/exam/${sessionId}`, {
      state: {
        examId: 'sim_' + Date.now(),
        title: simTitle,
        questions: simulationQuestions,
        timeLimit: Math.max(15, Math.round(simulationQuestions.length * 1.5)) * 60,
        mode: 'simulation',
        subjectName: simSubject.name,
        examSessionCode: sessionId
      }
    });
  };

  const openPracticeList = (subject) => {
    setSelectedSubject(subject);
    setShowPracticeModal(true);
  };

  // Navigate to review from history sidebar
  const handleViewResult = (result) => {
    navigate('/client/review', {
      state: {
        title: result.title,
        score: result.score,
        correctCount: result.correctCount,
        totalCount: result.totalCount,
        questions: result.questions || []
      }
    });
  };

  // ── Coding transition screen ──
  if (isEnteringCoding) {
    const steps = [
      'Đang tải phân hệ thi lập trình...',
      'Đang xác thực thông tin tài khoản học sinh...',
      'Thiết lập cổng kết nối bảo mật hoàn tất. Đang chuyển hướng...'
    ];
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans transition-colors duration-200">
        <Card className="max-w-md w-full border-slate-800 bg-slate-900 shadow-2xl rounded-3xl overflow-hidden animate-in fade-in duration-300">
          <CardContent className="p-8 space-y-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
            <div className="space-y-2">
              <h2 className="text-xl font-black text-white">Chuyển sang Cổng lập trình</h2>
              <p className="text-slate-400 text-sm font-semibold h-6 leading-relaxed">
                {steps[codingStep]}
              </p>
            </div>
            <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800 animate-pulse">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${((codingStep + 1) / 3) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main render ──
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-50 flex flex-col transition-colors duration-200">
      {/* ─── Header ─── */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-4 px-8 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <h2 className="text-2xl font-black text-primary dark:text-blue-500 flex items-center gap-2 m-0">
          <BookOpen className="h-7 w-7" /> Quiz Master
        </h2>

        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 h-9 w-9 rounded-xl border-transparent bg-transparent"
            title={theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng'}
          >
            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5 text-yellow-400" />}
          </Button>

          {currentUser?.roles?.includes('Admin') && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSwitchToAdmin}
              className="font-bold border-purple-200 hover:bg-purple-50 text-purple-700 dark:border-purple-900 dark:hover:bg-purple-950/30 dark:text-purple-400 h-9 rounded-xl flex items-center gap-1.5 bg-transparent"
            >
              <ShieldAlert className="h-4 w-4" /> Admin Panel
            </Button>
          )}

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{currentUser?.fullName}</div>
              <div className="text-xs text-slate-400 font-medium">Học sinh</div>
            </div>
            <div className="h-9 w-9 rounded-xl bg-primary/10 dark:bg-blue-900/30 flex items-center justify-center text-primary dark:text-blue-400 font-bold">
              {(currentUser?.fullName || 'H').charAt(0).toUpperCase()}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-red-500 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30 h-9 w-9 rounded-xl border-transparent bg-transparent"
            title="Đăng xuất"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* ─── Body: Sidebar + Main ─── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ═══════════════════════════════════════════
            LEFT SIDEBAR — Bảng Tổng Hợp Kết Quả
        ═══════════════════════════════════════════ */}
        <aside className="w-80 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
          {/* Sidebar Header */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary dark:text-blue-400" />
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Kết quả của tôi
              </h2>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
            {isLoadingResults ? (
              <div className="flex items-center justify-center py-4 gap-2 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs font-medium">Đang tải...</span>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 text-center">
                  <div className="text-xl font-black text-slate-800 dark:text-slate-100">{totalAttempts}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Lượt thi</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 text-center">
                  <div className={`text-xl font-black ${avgScore !== '--' && parseFloat(avgScore) >= 5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100'}`}>
                    {avgScore}
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Điểm TB</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 text-center">
                  <div className={`text-xl font-black ${passRate !== '--' && passRate >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100'}`}>
                    {passRate !== '--' ? `${passRate}%` : '--'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Tỉ lệ đạt</div>
                </div>
              </div>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="px-4 pt-3 pb-2 shrink-0">
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
              {[
                { key: 'all', label: 'Tất cả' },
                { key: 'practice', label: '🏋️ Luyện tập' },
                { key: 'simulation', label: '🎯 Mô phỏng' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setResultsFilter(tab.key)}
                  className={`flex-1 text-[10px] font-bold rounded-lg py-1.5 transition-all duration-150 ${
                    resultsFilter === tab.key
                      ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
            {isLoadingResults ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin text-primary dark:text-blue-400" />
                <span className="text-xs font-semibold">Đang tải kết quả...</span>
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                <Trophy className="h-10 w-10 text-slate-200 dark:text-slate-700" />
                <div className="text-center">
                  <div className="text-sm font-bold text-slate-500 dark:text-slate-400">Chưa có kết quả</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Hãy làm bài thi để xem kết quả ở đây
                  </div>
                </div>
              </div>
            ) : (
              filteredResults.map((result, idx) => {
                const isPractice = !result.mode || result.mode === 'practice';
                const isPass = (result.score || 0) >= 5;
                return (
                  <div
                    key={result.id || idx}
                    className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 rounded-2xl p-3 hover:border-primary/30 dark:hover:border-blue-500/30 hover:bg-primary/5 dark:hover:bg-blue-950/20 transition-all duration-150 group"
                  >
                    {/* Mode Badge + Score Row */}
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        isPractice
                          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                          : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                      }`}>
                        {isPractice ? '🏋️ Luyện tập' : '🎯 Mô phỏng'}
                      </span>
                      <span className={`text-base font-black ${isPass ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {result.score ?? '--'}/10
                      </span>
                    </div>

                    {/* Title */}
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-snug line-clamp-2 mb-2">
                      {result.title || result.subjectName || 'Bài thi'}
                    </div>

                    {/* Meta info */}
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-semibold mb-2.5">
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        {result.correctCount ?? '--'}/{result.totalCount ?? '--'} đúng
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimeTaken(result.timeTaken)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {result.date || '--'}
                      </span>
                    </div>

                    {/* View button */}
                    {result.questions?.length > 0 && (
                      <button
                        onClick={() => handleViewResult(result)}
                        className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-primary dark:text-blue-400 hover:bg-primary/10 dark:hover:bg-blue-900/30 rounded-xl py-1.5 transition-colors border border-primary/20 dark:border-blue-500/20"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Xem lại bài làm
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ═══════════════════════════════════════════
            MAIN CONTENT
        ═══════════════════════════════════════════ */}
        <main className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Welcome banner */}
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-2">
                Xin chào, {currentUser?.fullName || 'Học sinh'}! 👋
              </h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                Lựa chọn môn học dưới đây để bắt đầu luyện tập hoặc thi khảo thí mô phỏng.
              </p>
            </div>
            <div className="bg-primary/5 dark:bg-blue-955/30 px-6 py-4 rounded-2xl border border-primary/10 dark:border-blue-900/20 flex items-center gap-4 shrink-0">
              <Award className="h-10 w-10 text-primary dark:text-blue-400 shrink-0" />
              <div>
                <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">Hệ thống Khảo thí mô phỏng</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Thời gian thi: 50 phút / 50 câu hỏi</div>
              </div>
            </div>
          </div>

          {/* Môn học đang mở */}
          <div>
            <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-6">Môn học đang mở</h2>

            {isLoading ? (
              <Card className="border-0 shadow-sm rounded-3xl p-12 text-center text-slate-500 dark:bg-slate-900 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 text-primary dark:text-blue-500 animate-spin" />
                <div className="font-bold text-sm">Đang tải danh sách môn học...</div>
              </Card>
            ) : subjects.length === 0 ? (
              <Card className="border-0 shadow-sm rounded-3xl p-12 text-center text-slate-500 dark:bg-slate-900">
                <BookOpen className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                <div className="font-bold text-lg mb-1">Không có môn học nào đang mở</div>
                <p className="text-sm">Vui lòng liên hệ Admin để kích hoạt môn học.</p>
              </Card>
            ) : (
              <div className="flex flex-col gap-5">
                {subjects.map((subject) => {
                  const totalExams = subject.exams ? subject.exams.length : 0;
                  const isCodingSub = subject.status === 'developer';
                  const codingCount = isCodingSub ? storage.loadSubjectCodingProblems(subject.id, subjects).length : 0;
                  return (
                    <Card key={subject.id} className="border-0 shadow-sm hover:shadow-md transition duration-200 rounded-3xl overflow-hidden bg-white dark:bg-slate-900 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      {/* Left: Info */}
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`p-3 rounded-2xl shrink-0 hidden sm:block ${isCodingSub
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'bg-primary/10 dark:bg-blue-900/20 text-primary dark:text-blue-400'
                        }`}>
                          {isCodingSub ? <Code2 className="h-6 w-6" /> : <BookOpen className="h-6 w-6" />}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-snug">
                              {subject.name}
                            </h3>
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500 font-semibold">ID: {subject.id}</div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-bold pt-1">
                            {isCodingSub ? (
                              <>
                                <Code2 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                                <span>{codingCount} đề lập trình</span>
                              </>
                            ) : (
                              <>
                                <FileText className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                                <span>{totalExams} đề luyện tập</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex gap-3 shrink-0 w-full md:w-auto">
                        {isCodingSub ? (
                          <Button
                            className={`w-full md:w-auto font-bold h-11 px-6 rounded-xl gap-1.5 shadow-sm border-transparent ${CODING_MAINTENANCE
                              ? 'bg-amber-600/80 hover:bg-amber-600 text-amber-100 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                            onClick={() => handleEnterCoding(subject.id)}
                            disabled={CODING_MAINTENANCE}
                          >
                            {CODING_MAINTENANCE
                              ? <><AlertTriangle className="h-4 w-4" /> Đang bảo trì</>
                              : <><Code2 className="h-4 w-4" /> Vào Cổng Lập trình</>}
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              className="flex-1 md:flex-none font-bold h-11 px-6 rounded-xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 bg-transparent"
                              disabled={totalExams === 0}
                              onClick={() => openPracticeList(subject)}
                            >
                              Luyện tập
                            </Button>
                            <Button
                              className="flex-1 md:flex-none font-bold h-11 px-6 rounded-xl gap-1.5 shadow-sm"
                              disabled={totalExams === 0}
                              onClick={() => openSimulationModal(subject)}
                            >
                              <Play className="h-4 w-4 fill-white" /> Thi mô phỏng
                            </Button>
                          </>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ═══════════════════════════════════════════
          MODAL: Practice Exam List
      ═══════════════════════════════════════════ */}
      {showPracticeModal && selectedSubject && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg border-none shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
            <div className="bg-slate-50 dark:bg-slate-800 px-8 py-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white m-0 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary dark:text-blue-400" />
                Luyện tập: {selectedSubject.name}
              </h2>
              <button
                onClick={() => setShowPracticeModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
              >
                <XIcon className="h-6 w-6" />
              </button>
            </div>
            <CardContent className="p-6 space-y-3 overflow-y-auto max-h-[60vh]">
              {!isUnlimited && cooldownRemaining > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-semibold flex items-center gap-2 mb-3 border border-amber-200 dark:border-amber-800">
                  <Clock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    Tài khoản đang trong thời gian chờ (10 phút) giữa các lượt làm bài. Thử lại sau{' '}
                    <strong className="font-mono text-amber-900 dark:text-amber-200 text-sm">{formatCooldownTime(cooldownRemaining)}</strong>
                  </span>
                </div>
              )}

              {selectedSubject.exams?.length > 0 ? (
                selectedSubject.exams.map((ex, idx) => {
                  const isLocked = !!ex.isLocked;
                  const isMaintenance = !!ex.isMaintenance;
                  const isBlocked = isLocked || isMaintenance || (!isUnlimited && cooldownRemaining > 0);

                  return (
                    <div
                      key={ex.id}
                      className={`p-4 border rounded-2xl flex items-center justify-between transition ${
                        isBlocked
                          ? 'opacity-70 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                          : 'border-slate-100 dark:border-slate-800 hover:border-primary/30 dark:hover:border-blue-500/30 hover:bg-primary/5 dark:hover:bg-blue-950/20 cursor-pointer group'
                      }`}
                      onClick={() => {
                        if (!isBlocked) {
                          setShowPracticeModal(false);
                          startPractice(selectedSubject, ex);
                        }
                      }}
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2 flex-wrap">
                          <span>Bài {idx + 1}: {ex.config?.title || ex.title}</span>
                          {isLocked && (
                            <span className="text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 px-2 py-0.5 rounded border border-red-200 dark:border-red-800">
                              🔒 Đã khóa
                            </span>
                          )}
                          {isMaintenance && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                              🚧 Bảo trì
                            </span>
                          )}
                          {!isUnlimited && cooldownRemaining > 0 && !isLocked && !isMaintenance && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 font-mono">
                              ⏱️ Chờ {formatCooldownTime(cooldownRemaining)}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-4 text-xs text-slate-400 dark:text-slate-500 mt-1.5 font-medium">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5" /> {ex.questions?.length ?? ex.questionCount ?? 0} câu hỏi
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" /> ~{ex.config?.time || ex.config?.timeLimit || Math.max(5, Math.round((ex.questions?.length ?? ex.questionCount ?? 0) * 1.5))} phút
                          </span>
                        </div>
                      </div>
                      <ChevronRight className={`h-5 w-5 ${isBlocked ? 'text-slate-300 dark:text-slate-700' : 'text-slate-400 group-hover:text-primary dark:group-hover:text-blue-400 group-hover:translate-x-1'} transition-all shrink-0`} />
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-slate-500 py-8">Chưa có đề luyện tập nào cho môn học này.</div>
              )}
            </CardContent>
            <div className="bg-slate-50 dark:bg-slate-800 px-8 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <Button
                variant="ghost"
                className="rounded-xl font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 bg-transparent"
                onClick={() => setShowPracticeModal(false)}
              >
                Đóng lại
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          MODAL: Chọn Đề Khảo Thí Mô Phỏng
      ═══════════════════════════════════════════ */}
      {showExamSelectModal && simSubject && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg border-none shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
            {/* Header */}
            <div className="bg-slate-50 dark:bg-slate-800 px-8 py-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white m-0 flex items-center gap-2">
                <Target className="h-5 w-5 text-primary dark:text-blue-400" />
                Cấu hình Khảo thí Mô phỏng
              </h2>
              <button
                onClick={() => setShowExamSelectModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
              >
                <XIcon className="h-6 w-6" />
              </button>
            </div>

            <CardContent className="p-6 space-y-5">
              {/* Subject info */}
              <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Môn học: <strong className="text-slate-800 dark:text-slate-200">{simSubject.name}</strong>
              </div>

              {/* Mode selection — Segmented Radio */}
              <div>
                <div className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Chọn chế độ thi
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* Option 1: Random */}
                  <button
                    onClick={() => setSimMode('random')}
                    className={`flex flex-col items-start p-4 rounded-2xl border-2 transition-all duration-150 text-left ${
                      simMode === 'random'
                        ? 'border-primary dark:border-blue-500 bg-primary/5 dark:bg-blue-950/30'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="text-xl mb-2">🎲</div>
                    <div className={`text-sm font-bold ${simMode === 'random' ? 'text-primary dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                      Ngẫu nhiên
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
                      50 câu ngẫu nhiên từ toàn bộ đề trong môn
                    </div>
                  </button>

                  {/* Option 2: Select specific */}
                  <button
                    onClick={() => setSimMode('selected')}
                    className={`flex flex-col items-start p-4 rounded-2xl border-2 transition-all duration-150 text-left ${
                      simMode === 'selected'
                        ? 'border-primary dark:border-blue-500 bg-primary/5 dark:bg-blue-950/30'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="text-xl mb-2">📋</div>
                    <div className={`text-sm font-bold ${simMode === 'selected' ? 'text-primary dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                      Chọn đề cụ thể
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
                      Tick chọn bài thi muốn đưa vào đề thi
                    </div>
                  </button>
                </div>
              </div>

              {/* Exam Checkbox List — chỉ hiện khi chọn mode 'selected' */}
              {simMode === 'selected' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Chọn bài thi ({selectedExamIds.length}/{(simSubject.exams || []).length} đề)
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={selectAllExams}
                        className="text-[11px] font-bold text-primary dark:text-blue-400 hover:underline"
                      >
                        Chọn tất cả
                      </button>
                      <span className="text-slate-300 dark:text-slate-600">|</span>
                      <button
                        onClick={deselectAllExams}
                        className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:underline"
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {(simSubject.exams || []).map((ex, idx) => {
                      const isSelected = selectedExamIds.includes(ex.id);
                      return (
                        <div
                          key={ex.id}
                          onClick={() => toggleExamSelect(ex.id)}
                          className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all duration-150 ${
                            isSelected
                              ? 'border-primary dark:border-blue-500 bg-primary/5 dark:bg-blue-950/30'
                              : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          {isSelected
                            ? <CheckSquare className="h-5 w-5 text-primary dark:text-blue-400 shrink-0" />
                            : <Square className="h-5 w-5 text-slate-300 dark:text-slate-600 shrink-0" />
                          }
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-bold truncate ${isSelected ? 'text-primary dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                              Bài {idx + 1}: {ex.config?.title || ex.title}
                            </div>
                            <div className="text-xs text-slate-400 font-medium mt-0.5">
                              {ex.questions?.length || 0} câu hỏi
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>

            {/* Footer */}
            <div className="bg-slate-50 dark:bg-slate-800 px-8 py-5 border-t border-slate-100 dark:border-slate-700 flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => setShowExamSelectModal(false)}
                className="rounded-xl font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 bg-transparent"
              >
                Hủy bỏ
              </Button>
              <Button
                onClick={handleProceedToConfirm}
                disabled={simMode === 'selected' && selectedExamIds.length === 0}
                className="rounded-xl font-bold bg-primary hover:bg-primary-dark text-white px-6 shadow-sm disabled:opacity-50 gap-1.5"
              >
                Tiếp tục <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          MODAL: Xác Nhận Mã Anti-cheat
      ═══════════════════════════════════════════ */}
      {showSimModal && simSubject && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-250">
          <Card className="w-full max-w-lg border-none shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-250 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
            <div className="bg-slate-50 dark:bg-slate-800 px-8 py-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white m-0 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-red-500 animate-pulse" />
                Xác nhận Khảo thí Mô phỏng
              </h2>
              <button
                onClick={() => setShowSimModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
              >
                <XIcon className="h-6 w-6" />
              </button>
            </div>
            <CardContent className="p-8 space-y-6">
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4 text-amber-800 dark:text-amber-400/80 text-sm leading-relaxed font-semibold">
                ⚠️ CẢNH BÁO ANTI-CHEAT: Hệ thống sẽ tự động chuyển sang chế độ TOÀN MÀN HÌNH. Mọi hành vi thoát fullscreen, chuyển tab, mở phần mềm khác hoặc rời tiêu điểm sẽ bị ghi nhận là vi phạm quy chế thi. Đạt 3 lần vi phạm, hệ thống sẽ tự động nộp bài!
              </div>

              <div className="text-slate-600 dark:text-slate-400 text-sm font-semibold">
                Bạn có chắc chắn muốn tham gia kỳ thi mô phỏng môn{' '}
                <strong className="text-slate-800 dark:text-slate-300">{simSubject.name}</strong>?
                {simMode === 'selected' && selectedExamIds.length > 0 && (
                  <span className="block mt-1 text-xs text-primary dark:text-blue-400">
                    📋 Đề được tạo từ {selectedExamIds.length} bài thi đã chọn (tối đa 50 câu ngẫu nhiên)
                  </span>
                )}
                {simMode === 'random' && (
                  <span className="block mt-1 text-xs text-slate-400">
                    🎲 Đề gồm 50 câu được trộn ngẫu nhiên từ toàn bộ đề trong môn — giới hạn 50 phút.
                  </span>
                )}
              </div>

              <div className="flex gap-4 items-center bg-slate-50 dark:bg-slate-800/40 p-4 border border-slate-200 dark:border-slate-700/50 rounded-2xl">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Nhập mã xác nhận</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Mã 6 số..."
                    value={enteredCode}
                    onChange={(e) => setEnteredCode(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (enteredCode === verificationCode) handleConfirmSimulation();
                      }
                    }}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-lg font-black tracking-widest text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary text-center"
                  />
                </div>
                <div className="text-center bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-white rounded-2xl px-5 py-3 shadow-md border border-slate-300 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider font-sans">Mã ngẫu nhiên</div>
                  <div className="text-2xl font-black tracking-widest text-emerald-600 dark:text-emerald-500 font-mono select-none">{verificationCode}</div>
                </div>
              </div>
            </CardContent>
            <div className="bg-slate-50 dark:bg-slate-800 px-8 py-5 border-t border-slate-100 dark:border-slate-700 flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => setShowSimModal(false)}
                className="rounded-xl font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 bg-transparent"
              >
                Hủy bỏ
              </Button>
              <Button
                onClick={handleConfirmSimulation}
                disabled={enteredCode !== verificationCode}
                className="rounded-xl font-bold bg-primary hover:bg-primary-dark text-white px-6 shadow-sm disabled:opacity-50"
              >
                Bắt đầu làm bài
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// Internal XIcon component
function XIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}
