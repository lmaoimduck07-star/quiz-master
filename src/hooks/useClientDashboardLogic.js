import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { storage } from '../utils/storage';
import { storageV2 } from '../utils/storageV2';
import {
  isUserUnlimited,
  getRemainingCooldownSeconds,
  formatCooldownTime,
} from '../utils/cooldownManager';

// 🔧 Chế độ bảo trì cổng lập trình
const CODING_MAINTENANCE = false;

/**
 * useClientDashboardLogic — Hook tái sử dụng tất cả logic nghiệp vụ của ClientDashboard.
 * Được dùng chung cho Desktop (ClientDashboard) và Mobile (ClientDashboardMobile).
 * Không chứa bất kỳ JSX hay UI nào.
 */
export function useClientDashboardLogic() {
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
      const rem = getRemainingCooldownSeconds(currentUser.id);
      setCooldownRemaining(rem);
    };
    updateCd();
    const interval = setInterval(updateCd, 1000);
    return () => clearInterval(interval);
  }, [currentUser?.id, isUnlimited]);

  // Simulation states
  const [showExamSelectModal, setShowExamSelectModal] = useState(false);
  const [showSimModal, setShowSimModal] = useState(false);
  const [simSubject, setSimSubject] = useState(null);
  const [simMode, setSimMode] = useState('random');
  const [selectedExamIds, setSelectedExamIds] = useState([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [enteredCode, setEnteredCode] = useState('');

  // Coding transition states
  const [isEnteringCoding, setIsEnteringCoding] = useState(false);
  const [codingStep, setCodingStep] = useState(0);

  // Results history states
  const [examResults, setExamResults] = useState([]);
  const [isLoadingResults, setIsLoadingResults] = useState(true);
  const [resultsFilter, setResultsFilter] = useState('all');

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
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [currentUser?.id]);

  // ── Computed stats ──
  const filteredResults = examResults.filter(r => {
    if (resultsFilter === 'practice') return r.mode === 'practice' || !r.mode;
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

  // ── Session ID builder ──
  const buildSessionId = (mode, subjectName) => {
    const modePrefix = mode === 'simulation' ? 'SIM' : 'P';
    const userId = (currentUser?.id || 'USR').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
    const subjectCode = (subjectName || 'MON')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .split(' ').filter(Boolean)
      .map(w => w[0].toUpperCase()).join('').slice(0, 4);
    const now = new Date();
    const hhmmss =
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0');
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const genHash3 = () => Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const getExpired = () => { try { return JSON.parse(localStorage.getItem('qm_expired_sessions') || '[]'); } catch { return []; } };
    let candidate; let attempts = 0;
    do { candidate = `${modePrefix}_${userId}_${subjectCode}_${hhmmss}_${genHash3()}`; attempts++; }
    while (getExpired().includes(candidate) && attempts < 10);
    return candidate;
  };

  const generateVerificationCode = () => Math.floor(100000 + Math.random() * 900000).toString();

  // ── Handlers ──
  const handleLogout = () => { logout(); navigate('/login'); };

  const handleSwitchToAdmin = () => {
    setActiveRole('Admin');
    localStorage.setItem('qm_active_role', 'Admin');
    navigate('/admin/dashboard');
  };

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

    let qList = exam.questions || [];
    if ((!qList || qList.length === 0) && exam.id) {
      try {
        qList = (await storageV2.loadQuestionsV2(exam.id)) || [];
      } catch (err) {
        console.error('[startPractice] Error loading questions V2:', err);
      }
    }
    const qCount = qList.length > 0 ? qList.length : (exam.questionCount || 0);
    const calculatedTime = (qCount * 1.5) * 60; // 1.5 phút / câu
    const finalTimeLimit = calculatedTime > 0 ? Math.round(calculatedTime) : 15 * 60;

    const sessionId = buildSessionId('practice', subject.name);
    navigate(`/client/exam/${sessionId}`, {
      state: {
        examId: exam.id,
        title: exam.config?.title || exam.title,
        questions: qList,
        timeLimit: finalTimeLimit,
        mode: 'practice',
        subjectName: subject.name,
        examSessionCode: sessionId
      }
    });
  };

  const openSimulationModal = async (subject) => {
    let totalQuestionsCount = 0;
    const exams = subject.exams || [];
    for (const ex of exams) {
      if (ex.questions?.length > 0) {
        totalQuestionsCount += ex.questions.length;
      } else if (ex.questionCount > 0) {
        totalQuestionsCount += ex.questionCount;
      }
    }
    if (totalQuestionsCount === 0 && exams.length > 0) {
      for (const ex of exams) {
        const qs = await storageV2.loadQuestionsV2(ex.id);
        if (qs && qs.length > 0) totalQuestionsCount += qs.length;
      }
    }
    if (totalQuestionsCount === 0) {
      alert('Môn học này chưa có câu hỏi nào!');
      return;
    }
    setSimSubject(subject);
    setSimMode('random');
    setSelectedExamIds([]);
    setShowExamSelectModal(true);
  };

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

  const toggleExamSelect = (examId) => {
    setSelectedExamIds(prev =>
      prev.includes(examId) ? prev.filter(id => id !== examId) : [...prev, examId]
    );
  };

  const selectAllExams = () => setSelectedExamIds((simSubject?.exams || []).map(ex => ex.id));
  const deselectAllExams = () => setSelectedExamIds([]);

  const handleConfirmSimulation = async () => {
    if (enteredCode !== verificationCode) {
      alert('Mã xác nhận chưa chính xác!');
      return;
    }
    setShowSimModal(false);
    const exams = simSubject?.exams || [];
    let questionPool = [];
    const targetExams = simMode === 'random' ? exams : exams.filter(ex => selectedExamIds.includes(ex.id));

    for (const ex of targetExams) {
      let qs = ex.questions || [];
      if ((!qs || qs.length === 0) && ex.id) {
        qs = (await storageV2.loadQuestionsV2(ex.id)) || [];
      }
      if (qs.length > 0) questionPool.push(...qs);
    }

    const shuffled = [...questionPool].sort(() => 0.5 - Math.random());
    const simulationQuestions = shuffled.slice(0, 50);
    let simTitle = 'Khảo thí mô phỏng: ' + simSubject.name;
    if (simMode === 'selected' && selectedExamIds.length > 0) {
      const selectedNames = targetExams.map(ex => ex.config?.title || ex.title).join(', ');
      simTitle = `Khảo thí mô phỏng: ${simSubject.name} (${selectedNames})`;
    }
    const sessionId = buildSessionId('simulation', simSubject.name);
    navigate(`/client/exam/${sessionId}`, {
      state: {
        examId: 'sim_' + Date.now(),
        title: simTitle,
        questions: simulationQuestions,
        timeLimit: (simulationQuestions.length > 0 ? simulationQuestions.length : 50) * 60,
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

  return {
    // State
    subjects, isLoading,
    selectedSubject, showPracticeModal, setShowPracticeModal,
    showExamSelectModal, setShowExamSelectModal,
    showSimModal, setShowSimModal,
    simSubject, simMode, setSimMode,
    selectedExamIds,
    verificationCode, enteredCode, setEnteredCode,
    isEnteringCoding, codingStep,
    examResults, filteredResults, isLoadingResults,
    resultsFilter, setResultsFilter,
    // Cooldown & Permissions
    isUnlimited, cooldownRemaining,
    cooldownFormatted: formatCooldownTime(cooldownRemaining),
    // Computed
    totalAttempts, avgScore, passRate,
    // Auth
    currentUser, activeRole,
    CODING_MAINTENANCE,
    // Handlers
    handleLogout, handleSwitchToAdmin,
    handleEnterCoding,
    startPractice, openPracticeList,
    openSimulationModal, handleProceedToConfirm,
    toggleExamSelect, selectAllExams, deselectAllExams,
    handleConfirmSimulation,
    handleViewResult,
  };
}
