import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { storage } from '../utils/storage';

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

  // Load subjects từ Firestore
  useEffect(() => {
    localStorage.removeItem('qm_active_session');
    setIsLoading(true);
    storage.loadSubjects()
      .then(data => setSubjects(data.filter(s => s.isActive !== false)))
      .catch(err => console.error('Error loading subjects:', err))
      .finally(() => setIsLoading(false));
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

  const startPractice = (subject, exam) => {
    const sessionId = buildSessionId('practice', subject.name);
    navigate(`/client/exam/${sessionId}`, {
      state: {
        examId: exam.id,
        title: exam.config?.title || exam.title,
        questions: exam.questions,
        timeLimit: (exam.questions.length * 1.5) * 60,
        mode: 'practice',
        subjectName: subject.name,
        examSessionCode: sessionId
      }
    });
  };

  const openSimulationModal = (subject) => {
    const allQuestions = [];
    (subject.exams || []).forEach(ex => {
      if (ex.questions?.length > 0) allQuestions.push(...ex.questions);
    });
    if (allQuestions.length === 0) {
      alert('Môn học này chưa có câu hỏi nào! (Mã lỗi: DASH-01)');
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

  const handleConfirmSimulation = () => {
    if (enteredCode !== verificationCode) {
      alert('Mã xác nhận chưa chính xác! (Mã lỗi: DASH-02)');
      return;
    }
    setShowSimModal(false);
    const exams = simSubject?.exams || [];
    let questionPool = [];
    if (simMode === 'random') {
      exams.forEach(ex => { if (ex.questions?.length > 0) questionPool.push(...ex.questions); });
    } else {
      exams.filter(ex => selectedExamIds.includes(ex.id))
        .forEach(ex => { if (ex.questions?.length > 0) questionPool.push(...ex.questions); });
    }
    const shuffled = [...questionPool].sort(() => 0.5 - Math.random());
    const simulationQuestions = shuffled.slice(0, 50);
    let simTitle = 'Khảo thí mô phỏng: ' + simSubject.name;
    if (simMode === 'selected' && selectedExamIds.length > 0) {
      const selectedNames = exams
        .filter(ex => selectedExamIds.includes(ex.id))
        .map(ex => ex.config?.title || ex.title).join(', ');
      simTitle = `Khảo thí mô phỏng: ${simSubject.name} (${selectedNames})`;
    }
    const sessionId = buildSessionId('simulation', simSubject.name);
    navigate(`/client/exam/${sessionId}`, {
      state: {
        examId: 'sim_' + Date.now(),
        title: simTitle,
        questions: simulationQuestions,
        timeLimit: 50 * 60,
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
