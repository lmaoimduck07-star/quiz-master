import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { storage } from '../utils/storage';
import { storageV2 } from '../utils/storageV2';
import { setPracticeCooldown, isUserUnlimited } from '../utils/cooldownManager';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { AlertTriangle, Clock, Flag, Lock, Play, CheckCircle2, ShieldAlert, Loader2 } from 'lucide-react';

const isSessionExpired = (code) => {
  if (!code) return false;
  try {
    const expired = JSON.parse(localStorage.getItem('qm_expired_sessions') || '[]');
    return expired.includes(code);
  } catch {
    return false;
  }
};

const markSessionAsExpired = (code) => {
  if (!code) return;
  try {
    const expired = JSON.parse(localStorage.getItem('qm_expired_sessions') || '[]');
    if (!expired.includes(code)) {
      expired.push(code);
      localStorage.setItem('qm_expired_sessions', JSON.stringify(expired));
    }
  } catch (e) {
    console.error('[Session] Error marking session as expired:', e);
  }
};

// Xóa mã khỏi danh sách expired (dùng khi session mới được tạo với mã chưa từng dùng)
// Đây là lớp bảo vệ tránh lỗi "Session không hợp lệ" do mã trùng cực hiếm
const clearExpiredSession = (code) => {
  if (!code) return;
  try {
    const expired = JSON.parse(localStorage.getItem('qm_expired_sessions') || '[]');
    const filtered = expired.filter(c => c !== code);
    if (filtered.length !== expired.length) {
      localStorage.setItem('qm_expired_sessions', JSON.stringify(filtered));
      console.warn('[Session] Cleared stale expired marker for new session:', code);
    }
  } catch (e) {
    console.error('[Session] Error clearing expired session:', e);
  }
};

// Chuyển ký tự xuống dòng \n thành <br> để render đúng trong HTML
const formatQuestionText = (text) => {
  if (!text) return '';
  return text.replace(/\n/g, '<br>');
};

