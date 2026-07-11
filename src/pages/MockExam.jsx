import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { storage } from '../utils/storage';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { AlertTriangle, Clock } from 'lucide-react';

export default function MockExam() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  
  // Extract state passed from ClientDashboard
  const examData = location.state || {
    examId: 'mock_toan',
    title: 'Đề thi THPT Quốc Gia - Toán học',
    questions: [
      { id: 'q1', content: 'Trong không gian Oxyz, mặt phẳng (P): 2x - y + 3z - 5 = 0 có một vectơ pháp tuyến là:', options: ['n = (2; -1; 3)', 'n = (-2; 1; 3)', 'n = (2; 1; -3)', 'n = (2; -1; -5)'], answer: 0 },
      { id: 'q2', content: 'Hàm số y = x^3 - 3x + 1 đồng biến trên khoảng nào dưới đây?', options: ['(-1; 1)', '(-inf; -1) và (1; +inf)', '(-inf; 1)', '(-1; +inf)'], answer: 1 }
    ],
    timeLimit: 90 * 60,
    mode: 'practice',
    subjectName: 'Toán học'
  };

  const { examId, title, questions, timeLimit, mode, subjectName } = examData;

  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [answers, setAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [warningCount, setWarningCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningText, setWarningText] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const isSubmittedRef = useRef(false);
  const warningCountRef = useRef(0);
  const lastWarningTimeRef = useRef(0);

  const updateWarningCount = (val) => {
    warningCountRef.current = val;
    setWarningCount(val);
  };

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!isSubmittedRef.current) {
            alert('Hết giờ làm bài! Hệ thống tự động nộp bài.');
            submitExam(warningCountRef.current, 'Hết giờ');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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
        alert(`Bạn đã vi phạm rời phòng thi 3 lần (${reason}). Hệ thống tự động nộp bài thi!`);
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

  const submitExam = (finalWarnings = warningCount, reason = 'Chủ động') => {
    if (isSubmittedRef.current && reason === 'Chủ động') return; // Tránh chạy 2 lần
    isSubmittedRef.current = true;

    // Calculate score
    let correctCount = 0;
    const reviewedQuestions = questions.map((q, index) => {
      const qNum = index + 1;
      const userAnswer = answers[qNum];
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
        isCorrect = (q.pairs || []).every(p => (userAnswer || {})[p.left] === p.right);
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

      if (isCorrect) correctCount++;

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
        items: q.items
      };
    });

    const score = parseFloat(((correctCount / questions.length) * 10).toFixed(1));
    const timeTaken = timeLimit - timeLeft;

    // Save exam result to localStorage
    const results = JSON.parse(localStorage.getItem('qm_exam_results') || '[]');
    const newResult = {
      id: 'res_' + Date.now(),
      examId,
      title,
      subjectName,
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

    // Navigate to review page
    navigate('/client/review', { 
      state: { 
        title, 
        score, 
        correctCount, 
        totalCount: questions.length,
        questions: reviewedQuestions 
      } 
    });
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isWarningTime = timeLeft < 300;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between sticky top-0 z-20 shadow-sm transition-colors">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider">Môn học: {subjectName}</span>
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
        <div className="w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 overflow-y-auto hidden lg:block transition-colors">
          <h3 className="font-bold mb-4 text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wider">Danh sách câu hỏi</h3>
          <div className="grid grid-cols-5 gap-2">
            {questions.map((_, i) => {
              const qNum = i + 1;
              const isAnswered = answers[qNum] !== undefined;
              const isCurrent = currentQuestion === qNum;
              
              let btnClass = "h-10 w-10 rounded-xl font-bold text-xs transition-all border flex items-center justify-center ";
              if (isCurrent) btnClass += "border-primary dark:border-blue-500 ring-2 ring-primary/20 dark:ring-blue-500/20 scale-105 ";
              else btnClass += "border-slate-100 dark:border-slate-800 ";

              if (isAnswered) btnClass += "bg-primary dark:bg-blue-600 text-white border-primary dark:border-blue-600 shadow-sm shadow-primary/20";
              else btnClass += "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50";

              return (
                <button 
                  key={qNum} 
                  className={btnClass}
                  onClick={() => setCurrentQuestion(qNum)}
                >
                  {qNum}
                </button>
              );
            })}
          </div>
        </div>

        {/* Question display */}
        <div className="flex-1 overflow-y-auto p-8 flex justify-center items-start bg-slate-50 dark:bg-slate-950/60 transition-colors">
          <Card className="w-full max-w-3xl border-0 shadow-sm rounded-3xl overflow-hidden bg-white dark:bg-slate-900">
            <CardContent className="p-8">
              <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-150 mb-8 leading-relaxed flex items-start gap-2">
                <span className="bg-primary/10 dark:bg-blue-900/20 text-primary dark:text-blue-400 px-3 py-1.5 rounded-xl text-xs font-bold uppercase shrink-0 font-bold">Câu {currentQuestion}</span>
                <span dangerouslySetInnerHTML={{ __html: questions[currentQuestion - 1]?.content || questions[currentQuestion - 1]?.question || '' }} />
              </h2>
              
              {questions[currentQuestion - 1]?.image && (
                <img src={questions[currentQuestion - 1]?.image} alt="Question Graphic" className="max-w-full max-h-64 rounded-xl border border-slate-200 dark:border-slate-800 mb-6 mx-auto block shadow-sm" />
              )}

              <div className="space-y-4">
                {(() => {
                  const q = questions[currentQuestion - 1];
                  const qType = q?.type || 'single';

                  if (qType === 'single') {
                    return (q.options || []).map((opt, i) => (
                      <label 
                        key={i} 
                        className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition ${answers[currentQuestion] === i ? 'border-primary bg-primary/5 dark:border-blue-500 dark:bg-blue-500/10' : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700'}`}
                      >
                        <input 
                          type="radio" 
                          name={`question-${currentQuestion}`} 
                          className="w-5 h-5 text-primary dark:text-blue-500 border-slate-300 dark:border-slate-700 focus:ring-primary dark:focus:ring-blue-500 flex-shrink-0"
                          checked={answers[currentQuestion] === i}
                          onChange={() => setAnswers(prev => ({ ...prev, [currentQuestion]: i }))}
                        />
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: opt || '' }} />
                      </label>
                    ));
                  }

                  if (qType === 'multiselect') {
                    return (q.options || []).map((opt, i) => {
                      const currentAnswers = answers[currentQuestion] || [];
                      const isChecked = currentAnswers.includes(i);
                      return (
                        <label 
                          key={i} 
                          className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition ${isChecked ? 'border-primary bg-primary/5 dark:border-blue-500 dark:bg-blue-500/10' : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700'}`}
                        >
                          <input 
                            type="checkbox" 
                            name={`question-${currentQuestion}`} 
                            className="w-5 h-5 text-primary dark:text-blue-500 border-slate-300 dark:border-slate-700 focus:ring-primary dark:focus:ring-blue-500 rounded flex-shrink-0"
                            checked={isChecked}
                            onChange={() => {
                              const nextAnswers = isChecked 
                                ? currentAnswers.filter(x => x !== i) 
                                : [...currentAnswers, i];
                              setAnswers(prev => ({ ...prev, [currentQuestion]: nextAnswers }));
                            }}
                          />
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: opt || '' }} />
                        </label>
                      );
                    });
                  }

                  if (qType === 'fill') {
                    return (
                      <input 
                        type="text"
                        className="w-full p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 focus:border-primary dark:focus:border-blue-500 focus:outline-none font-semibold text-slate-700 dark:text-slate-250 bg-white dark:bg-slate-950 transition-colors"
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

                  if (qType === 'drag') {
                    const rightParts = [...(q.pairs || [])].map(p => p.right).sort();
                    return (
                      <div className="space-y-4">
                        {(q.pairs || []).map((p, idx) => {
                          const selected = (answers[currentQuestion] || {})[p.left] || '';
                          return (
                            <div key={idx} className="flex flex-col sm:flex-row gap-4 items-center bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm transition-colors">
                              <div className="flex-1 text-slate-700 dark:text-slate-350 font-semibold">{p.left}</div>
                              <select
                                className="w-full sm:w-64 p-3 rounded-xl border border-slate-300 dark:border-slate-750 font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 focus:outline-none"
                                value={selected}
                                onChange={(e) => {
                                  const curr = answers[currentQuestion] || {};
                                  setAnswers(prev => ({ 
                                    ...prev, 
                                    [currentQuestion]: { ...curr, [p.left]: e.target.value } 
                                  }));
                                }}
                              >
                                <option value="">-- Chọn đáp án tương ứng --</option>
                                {rightParts.map((rp, rIdx) => (
                                  <option key={rIdx} value={rp}>{rp}</option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  if (qType === 'groupdrag') {
                    const allItems = (q.groups || []).reduce((acc, g) => [...acc, ...(g.items || [])], []).sort();
                    return (
                      <div className="space-y-4">
                        {allItems.map((item, idx) => {
                          const selectedGroup = (answers[currentQuestion] || {})[item] || '';
                          return (
                            <div key={idx} className="flex flex-col sm:flex-row gap-4 items-center bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm transition-colors">
                              <div className="flex-1 text-slate-700 dark:text-slate-350 font-semibold">{item}</div>
                              <select
                                className="w-full sm:w-64 p-3 rounded-xl border border-slate-300 dark:border-slate-750 font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 focus:outline-none"
                                value={selectedGroup}
                                onChange={(e) => {
                                  const curr = answers[currentQuestion] || {};
                                  setAnswers(prev => ({ 
                                    ...prev, 
                                    [currentQuestion]: { ...curr, [item]: e.target.value } 
                                  }));
                                }}
                              >
                                <option value="">-- Chọn nhóm --</option>
                                {(q.groups || []).map((g, gIdx) => (
                                  <option key={gIdx} value={g.name}>{g.name}</option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  if (qType === 'clozedrag') {
                    const parts = (q.content || q.question || '').split('___');
                    const optionsList = [...(q.answers || [])].sort();
                    return (
                      <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 p-6 rounded-2xl text-slate-800 dark:text-slate-200 leading-loose text-base transition-colors">
                        {parts.map((part, idx) => {
                          if (idx === parts.length - 1) {
                            return <span key={idx} dangerouslySetInnerHTML={{ __html: part }} />;
                          }
                          const blankAnswers = answers[currentQuestion] || [];
                          const selectedValue = blankAnswers[idx] || '';
                          return (
                            <span key={idx} className="inline-block mx-1">
                              <span dangerouslySetInnerHTML={{ __html: part }} />
                              <select
                                className="p-1 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-primary dark:text-blue-400 bg-slate-50 dark:bg-slate-950 focus:outline-none text-sm min-w-[120px]"
                                value={selectedValue}
                                onChange={(e) => {
                                  const newArr = [...(answers[currentQuestion] || [])];
                                  newArr[idx] = e.target.value;
                                  setAnswers(prev => ({ ...prev, [currentQuestion]: newArr }));
                                }}
                              >
                                <option value="">-- Chọn --</option>
                                {optionsList.map((opt, oIdx) => (
                                  <option key={oIdx} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </span>
                          );
                        })}
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
                                  className="bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-350 font-semibold px-4 py-2 rounded-2xl text-sm shadow-sm transition hover:-translate-y-0.5 duration-100"
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
              <p className="text-slate-600 dark:text-slate-350 font-medium text-sm">
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
                <Button variant="outline" onClick={() => setShowSubmitModal(false)} className="w-full font-bold h-11 rounded-xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 bg-transparent">
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