export default function MockExam() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId: urlSessionId } = useParams(); // Lấy sessionId từ URL nếu có
  const { currentUser } = useAuth();
  const { theme } = useTheme();

  // Load active session from localStorage if it matches current user and examId
  const savedSession = (() => {
    try {
      const sessionStr = localStorage.getItem('qm_active_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session.userId === currentUser?.id) {
          // ưu tiên session có sessionId khớp URL
          if (urlSessionId && session.examSessionCode === urlSessionId) return session;
          // Fallback: nếu URL không có sessionId, khớp examId
          if (!urlSessionId && (!location.state || location.state.examId === session.examId)) return session;
        }
      }
    } catch (e) {
      console.error('[Session] Error parsing active session:', e);
    }
    return null;
  })();

  // Extract state passed from ClientDashboard or fall back to saved session
  const examData = savedSession?.examData || location.state || null;
  const { examId, title, timeLimit: rawTimeLimit, mode, subjectName } = examData || {};
  const timeLimit = rawTimeLimit || (examData?.config?.time ? examData.config.time * 60 : 15 * 60);

  const [questions, setQuestions] = useState(() => examData?.questions?.filter(Boolean) || []);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(() => (examData?.questions?.filter(Boolean)?.length || 0) === 0);

  useEffect(() => {
    if (examId && questions.length === 0) {
      setIsLoadingQuestions(true);
      storageV2.loadQuestionsV2(examId).then((qs) => {
        if (qs && qs.length > 0) {
          setQuestions(qs);
        }
        setIsLoadingQuestions(false);
      }).catch(err => {
        console.error('[MockExam] Error loading V2 questions:', err);
        setIsLoadingQuestions(false);
      });
    }
  }, [examId, questions.length]);

  // ưu tiên sessionId từ URL, sau đó mới tới location.state, sau cùng mới tự sinh
  const [examSessionCode] = useState(() => {
    const code = urlSessionId
      || savedSession?.examSessionCode
      || location.state?.examSessionCode
      || `exam_${currentUser?.id || 'guest'}_${examId || 'quiz'}`;
    // Nếu session đến từ ClientDashboard (location.state có mã mới) → xóa cờ expired cũ nếu có
    // Điều này ngăn lỗi "Session không hợp lệ" do trùng mã hiếm gặp
    if (location.state?.examSessionCode) {
      clearExpiredSession(location.state.examSessionCode);
    }
    return code;
  });

  const [isInvalidSession] = useState(() => {
    const code = savedSession?.examSessionCode || location.state?.examSessionCode;
    return isSessionExpired(code);
  });

  const [timeLeft, setTimeLeft] = useState(() => savedSession ? savedSession.timeLeft : timeLimit);
  const [answers, setAnswers] = useState(() => savedSession ? savedSession.answers : {});
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [warningCount, setWarningCount] = useState(() => savedSession ? savedSession.warningCount : 0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningText, setWarningText] = useState('');
  const [startingExam, setStartingExam] = useState(false); // loading state khi verify trước khi bắt đầu
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const isSubmittedRef = useRef(false);
  const warningCountRef = useRef(savedSession ? savedSession.warningCount : 0);
  const lastWarningTimeRef = useRef(0);
  const answersRef = useRef(savedSession ? savedSession.answers : {});
  const timeLeftRef = useRef(savedSession ? savedSession.timeLeft : timeLimit);

  const [flagged, setFlagged] = useState(() => savedSession?.flagged || []);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const examPassword = examData?.password || examData?.config?.password || '';
  const [screen, setScreen] = useState(() => {
    if (savedSession) return 'quiz';
    if (examPassword) return 'login';
    return 'start';
  });

  const toggleFlag = (qNum) => {
    setFlagged(prev => prev.includes(qNum) ? prev.filter(n => n !== qNum) : [...prev, qNum]);
  };

  const handlePasswordSubmit = (e) => {
    if (e) e.preventDefault();
    if (passwordInput === examPassword) {
      setPasswordError(false);
      setScreen('start');
    } else {
      setPasswordError(true);
    }
  };

  // Sync state to refs to prevent stale closure bugs in anti-cheat event listeners
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  const isLockOrDeletedRef = useRef(false);
  const [isDeletedByAdmin, setIsDeletedByAdmin] = useState(false);

  // Khôi phục trạng thái bị khóa từ xa khi reload trang
  // Dùng lại pattern qm_expired_sessions đã có sẵn trong file
  const [isTerminatedByAdmin, setIsTerminatedByAdmin] = useState(() => {
    const code = savedSession?.examSessionCode || location.state?.examSessionCode;
    const expired = code ? isSessionExpired(code) : false;
    if (expired) isLockOrDeletedRef.current = true;
    return expired;
  });
  const [actionLogs, setActionLogs] = useState([]);

  const logAction = (detail) => {
    const entry = {
      time: new Date().toLocaleTimeString('vi-VN'),
      detail
    };
    setActionLogs(prev => [entry, ...prev].slice(0, 30));
  };

  const lastAdminMsgTimeRef = useRef(null);
  const submitExamRef = useRef(null);

  // ── BroadcastChannel: Ch\u1ed1ng m\u1edf 2 tab cho ch\u1ebf \u0111\u1ed9 SIMULATION \u2014 Practice kh\u00f4ng c\u1ea7n ──
  const [isBlockedByDupTab, setIsBlockedByDupTab] = useState(false);
  useEffect(() => {
    if (mode !== 'simulation' || !examSessionCode) return;
    const channelName = `qm_sim_${examSessionCode}`;
    let bc;
    try {
      bc = new BroadcastChannel(channelName);
    } catch {
      return; // Tr\u00ecnh duy\u1ec7t kh\u00f4ng h\u1ed7 tr\u1ee3 BroadcastChannel — b\u1ecf qua
    }
    // Ph\u00e1t tin hi\u1ec7u "tab n\u00e0y \u0111\u00e3 ch\u1ee7 \u0111\u1ed9ng" ngay khi mount
    bc.postMessage({ type: 'HELLO', from: 'new_tab' });
    // L\u1eafng nghe khi c\u00f3 tab kh\u00e1c ph\u00e1t hi\u1ec7u
    bc.onmessage = (e) => {
      if (e.data?.type === 'HELLO') {
        // Tab n\u00e0y \u0111\u00e3 ch\u1ea1y tr\u01b0\u1edbc \u2192 b\u00e1o tab m\u1edbi r\u1eb1ng \u0111\u00e3 c\u00f3 tab master
        bc.postMessage({ type: 'DUPLICATE_REJECTED' });
      }
      if (e.data?.type === 'DUPLICATE_REJECTED') {
        // Tab n\u00e0y b\u1ecb block v\u00ec \u0111\u00e3 c\u00f3 tab kh\u00e1c ch\u1ea1y tr\u01b0\u1edbc
        setIsBlockedByDupTab(true);
      }
    };
    return () => { try { bc.close(); } catch {} };
  }, [mode, examSessionCode]);

  // ── Instant Realtime Sync: Chỉ sync khi Thảo tác quan trọng thay đổi (answers, flagged, warnings, câu hỏi, vi phạm)
  // KHÔNG bao gồm timeLeft (đồng hồ chuyển riêng sang Heartbeat 15s dưới)
  useEffect(() => {
    if (isSubmittedRef.current || isInvalidSession || isTerminatedByAdmin || isDeletedByAdmin || isLockOrDeletedRef.current) return;
    try {
      // Sync LocalStorage (giử toàn bộ state cho Reload Recovery)
      const session = {
        userId: currentUser?.id,
        examId,
        examData,
        answers,
        flagged,
        timeLeft: timeLeftRef.current,
        warningCount,
        examSessionCode
      };
      localStorage.setItem('qm_active_session', JSON.stringify(session));

      // Push ngay lập tức lên Firestore (< 100ms) khi học sinh thao tác
      if (examSessionCode) {
        const answeredGrid = {};
        questions.forEach((_, idx) => {
          const qNum = idx + 1;
          if (answers && answers[qNum] !== undefined) answeredGrid[qNum] = 'answered';
          else if (flagged && flagged.includes(qNum)) answeredGrid[qNum] = 'flagged';
          else answeredGrid[qNum] = 'unanswered';
        });

        storage.updateActiveSession(examSessionCode, {
          sessionId: examSessionCode,
          userId: currentUser?.id || 'guest',
          studentName: currentUser?.fullName || currentUser?.username || 'Học sinh',
          examId,
          examTitle: examData?.title || title || 'Bài thi trắc nghiệm',
          mode: mode || 'simulation',
          currentQuestion: currentQuestion || 1,
          totalQuestions: (questions && questions.length) ? questions.length : 1,
          answeredCount: answers ? Object.keys(answers).length : 0,
          answeredGrid,
          actionLogs,
          timeLeft: timeLeftRef.current,
          warningCount: warningCount || 0,
          status: 'online',
        });
      }
    } catch (e) {
      console.error('[Session] Error saving active session:', e);
    }
  }, [answers, flagged, warningCount, currentUser, examId, examData, examSessionCode, isInvalidSession, currentQuestion, questions, title, mode, actionLogs, isTerminatedByAdmin, isDeletedByAdmin]);

  // ── Heartbeat 15s: Chỉ gửi lastActive + timeLeft, không spam toàn bộ state ──
  useEffect(() => {
    if (screen !== 'quiz' || !examSessionCode) return;
    if (isSubmittedRef.current || isLockOrDeletedRef.current) return;

    const hb = setInterval(() => {
      if (isSubmittedRef.current || isLockOrDeletedRef.current) return;
      storage.updateActiveSession(examSessionCode, {
        lastActive: new Date().toISOString(),
        timeLeft: timeLeftRef.current,
        status: 'online',
      });
    }, 15000);

    return () => clearInterval(hb);
  }, [screen, examSessionCode]);

  // Lắng nghe lệnh từ xa của Admin (Live Monitor: Khóa từ xa / Xóa thẻ / Nhắc nhở)
  useEffect(() => {
    if (!examSessionCode) return;

    // Theo dõi xem session đã từng xuất hiện trong Firestore chưa
    // Để phân biệt "chưa tạo" vs "đã bị xóa"
    const hasSeenSessionRef = { current: false };

    const unsub = storage.subscribeActiveSessions((allSessions) => {
      const mySession = allSessions.find(s => s.id === examSessionCode);

      if (mySession) {
        // Session tồn tại — đánh dấu đã thấy
        hasSeenSessionRef.current = true;

        if (mySession.status === 'terminated' && !isSubmittedRef.current) {
          // Persist trạng thái bị khóa vào localStorage để reload không bypass được
          isLockOrDeletedRef.current = true;
          markSessionAsExpired(examSessionCode);
          localStorage.removeItem('qm_active_session');
          setIsTerminatedByAdmin(true);
          if (typeof submitExamRef.current === 'function') {
            submitExamRef.current(warningCountRef.current, 'Bị khóa từ xa');
          }
        } else if (mySession.status === 'deleted' && !isSubmittedRef.current) {
          isLockOrDeletedRef.current = true;
          markSessionAsExpired(examSessionCode);
          localStorage.removeItem('qm_active_session');
          setIsDeletedByAdmin(true);
          storage.removeActiveSession(examSessionCode);
        } else if (mySession.adminMessage && mySession.adminMessageTime !== lastAdminMsgTimeRef.current) {
          lastAdminMsgTimeRef.current = mySession.adminMessageTime;
          alert(`💬 THÔNG BÁO TỪ GIÁM THỊ:\n"${mySession.adminMessage}"`);
        }
      } else if (hasSeenSessionRef.current && !isSubmittedRef.current && !isLockOrDeletedRef.current) {
        // Session đã từng tồn tại nhưng bây giờ bị xóa khỏi Firestore bởi Admin
        isLockOrDeletedRef.current = true;
        markSessionAsExpired(examSessionCode);
        localStorage.removeItem('qm_active_session');
        setIsDeletedByAdmin(true);
        storage.removeActiveSession(examSessionCode);
      }
    });

    return () => {
      if (typeof unsub === 'function') unsub();
    };

  }, [examSessionCode]);

  const isReloadingRef = useRef(false);

  useEffect(() => {
    const handleBeforeUnload = () => {
      isReloadingRef.current = true;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    return () => {
      // Nếu rời khỏi trang (không phải do reload) và chưa nộp bài:
      // Đẩy status: 'abandoned' lên Firestore để Admin thấy ⋄️ Rời phòng
      if (!isReloadingRef.current && !isSubmittedRef.current && !isInvalidSession && examSessionCode && !isLockOrDeletedRef.current) {
        markSessionAsExpired(examSessionCode);
        localStorage.removeItem('qm_active_session');
        // Giữ lại session trên Firestore nhưng chuyển sang trạng thái abandoned
        storage.updateActiveSession(examSessionCode, {
          status: 'abandoned',
          abandonedAt: new Date().toISOString(),
          abandonedReason: 'Học sinh tự ý thoát / Lùi trang',
        });
      }
    };
  }, [examSessionCode, isInvalidSession]);

  const updateWarningCount = (val) => {
    warningCountRef.current = val;
    setWarningCount(val);
  };

  // Timer
  useEffect(() => {
    if (screen !== 'quiz') return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!isSubmittedRef.current) {
            alert('Hết giờ làm bài! Hệ thống tự động nộp bài. (Mã lỗi: SIM-01)');
            submitExam(warningCountRef.current, 'Hết giờ');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [screen]);

  // Request fullscreen on mount & Exit on unmount (cleanup)
  useEffect(() => {
    if (mode !== 'simulation') return;

    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log("Programmatic fullscreen request blocked on mount.", err);
      });
    }

    return () => {
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.log(err));
      }
    };
  }, [mode]);

  // Tab surveillance & window size checking
  useEffect(() => {
    if (mode !== 'simulation') return;

    const triggerWarning = (reason) => {
      const now = Date.now();
      // Cooldown to prevent multi-triggering
      if (now - lastWarningTimeRef.current < 3000) return;
      lastWarningTimeRef.current = now;

      const next = warningCountRef.current + 1;
      updateWarningCount(next);

      if (next >= 3) {
        isSubmittedRef.current = true;
        alert(`Bạn đã vi phạm rời phòng thi 3 lần (${reason}). Hệ thống tự động nộp bài thi! (Mã lỗi: SIM-02)`);
        submitExam(next, `Vi phạm 3 lần: ${reason}`);
      } else {
        setWarningText(reason);
        setShowWarning(true);
        storage.addAuditLog({
          user: currentUser?.username || 'student',
          role: 'Student',
          category: 'Security',
          action: `CẢNH BÁO: Rời màn hình lần ${next} (${reason}) - Đề: ${title}`,
          severity: 'Warning'
        });
        setTimeout(() => setShowWarning(false), 4000);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        triggerWarning("Chuyển tab hoặc ẩn trình duyệt");
      }
    };

    const handleBlur = () => {
      triggerWarning("Rời tiêu điểm cửa sổ thi (click bên ngoài)");
    };

    const handleResize = () => {
      if (window.innerWidth < 1024 || window.innerHeight < 600) {
        triggerWarning("Cửa sổ quá nhỏ hoặc chia đôi màn hình");
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !isSubmittedRef.current) {
        triggerWarning("Thoát chế độ toàn màn hình (Fullscreen)");
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Initial check
    if (window.innerWidth < 1024 || window.innerHeight < 600) {
      triggerWarning("Cửa sổ quá nhỏ để thi");
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [currentUser, title, mode]);

  const submitExam = async (finalWarnings = warningCount, reason = 'Chủ động') => {
    submitExamRef.current = submitExam;
    if (isSubmittedRef.current && reason === 'Chủ động') return; // Tránh chạy 2 lần
    isSubmittedRef.current = true;

    // Calculate score
    let correctCount = 0;
    const reviewedQuestions = questions.map((q, index) => {
      const qNum = index + 1;
      const userAnswer = answersRef.current[qNum];
      const qType = q.type || 'single';
      let isCorrect = false;
      let correctAnswer = null;

      if (qType === 'single') {
        correctAnswer = q.answer !== undefined ? q.answer : q.correct;
        isCorrect = userAnswer === correctAnswer;
      }
      else if (qType === 'multiselect') {
        correctAnswer = q.corrects || [];
        const uArr = userAnswer || [];
        isCorrect = uArr.length === correctAnswer.length && uArr.every(x => correctAnswer.includes(x));
      }
      else if (qType === 'fill') {
        correctAnswer = q.answer || '';
        isCorrect = userAnswer !== undefined && userAnswer !== null &&
          userAnswer.toString().trim().toLowerCase() === correctAnswer.toString().trim().toLowerCase();
      }
      else if (qType === 'truefalse') {
        correctAnswer = q.correct;
        isCorrect = userAnswer === correctAnswer;
      }
      else if (qType === 'drag') {
        correctAnswer = q.pairs || [];
        const validPairs = (q.pairs || []).filter(p => p.left && p.left.toString().trim() !== '');
        isCorrect = validPairs.length > 0 && validPairs.every(p => (userAnswer || {})[p.left] === p.right);
      }
      else if (qType === 'groupdrag') {
        correctAnswer = q.groups || [];
        isCorrect = (q.groups || []).every(g =>
          (g.items || []).every(item => (userAnswer || {})[item] === g.name)
        );
      }
      else if (qType === 'clozedrag') {
        correctAnswer = q.answers || [];
        const clozeUser = userAnswer || [];
        isCorrect = correctAnswer.length > 0 && correctAnswer.every((ans, idx) => clozeUser[idx] === ans);
      }
      else if (qType === 'order') {
        correctAnswer = q.items || [];
        const userWords = (userAnswer || []).map(idx => q.items[idx]);
        isCorrect = correctAnswer.length > 0 &&
          correctAnswer.length === userWords.length &&
          correctAnswer.every((item, idx) => userWords[idx] === item);
      }
      else if (qType === 'multitruefalse') {
        correctAnswer = q.statements || [];
        const stmts = q.statements || [];
        if (stmts.length > 0) {
          const userMap = userAnswer || {}; // { [index]: boolean }
          const correctCount2 = stmts.filter((s, idx) => userMap[idx] === s.correct).length;
          // partial credit: số phát biểu đúng / tổng phát biểu
          const ratio = correctCount2 / stmts.length;
          correctCount += ratio; // đóng góp dạng phân số vào tổng
          isCorrect = ratio === 1;
        }
      }

      if (qType !== 'multitruefalse' && isCorrect) correctCount++;

      return {
        id: q.id,
        type: qType,
        text: q.content || q.question,
        options: q.options || [],
        userAnswer: userAnswer !== undefined ? userAnswer : null,
        correctAnswer: correctAnswer,
        isCorrect: isCorrect,
        pairs: q.pairs,
        groups: q.groups,
        answers: q.answers,
        items: q.items,
        statements: q.statements,
      };
    });

    const score = parseFloat(((correctCount / questions.length) * 10).toFixed(1));
    const timeTaken = timeLimit - timeLeftRef.current;

    // Save exam result to localStorage
    const results = JSON.parse(localStorage.getItem('qm_exam_results') || '[]');
    const newResult = {
      id: 'res_' + Date.now(),
      examId,
      title,
      subjectName,
      mode: mode || 'practice',
      userId: currentUser?.id,
      score,
      timeTaken,
      correctCount,
      totalCount: questions.length,
      warnings: finalWarnings,
      date: new Date().toLocaleDateString('vi-VN'),
      questions: reviewedQuestions
    };
    results.unshift(newResult);
    localStorage.setItem('qm_exam_results', JSON.stringify(results));
    storage.saveExamResult(newResult);

    // Kích hoạt cooldown 10 phút nếu là bài luyện tập và user không phải Unlimited
    if ((mode || 'practice') === 'practice' && !isUserUnlimited(currentUser)) {
      setPracticeCooldown(currentUser?.id);
    }

    // Clear active exam session
    localStorage.removeItem('qm_active_session');
    markSessionAsExpired(examSessionCode);
    await storage.removeActiveSession(examSessionCode);

    // Audit log
    storage.addAuditLog({
      user: currentUser?.username || 'student',
      role: 'Student',
      category: 'Exam',
      action: `Nộp bài thi: ${title} | Điểm: ${score}/10 | Vi phạm: ${finalWarnings} lần | Lí do: ${reason}`,
      severity: finalWarnings >= 3 ? 'Warning' : 'Info'
    });

    // Exit fullscreen if active
    if (document.exitFullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.log("Exit fullscreen error:", err));
    }

    const reviewPayload = {
      title,
      score,
      correctCount,
      totalCount: questions.length,
      questions: reviewedQuestions
    };
    try {
      sessionStorage.setItem('qm_last_review_data', JSON.stringify(reviewPayload));
    } catch (_) {}

    // Navigate to review page with replace: true so back button goes to dashboard
    navigate('/client/review', {
      state: reviewPayload,
      replace: true
    });
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isWarningTime = timeLeft < 300;

  if (isLoadingQuestions) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-400 mx-auto mb-4" />
        <p className="font-bold text-slate-400">Đang nạp dữ liệu đề thi từ V2...</p>
      </div>
    );
  }

  if (!examData) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-400 mb-4 animate-bounce" />
        <h2 className="text-xl font-bold mb-2">Chưa có bài thi nào được chọn</h2>
        <p className="text-slate-400 text-sm mb-6 max-w-md">Vui lòng chọn môn học và bài thi thực tế từ trang chính để bắt đầu làm bài.</p>
        <Button onClick={() => navigate('/client/dashboard')} className="font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-2.5 shadow-md border-transparent">
          Quay về Trang chính
        </Button>
      </div>
    );
  }

  // Chặn mở 2 tab cho chế độ Simulation
  if (isBlockedByDupTab) {
    return (
      <div className="fixed inset-0 z-[999999] bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="max-w-sm w-full bg-slate-900 border-2 border-red-500/60 rounded-3xl p-8 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
          <div className="w-20 h-20 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="h-10 w-10 text-red-400 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-white uppercase tracking-tight">Phiên thi đang mở ở tab khác!</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Bài thi mô phỏng này <strong className="text-red-400">đang được mở ở một cửa sổ/tab khác</strong>.
              Vui lòng đóng tab này và quay lại tab đang làm bài để tiếp tục.
            </p>
          </div>
          <div className="bg-red-950/30 border border-red-900/40 rounded-2xl px-4 py-3 text-xs font-bold text-red-400">
            🔒 Hệ thống chỉ cho phép 1 tab duy nhất cho mỗi phiên thi mô phỏng.
          </div>
          <Button
            onClick={() => window.close()}
            className="w-full font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 border-transparent shadow-md"
          >
            Đóng tab này
          </Button>
        </div>
      </div>
    );
  }

  if (isInvalidSession || isDeletedByAdmin) {
    return (
      <div className="fixed inset-0 z-[999999] bg-slate-950/98 backdrop-blur-2xl text-white flex flex-col items-center justify-center p-6 text-center select-none pointer-events-auto">
        <Card className="max-w-md w-full border border-amber-500/40 shadow-2xl rounded-3xl overflow-hidden bg-slate-900 text-slate-100 animate-in zoom-in-95 duration-200">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <AlertTriangle className="h-10 w-10 animate-bounce text-amber-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white m-0 uppercase tracking-tight">Session không hợp lệ</h2>
              <div className="inline-block bg-amber-500/20 text-amber-400 font-extrabold text-xs px-3 py-1 rounded-full border border-amber-500/40">
                Không thể tiếp tục làm bài
              </div>
            </div>
            <p className="text-xs text-slate-300 font-medium leading-relaxed bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
              Session không hợp lệ, vui lòng liên hệ admin để được hỗ trợ
            </p>

            <div className="pt-2">
              <Button
                onClick={() => navigate('/client/dashboard')}
                className="w-full font-bold h-12 bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-md transition duration-150 border-transparent text-sm"
              >
                Quay lại Trang chính
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isTerminatedByAdmin) {
    return (
      <div className="fixed inset-0 z-[999999] bg-slate-950/98 backdrop-blur-2xl text-white flex flex-col items-center justify-center p-6 text-center select-none pointer-events-auto">
        <div className="p-8 bg-red-950/40 border-2 border-red-600 rounded-3xl max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
          <Lock className="h-16 w-16 text-red-500 mx-auto animate-bounce" />
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white m-0 uppercase tracking-tight">BÀI THI ĐÃ BỊ KHÓA TỪ XA</h2>
            <div className="inline-block bg-red-500/20 text-red-400 font-extrabold text-xs px-3 py-1 rounded-full border border-red-500/40">
              Giám thị đã dừng bài thi
            </div>
          </div>
          <p className="text-xs text-slate-300 font-medium leading-relaxed bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
            Bài thi của bạn đã bị Giám thị dừng và khóa trực tiếp từ xa do vi phạm quy chế thi. Hệ thống đã thu bài và chốt điểm tự động tại thời điểm bị khóa. Bạn không thể thao tác tiếp.
          </p>
          <Button
            onClick={() => navigate('/client/dashboard')}
            className="w-full font-bold h-12 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg border-transparent text-sm"
          >
            Quay về Trang chính
          </Button>
        </div>
      </div>
    );
  }

  if (screen === 'login') {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-2xl rounded-3xl overflow-hidden">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 text-blue-500 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto border border-blue-200 dark:border-blue-700/50 shadow-inner">
              <Lock className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Mật khẩu bảo vệ</h2>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">Bài thi này yêu cầu nhập mật khẩu để truy cập</p>
            </div>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Nhập mật khẩu bài thi..."
                className="w-full p-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-center text-lg font-bold outline-none focus:border-blue-500 transition-colors text-slate-900 dark:text-white"
                autoFocus
              />
              {passwordError && (
                <p className="text-red-500 dark:text-red-400 text-xs font-bold animate-shake">⚠️ Mật khẩu không chính xác. Vui lòng thử lại!</p>
              )}
              <Button type="submit" className="w-full font-bold h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg transition">
                Xác nhận & Bắt đầu thi
              </Button>
            </form>
            <button onClick={() => navigate('/client/dashboard')} className="text-slate-500 dark:text-slate-400 text-xs font-bold hover:underline">
              Quay lại Trang chủ
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (screen === 'start') {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex items-center justify-center p-4">
        <Card className="max-w-xl w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
          <CardContent className="p-8 md:p-10 text-center space-y-6">
            <div className="text-6xl mb-2">📝</div>
            <div>
              <span className="text-xs font-bold text-blue-500 dark:text-blue-400 uppercase tracking-widest">Môn học: {subjectName || 'Bài thi tổng hợp'}</span>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-1 mb-2">{title}</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">Sẵn sàng để bắt đầu bài làm thi thực tế</p>
            </div>

            <div className="flex justify-center gap-4 text-slate-600 dark:text-slate-300 font-bold text-sm">
              <div className="bg-slate-100 dark:bg-slate-900/80 px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-2 shadow-inner">
                <Clock className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                <span>{Math.floor(timeLimit / 60)} Phút</span>
              </div>
              <div className="bg-slate-100 dark:bg-slate-900/80 px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-2 shadow-inner">
                <span className="text-blue-500 dark:text-blue-400 text-base font-black">❓</span>
                <span>{questions.length} Câu hỏi</span>
              </div>
            </div>

            {mode === 'simulation' && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-dashed border-amber-400 dark:border-amber-500/50 p-4 rounded-2xl text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-3 text-left shadow-sm">
                <ShieldAlert className="h-6 w-6 text-amber-500 dark:text-amber-400 shrink-0" />
                <span>
                  <strong>Chế độ giám sát:</strong> Hệ thống sẽ tự động giám sát vi phạm và tự động nộp bài nếu bạn rời tiêu điểm cửa sổ thi hoặc thoát toàn màn hình 3 lần.
                </span>
              </div>
            )}

            <Button
              onClick={async () => {
                // ── Verify tươi từ Firestore trước khi vào thi ──
                if (examId) {
                  setStartingExam(true);
                  try {
                    const freshExam = await storageV2.getExamV2(examId);
                    if (!freshExam) {
                      alert('❌ Không tìm thấy đề thi này. Vui lòng quay lại trang chủ.');
                      navigate('/client/dashboard');
                      return;
                    }
                    if (freshExam.isLocked) {
                      alert('🔒 Đề thi này đã bị Quản trị viên khóa! Vui lòng chọn bài thi khác.');
                      navigate('/client/dashboard');
                      return;
                    }
                    if (freshExam.isMaintenance) {
                      alert('🚧 Đề thi đang trong quá trình bảo trì! Vui lòng quay lại sau.');
                      navigate('/client/dashboard');
                      return;
                    }
                  } catch (err) {
                    console.warn('[MockExam] Không thể verify exam từ Firestore:', err);
                  } finally {
                    setStartingExam(false);
                  }
                }
                setScreen('quiz');
              }}
              disabled={startingExam}
              className="w-full font-black text-lg h-14 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-wait text-white rounded-2xl shadow-xl shadow-emerald-950/40 transition transform active:scale-98"
            >
              {startingExam ? '🔄 Đang kiểm tra...' : 'BẮT ĐẦU THI NGAY 🚀'}
            </Button>

            <button onClick={() => navigate('/client/dashboard')} className="text-slate-400 dark:text-slate-400 text-xs font-bold hover:underline">
              Quay lại Trang chủ
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between sticky top-0 z-20 shadow-sm transition-colors">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Môn học: {subjectName}</span>
          <span className="font-extrabold text-slate-800 dark:text-white text-base">{title}</span>
        </div>
        <div className={`flex items-center gap-2 text-2xl font-black ${isWarningTime ? 'text-red-500 animate-pulse' : 'text-primary dark:text-blue-400'}`}>
          <Clock className="h-6 w-6" />
          {formatTime(timeLeft)}
        </div>
        <Button variant="danger" className="font-bold px-6 bg-red-500 hover:bg-red-600 rounded-xl shadow-sm border-transparent" onClick={() => setShowSubmitModal(true)}>
          Nộp bài
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Navigation list */}
        <div className="w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 overflow-y-auto hidden lg:flex flex-col justify-between transition-colors">
          <div>
            <h3 className="font-bold mb-4 text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wider">Danh sách câu hỏi ({questions.length})</h3>
            <div className="grid grid-cols-5 gap-2 mb-6">
              {questions.map((_, i) => {
                const qNum = i + 1;
                const isAnswered = answers[qNum] !== undefined && answers[qNum] !== '' && (Array.isArray(answers[qNum]) ? answers[qNum].length > 0 : true);
                const isCurrent = currentQuestion === qNum;
                const isFlagged = flagged.includes(qNum);

                let btnClass = "h-10 w-10 rounded-xl font-bold text-xs transition-all border flex items-center justify-center relative ";
                if (isFlagged) {
                  btnClass += "bg-red-500 text-white border-red-600 shadow-md shadow-red-500/20 font-black ";
                } else if (isCurrent) {
                  btnClass += "border-blue-600 dark:border-blue-500 ring-2 ring-blue-500/30 scale-105 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-extrabold ";
                } else if (isAnswered) {
                  btnClass += "bg-emerald-500 dark:bg-emerald-600 text-white border-emerald-500 dark:border-emerald-600 shadow-sm shadow-emerald-500/20 ";
                } else {
                  btnClass += "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/50 ";
                }

                return (
                  <button
                    key={qNum}
                    className={btnClass}
                    onClick={() => setCurrentQuestion(qNum)}
                  >
                    {qNum}
                    {isFlagged && <span className="absolute -top-1 -right-1 text-[10px]">🚩</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Legend */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs font-semibold">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <span className="w-3.5 h-3.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"></span> Chưa làm
            </div>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <span className="w-3.5 h-3.5 rounded bg-emerald-500 text-white"></span> Đã làm
            </div>
            <div className="flex items-center gap-2 text-red-500">
              <span className="w-3.5 h-3.5 rounded bg-red-500 text-white"></span> Cần xem lại (🚩)
            </div>
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <span className="w-3.5 h-3.5 rounded bg-blue-50 dark:bg-blue-950 border-2 border-blue-500"></span> Đang xem
            </div>
          </div>
        </div>

        {/* Question display */}
        <div className="flex-1 overflow-y-auto p-8 flex justify-center items-start bg-slate-50 dark:bg-slate-950/60 transition-colors">
          <Card className="w-full max-w-3xl border-0 shadow-sm rounded-3xl overflow-hidden bg-white dark:bg-slate-900">
            <CardContent className="p-8">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                <span className="bg-primary/10 dark:bg-blue-900/20 text-primary dark:text-blue-400 px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider">
                  Câu {currentQuestion} / {questions.length}
                </span>
                <button
                  type="button"
                  onClick={() => toggleFlag(currentQuestion)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition ${flagged.includes(currentQuestion)
                      ? 'bg-red-500 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500'
                    }`}
                >
                  <Flag className="h-3.5 w-3.5" />
                  {flagged.includes(currentQuestion) ? 'Đã cắm cờ 🚩' : 'Cần xem lại 🚩'}
                </button>
              </div>

              <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 mb-8 leading-relaxed">
                <span dangerouslySetInnerHTML={{ __html: formatQuestionText(questions[currentQuestion - 1]?.content || questions[currentQuestion - 1]?.question || '') }} />
              </h2>

              {questions[currentQuestion - 1]?.image && (
                <img src={questions[currentQuestion - 1]?.image} alt="Question Graphic" className="max-w-full max-h-64 rounded-xl border border-slate-200 dark:border-slate-800 mb-6 mx-auto block shadow-sm" />
              )}

              <div className="space-y-4">
                {(() => {
                  const q = questions[currentQuestion - 1];
                  const qType = q?.type || 'single';

                  if (qType === 'single') {
                    return (q.options || []).map((opt, i) => {
                      const optImg = (q.optionImages && q.optionImages[i]) ? q.optionImages[i] : null;
                      return (
                        <label
                          key={i}
                          className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition ${answers[currentQuestion] === i ? 'border-primary bg-primary/5 dark:border-blue-500 dark:bg-blue-500/10' : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700'}`}
                        >
                          <input
                            type="radio"
                            name={`question-${currentQuestion}`}
                            className="w-5 h-5 text-primary dark:text-blue-500 border-slate-300 dark:border-slate-700 focus:ring-primary dark:focus:ring-blue-500 flex-shrink-0 mt-0.5"
                            checked={answers[currentQuestion] === i}
                            onChange={() => setAnswers(prev => ({ ...prev, [currentQuestion]: i }))}
                          />
                          <div className="flex flex-col flex-1">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: opt || '' }} />
                            {optImg && (
                              <img src={optImg} alt={`Option ${i + 1}`} className="mt-2 max-h-40 rounded-lg border border-slate-200 dark:border-slate-800 object-contain shadow-sm" />
                            )}
                          </div>
                        </label>
                      );
                    });
                  }

                  if (qType === 'multiselect') {
                    return (q.options || []).map((opt, i) => {
                      const currentAnswers = answers[currentQuestion] || [];
                      const isChecked = currentAnswers.includes(i);
                      const optImg = (q.optionImages && q.optionImages[i]) ? q.optionImages[i] : null;
                      return (
                        <label
                          key={i}
                          className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition ${isChecked ? 'border-primary bg-primary/5 dark:border-blue-500 dark:bg-blue-500/10' : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700'}`}
                        >
                          <input
                            type="checkbox"
                            name={`question-${currentQuestion}`}
                            className="w-5 h-5 text-primary dark:text-blue-500 border-slate-300 dark:border-slate-700 focus:ring-primary dark:focus:ring-blue-500 rounded flex-shrink-0 mt-0.5"
                            checked={isChecked}
                            onChange={() => {
                              const nextAnswers = isChecked
                                ? currentAnswers.filter(x => x !== i)
                                : [...currentAnswers, i];
                              setAnswers(prev => ({ ...prev, [currentQuestion]: nextAnswers }));
                            }}
                          />
                          <div className="flex flex-col flex-1">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: opt || '' }} />
                            {optImg && (
                              <img src={optImg} alt={`Option ${i + 1}`} className="mt-2 max-h-40 rounded-lg border border-slate-200 dark:border-slate-800 object-contain shadow-sm" />
                            )}
                          </div>
                        </label>
                      );
                    });
                  }

                  if (qType === 'fill') {
                    return (
                      <input
                        type="text"
                        className="w-full p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 focus:border-primary dark:focus:border-blue-500 focus:outline-none font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 transition-colors"
                        placeholder="Nhập câu trả lời của bạn..."
                        value={answers[currentQuestion] || ''}
                        onChange={(e) => setAnswers(prev => ({ ...prev, [currentQuestion]: e.target.value }))}
                      />
                    );
                  }

                  if (qType === 'truefalse') {
                    return (
                      <div className="flex gap-4">
                        {[true, false].map((val) => (
                          <label
                            key={val ? 'true' : 'false'}
                            className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition ${answers[currentQuestion] === val ? 'border-primary bg-primary/5 dark:border-blue-500 dark:bg-blue-500/10' : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700'}`}
                          >
                            <input
                              type="radio"
                              name={`question-${currentQuestion}`}
                              className="w-5 h-5 text-primary dark:text-blue-500 border-slate-300 dark:border-slate-700 focus:ring-primary dark:focus:ring-blue-500 flex-shrink-0"
                              checked={answers[currentQuestion] === val}
                              onChange={() => setAnswers(prev => ({ ...prev, [currentQuestion]: val }))}
                            />
                            <span className="text-base font-extrabold text-slate-700 dark:text-slate-300">{val ? 'ĐÚNG' : 'SAI'}</span>
                          </label>
                        ))}
                      </div>
                    );
                  }

                  if (qType === 'multitruefalse') {
                    const stmts = q.statements || [];
                    const userMap = answers[currentQuestion] || {};
                    return (
                      <div className="flex flex-col gap-3">
                        {stmts.map((stmt, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                            <span className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-300">{stmt.text}</span>
                            <div className="flex gap-2 flex-shrink-0">
                              <button
                                onClick={() => setAnswers(prev => ({ ...prev, [currentQuestion]: { ...(prev[currentQuestion] || {}), [idx]: true } }))}
                                className={`px-4 py-2 rounded-xl font-bold text-sm transition border-2 ${
                                  userMap[idx] === true
                                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:text-emerald-600'
                                }`}
                              >Đúng</button>
                              <button
                                onClick={() => setAnswers(prev => ({ ...prev, [currentQuestion]: { ...(prev[currentQuestion] || {}), [idx]: false } }))}
                                className={`px-4 py-2 rounded-xl font-bold text-sm transition border-2 ${
                                  userMap[idx] === false
                                    ? 'bg-red-500 text-white border-red-500 shadow-md'
                                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-red-400 hover:text-red-600'
                                }`}
                              >Sai</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }

                  if (qType === 'drag') {
                    const currentPairAnswers = answers[currentQuestion] || {}; // { [left]: right }
                    const validPairs = (q.pairs || []).filter(p => p.left && p.left.toString().trim() !== '');
                    const allRights = (q.pairs || []).map(p => p.right).filter(Boolean);
                    const usedRights = Object.values(currentPairAnswers);
                    const poolItems = allRights.filter(r => !usedRights.includes(r));

                    const handleDropToPair = (leftKey, rightVal) => {
                      if (!rightVal) return;
                      const next = { ...currentPairAnswers };
                      // Xóa giá trị này ở ô cũ nếu nó đang được gán (chống duplicate / ghost)
                      const existingLeftKey = Object.keys(next).find(k => next[k] === rightVal);
                      if (existingLeftKey && existingLeftKey !== leftKey) {
                        delete next[existingLeftKey];
                      }
                      next[leftKey] = rightVal;
                      setAnswers(prev => ({ ...prev, [currentQuestion]: next }));
                    };

                    const handleRemoveFromPair = (leftKey) => {
                      const next = { ...currentPairAnswers };
                      delete next[leftKey];
                      setAnswers(prev => ({ ...prev, [currentQuestion]: next }));
                    };

                    const handlePoolItemDoubleClick = (rVal) => {
                      const firstEmptyPair = validPairs.find(p => !currentPairAnswers[p.left]);
                      if (firstEmptyPair) {
                        handleDropToPair(firstEmptyPair.left, rVal);
                      }
                    };

                    return (
                      <div className="space-y-6">
                        {/* Ngân hàng từ khóa vế phải */}
                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const draggedText = e.dataTransfer.getData('text/plain');
                            const sourceLeftKey = Object.keys(currentPairAnswers).find(k => currentPairAnswers[k] === draggedText);
                            if (sourceLeftKey) handleRemoveFromPair(sourceLeftKey);
                          }}
                          className="bg-amber-50/70 dark:bg-amber-950/20 border-2 border-dashed border-amber-300 dark:border-amber-800/50 rounded-2xl p-5 shadow-inner"
                        >
                          <div className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-3 text-center">
                            🏷️ NGÂN HÀNG TỪ KHÓA (Kéo thả hoặc Nhấp đúp chuột 2 lần để chọn)
                          </div>
                          <div className="flex flex-wrap gap-2.5 justify-center items-center">
                            {poolItems.length > 0 ? (
                              poolItems.map((rVal, idx) => (
                                <div
                                  key={idx}
                                  draggable
                                  onDoubleClick={() => handlePoolItemDoubleClick(rVal)}
                                  onDragStart={(e) => e.dataTransfer.setData('text/plain', rVal)}
                                  className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 border-2 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-extrabold px-4 py-2 rounded-xl text-sm shadow-sm cursor-grab active:scale-95 transition select-none"
                                >
                                  {rVal}
                                </div>
                              ))
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">✓ Đã phân bổ hết tất cả từ khóa!</span>
                            )}
                          </div>
                        </div>

                        {/* Danh sách ghép cặp vế trái -> vế phải */}
                        <div className="space-y-3">
                          {validPairs.map((p, idx) => {
                            const assignedVal = currentPairAnswers[p.left];
                            return (
                              <div key={idx} className="flex flex-col md:flex-row gap-3 items-stretch">
                                <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl font-bold text-slate-800 dark:text-slate-200 flex items-center shadow-sm text-sm">
                                  {p.left}
                                </div>

                                <div
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    const draggedText = e.dataTransfer.getData('text/plain');
                                    handleDropToPair(p.left, draggedText);
                                  }}
                                  className={`flex-1 border-2 border-dashed rounded-2xl p-2.5 flex items-center justify-start min-h-[54px] transition ${assignedVal
                                      ? 'border-amber-400 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30'
                                      : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950'
                                    }`}
                                >
                                  {assignedVal ? (
                                    <div
                                      draggable
                                      onDoubleClick={() => handleRemoveFromPair(p.left)}
                                      onDragStart={(e) => e.dataTransfer.setData('text/plain', assignedVal)}
                                      className="bg-amber-200 dark:bg-amber-900/60 border-2 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-black px-3.5 py-1.5 rounded-xl text-sm shadow-sm cursor-grab select-none transition active:scale-95 inline-block"
                                    >
                                      {assignedVal}
                                    </div>
                                  ) : (
                                    <div className="w-full flex justify-center items-center py-1">
                                      <span className="text-slate-400 dark:text-slate-500 text-xs italic font-medium">Thả đáp án vào đây</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  if (qType === 'groupdrag') {
                    const currentGroupAnswers = answers[currentQuestion] || {}; // { [item]: groupName }
                    const allItems = (q.groups || []).reduce((acc, g) => [...acc, ...(g.items || [])], []);
                    const poolItems = allItems.filter(item => !currentGroupAnswers[item]);

                    const handleAssignToGroup = (item, groupName) => {
                      if (!item || !groupName) return;
                      const next = { ...currentGroupAnswers, [item]: groupName };
                      setAnswers(prev => ({ ...prev, [currentQuestion]: next }));
                    };

                    const handleRemoveFromGroup = (item) => {
                      const next = { ...currentGroupAnswers };
                      delete next[item];
                      setAnswers(prev => ({ ...prev, [currentQuestion]: next }));
                    };

                    const handleGroupPoolDoubleClick = (item) => {
                      const firstGroup = (q.groups || [])[0];
                      if (firstGroup) {
                        handleAssignToGroup(item, firstGroup.name);
                      }
                    };

                    const cols = (q.groups || []).length === 2 ? 'md:grid-cols-2' : ((q.groups || []).length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4');

                    return (
                      <div className="space-y-6">
                        {/* Ngân hàng từ khóa tổng */}
                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const item = e.dataTransfer.getData('text/plain');
                            if (item) handleRemoveFromGroup(item);
                          }}
                          className="bg-indigo-50/70 dark:bg-blue-950/20 border-2 border-dashed border-indigo-300 dark:border-blue-800/50 rounded-2xl p-5 shadow-inner"
                        >
                          <div className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-blue-400 mb-3 text-center">
                            🏷️ NGÂN HÀNG TỪ KHÓA (Kéo thả từ hoặc Nhấp đúp chuột 2 lần để chọn)
                          </div>
                          <div className="flex flex-wrap gap-2.5 justify-center items-center">
                            {poolItems.length > 0 ? (
                              poolItems.map((item, idx) => (
                                <div
                                  key={idx}
                                  draggable
                                  onDoubleClick={() => handleGroupPoolDoubleClick(item)}
                                  onDragStart={(e) => e.dataTransfer.setData('text/plain', item)}
                                  className="bg-indigo-100 hover:bg-indigo-200 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 border-2 border-indigo-400 dark:border-blue-700 text-indigo-900 dark:text-blue-200 font-extrabold px-4 py-2 rounded-xl text-sm shadow-sm cursor-grab active:scale-95 transition select-none"
                                >
                                  {item}
                                </div>
                              ))
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">✓ Đã xếp hết từ khóa vào nhóm!</span>
                            )}
                          </div>
                        </div>

                        {/* Danh sách các Nhóm (Khung Thả) */}
                        <div className={`grid grid-cols-1 ${cols} gap-4`}>
                          {(q.groups || []).map((g, gIdx) => {
                            const groupItems = allItems.filter(item => currentGroupAnswers[item] === g.name);
                            return (
                              <div
                                key={gIdx}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  const item = e.dataTransfer.getData('text/plain');
                                  if (item) handleAssignToGroup(item, g.name);
                                }}
                                className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col shadow-sm"
                              >
                                <div className="text-center font-extrabold text-indigo-700 dark:text-blue-400 text-base mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                                  {g.name}
                                </div>
                                <div className="flex-1 border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl p-3 flex flex-wrap content-start items-start gap-2.5 min-h-[120px]">
                                  {groupItems.length > 0 ? (
                                    groupItems.map((item, idx) => (
                                      <div
                                        key={idx}
                                        draggable
                                        onDoubleClick={() => handleRemoveFromGroup(item)}
                                        onDragStart={(e) => e.dataTransfer.setData('text/plain', item)}
                                        className="bg-indigo-100 hover:bg-indigo-200 dark:bg-blue-900/50 border-2 border-indigo-400 dark:border-blue-700 text-indigo-900 dark:text-blue-200 font-extrabold px-3.5 py-1.5 rounded-xl text-sm shadow-sm cursor-grab select-none transition active:scale-95 flex-initial"
                                      >
                                        {item}
                                      </div>
                                    ))
                                  ) : (
                                    <span className="text-slate-400 dark:text-slate-600 text-xs italic font-medium m-auto">Thả từ vào đây</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  if (qType === 'clozedrag') {
                    const clozeAnswers = answers[currentQuestion] || []; // array
                    const allAnswers = q.answers || [];
                    const poolItems = allAnswers.filter(ans => !clozeAnswers.includes(ans));

                    const parts = (q.content || q.question || '').split('___');

                    const handleFillBlank = (idx, value) => {
                      const next = [...clozeAnswers];
                      next[idx] = value;
                      setAnswers(prev => ({ ...prev, [currentQuestion]: next }));
                    };

                    const handleClozePoolDoubleClick = (ans) => {
                      const firstEmptyIdx = parts.findIndex((_, idx) => idx < parts.length - 1 && !clozeAnswers[idx]);
                      if (firstEmptyIdx !== -1) {
                        handleFillBlank(firstEmptyIdx, ans);
                      }
                    };

                    return (
                      <div className="space-y-6">
                        {/* Ngân hàng từ khóa điền đoạn văn */}
                        <div className="bg-indigo-50/70 dark:bg-blue-950/20 border-2 border-dashed border-indigo-300 dark:border-blue-800/50 rounded-2xl p-5 shadow-inner">
                          <div className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-blue-400 mb-3 text-center">
                            🏷️ NGÂN HÀNG TỪ KHÓA (Kéo thả hoặc Nhấp đúp chuột 2 lần để chọn)
                          </div>
                          <div className="flex flex-wrap gap-2.5 justify-center items-center">
                            {poolItems.length > 0 ? (
                              poolItems.map((ans, idx) => (
                                <div
                                  key={idx}
                                  draggable
                                  onDoubleClick={() => handleClozePoolDoubleClick(ans)}
                                  onDragStart={(e) => e.dataTransfer.setData('text/plain', ans)}
                                  className="bg-indigo-100 hover:bg-indigo-200 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 border-2 border-indigo-400 dark:border-blue-700 text-indigo-900 dark:text-blue-200 font-extrabold px-4 py-2 rounded-xl text-sm shadow-sm cursor-grab active:scale-95 transition select-none"
                                >
                                  {ans}
                                </div>
                              ))
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">✓ Đã điền xong tất cả chỗ trống!</span>
                            )}
                          </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 p-6 rounded-2xl text-slate-800 dark:text-slate-200 leading-loose text-base transition-colors">
                          {parts.map((part, idx) => {
                            if (idx === parts.length - 1) {
                              return <span key={idx} dangerouslySetInnerHTML={{ __html: part }} />;
                            }
                            const filledVal = clozeAnswers[idx] || '';
                            return (
                              <span key={idx} className="inline-block mx-1">
                                <span dangerouslySetInnerHTML={{ __html: part }} />
                                <span
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    const text = e.dataTransfer.getData('text/plain');
                                    if (text) handleFillBlank(idx, text);
                                  }}
                                  className={`inline-flex items-center gap-1 border-2 border-dashed rounded-lg px-2 py-0.5 align-middle transition ${filledVal
                                      ? 'border-indigo-500 bg-indigo-50 dark:bg-blue-950 text-indigo-700 dark:text-blue-300 font-bold'
                                      : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-400'
                                    }`}
                                >
                                  {filledVal ? (
                                    <span
                                      draggable
                                      onDoubleClick={() => handleFillBlank(idx, '')}
                                      onDragStart={(e) => e.dataTransfer.setData('text/plain', filledVal)}
                                      className="cursor-grab select-none"
                                    >
                                      {filledVal}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 dark:text-slate-500 text-xs italic px-2">...</span>
                                  )}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  if (qType === 'order') {
                    const currentAnswers = answers[currentQuestion] || []; // Array of indices of selected words
                    const pool = Array.from({ length: (q.items || []).length }, (_, i) => i)
                      .filter(idx => !currentAnswers.includes(idx))
                      .sort((a, b) => q.items[a].localeCompare(q.items[b]));

                    const handleAddWord = (idx) => {
                      setAnswers(prev => ({
                        ...prev,
                        [currentQuestion]: [...currentAnswers, idx]
                      }));
                    };

                    const handleRemoveWord = (pos) => {
                      const nextAnswers = currentAnswers.filter((_, i) => i !== pos);
                      setAnswers(prev => ({
                        ...prev,
                        [currentQuestion]: nextAnswers
                      }));
                    };

                    return (
                      <div className="space-y-6">
                        {/* Khu vực sắp xếp kết quả */}
                        <div className="bg-slate-50 dark:bg-slate-900/60 border-4 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-6 min-h-[100px] flex flex-col justify-center transition-colors">
                          <div className="text-center text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                            Khu vực ghép từ (Bấm vào từ để bỏ ra)
                          </div>
                          <div className="flex flex-wrap gap-2 justify-center items-center">
                            {currentAnswers.length > 0 ? (
                              currentAnswers.map((idx, pos) => (
                                <button
                                  key={pos}
                                  type="button"
                                  onClick={() => handleRemoveWord(pos)}
                                  className="bg-yellow-100 dark:bg-yellow-950/30 hover:bg-yellow-200 dark:hover:bg-yellow-950/50 border-2 border-yellow-400 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300 font-bold px-4 py-2 rounded-2xl text-sm shadow-sm transition hover:scale-95 duration-100"
                                >
                                  {q.items[idx]}
                                </button>
                              ))
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500 italic text-sm">Chưa có từ nào được chọn — Bấm vào các từ bên dưới để ghép</span>
                            )}
                          </div>
                        </div>

                        {/* Ngân hàng từ khóa */}
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 pl-1">
                            Ngân hàng từ khóa
                          </div>
                          <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-wrap justify-center gap-2 shadow-sm transition-colors">
                            {pool.length > 0 ? (
                              pool.map((idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => handleAddWord(idx)}
                                  className="bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold px-4 py-2 rounded-2xl text-sm shadow-sm transition hover:-translate-y-0.5 duration-100"
                                >
                                  {q.items[idx]}
                                </button>
                              ))
                            ) : (
                              <span className="text-emerald-500 dark:text-emerald-400 font-bold text-sm">✓ Đã chọn hết từ khóa!</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })()}
              </div>

              <div className="mt-10 flex justify-between border-t border-slate-100 dark:border-slate-800 pt-6">
                <Button
                  variant="outline"
                  disabled={currentQuestion === 1}
                  onClick={() => setCurrentQuestion(prev => prev - 1)}
                  className="rounded-xl font-bold h-11 border-slate-200 dark:border-slate-800 bg-transparent"
                >
                  Câu trước
                </Button>
                <span className="text-slate-400 font-bold text-sm self-center">
                  {currentQuestion} / {questions.length}
                </span>
                <Button
                  disabled={currentQuestion === questions.length}
                  onClick={() => setCurrentQuestion(prev => prev + 1)}
                  className="rounded-xl font-bold h-11"
                >
                  Câu tiếp theo
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="max-w-md w-full border-red-500 border-2 shadow-2xl rounded-3xl overflow-hidden bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
            <CardContent className="p-8 text-center space-y-4">
              <AlertTriangle className="h-16 w-16 text-red-500 mx-auto animate-bounce" />
              <h2 className="text-2xl font-black text-red-600 dark:text-red-400">CẢNH BÁO VI PHẠM ({warningCount}/3)</h2>
              <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">
                Bạn vừa vi phạm quy chế thi: <strong className="text-slate-800 dark:text-slate-100">{warningText}</strong>.
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30">
                Lưu ý: Nếu vi phạm quá 3 lần, hệ thống sẽ tự động nộp bài thi và lưu lại nhật ký vi phạm!
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="max-w-md w-full border-none shadow-2xl rounded-3xl overflow-hidden bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 animate-in zoom-in-95 duration-200">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-primary dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-2">
                <Clock className="h-8 w-8 text-primary dark:text-blue-400 animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Nộp bài thi?</h2>
              <p className="text-slate-500 dark:text-slate-450 text-sm font-semibold">
                Bạn có chắc chắn muốn nộp bài thi ngay bây giờ không? Bạn sẽ không thể sửa đổi câu trả lời của mình nữa.
              </p>

              <div className="flex gap-3 justify-center pt-4">
                <Button variant="outline" onClick={() => setShowSubmitModal(false)} className="w-full font-bold h-11 rounded-xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-transparent">
                  Tiếp tục làm bài
                </Button>
                <Button variant="danger" onClick={() => {
                  setShowSubmitModal(false);
                  submitExam(warningCount, 'Chủ động');
                }} className="w-full font-bold h-11 bg-red-500 hover:bg-red-600 rounded-xl border-transparent">
                  Nộp bài ngay
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
