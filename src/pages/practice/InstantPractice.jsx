import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { storageV2 } from '../../utils/storageV2';
import { storage } from '../../utils/storage';
import { setPracticeCooldown, isUserUnlimited } from '../../utils/cooldownManager';
import { saveMistakes } from '../../utils/mistakeManager';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import {
  Clock, Flag, CheckCircle2, XCircle, AlertTriangle, Loader2
} from 'lucide-react';

const formatQuestionText = (text) => {
  if (!text) return '';
  return text.replace(/\n/g, '<br>');
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function checkAnswer(q, userAnswer) {
  const qType = q.type || 'single';
  if (qType === 'single') {
    const correct = q.answer !== undefined ? q.answer : q.correct;
    return { isCorrect: userAnswer === correct, correctAnswer: correct };
  }
  if (qType === 'multiselect') {
    const correct = q.corrects || [];
    const uArr = userAnswer || [];
    return {
      isCorrect: uArr.length === correct.length && uArr.every(x => correct.includes(x)),
      correctAnswer: correct,
    };
  }
  if (qType === 'fill') {
    const correct = q.answer || '';
    return {
      isCorrect: userAnswer !== undefined && userAnswer !== null &&
        userAnswer.toString().trim().toLowerCase() === correct.toString().trim().toLowerCase(),
      correctAnswer: correct,
    };
  }
  if (qType === 'truefalse') {
    return { isCorrect: userAnswer === q.correct, correctAnswer: q.correct };
  }
  if (qType === 'drag') {
    const valid = (q.pairs || []).filter(p => p.left?.toString().trim());
    return {
      isCorrect: valid.length > 0 && valid.every(p => (userAnswer || {})[p.left] === p.right),
      correctAnswer: q.pairs,
    };
  }
  if (qType === 'groupdrag') {
    return {
      isCorrect: (q.groups || []).every(g => (g.items || []).every(item => (userAnswer || {})[item] === g.name)),
      correctAnswer: q.groups,
    };
  }
  if (qType === 'clozedrag') {
    const correct = q.answers || [];
    const u = userAnswer || [];
    return {
      isCorrect: correct.length > 0 && correct.every((a, i) => u[i] === a),
      correctAnswer: correct,
    };
  }
  if (qType === 'order') {
    const correct = q.items || [];
    const userWords = (userAnswer || []).map(idx => q.items[idx]);
    return {
      isCorrect: correct.length > 0 && correct.every((item, i) => userWords[i] === item),
      correctAnswer: correct,
    };
  }
  if (qType === 'multitruefalse') {
    const stmts = q.statements || [];
    const userMap = userAnswer || {};
    const ratio = stmts.length > 0
      ? stmts.filter((s, idx) => userMap[idx] === s.correct).length / stmts.length
      : 0;
    return { isCorrect: ratio === 1, correctAnswer: q.statements };
  }
  return { isCorrect: false, correctAnswer: null };
}

const OPT_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export default function InstantPractice() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId } = useParams();
  const { currentUser } = useAuth();

  const state = location.state || {};
  const { examId, subjectId, title, subjectName, timeMode, questionCount: requestedCount } = state;

  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Mỗi câu: { answer, checked, isCorrect, correctAnswer }
  const [qState, setQState] = useState({});
  const [currentIdx, setCurrentIdx] = useState(0); // 0-indexed
  const [flagged, setFlagged] = useState([]);
  const [finished, setFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // Load câu hỏi
  useEffect(() => {
    if (!examId) { setIsLoading(false); return; }
    setIsLoading(true);
    storageV2.loadQuestionsV2(examId)
      .then(qs => {
        if (!qs || qs.length === 0) { setIsLoading(false); return; }
        let selected = shuffle(qs);
        if (requestedCount && requestedCount < qs.length) {
          selected = selected.slice(0, requestedCount);
        }
        setQuestions(selected);
        if (timeMode !== 'zen') {
          const examTime = state?.exam?.config?.time
            || Math.max(5, Math.round(selected.length * 1.5));
          setTimeLeft(examTime * 60);
        }
      })
      .catch(() => { })
      .finally(() => setIsLoading(false));
  }, [examId]);

  // Đếm giờ
  useEffect(() => {
    if (timeLeft === null || finished) return;
    if (timeLeft <= 0) { handleFinish(); return; }
    const t = setInterval(() => setTimeLeft(p => {
      if (p <= 1) { clearInterval(t); handleFinish(); return 0; }
      return p - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [timeLeft === null, finished]);

  const currentQ = questions[currentIdx];

  const setAnswer = (ans) => {
    if (qState[currentIdx]?.checked) return;
    setQState(prev => ({ ...prev, [currentIdx]: { ...prev[currentIdx], answer: ans } }));
  };

  const handleCheck = () => {
    if (!currentQ) return;
    const ans = qState[currentIdx]?.answer;
    if (ans === undefined || ans === null || (Array.isArray(ans) && ans.length === 0)) return;
    const { isCorrect, correctAnswer } = checkAnswer(currentQ, ans);
    setQState(prev => ({
      ...prev,
      [currentIdx]: { ...prev[currentIdx], checked: true, isCorrect, correctAnswer },
    }));
  };

  const handleFinish = useCallback(() => {
    if (finished) return;
    setFinished(true);

    let correctCount = 0;
    const reviewedQuestions = questions.map((q, idx) => {
      const st = qState[idx] || {};
      const { isCorrect, correctAnswer } = st.checked
        ? { isCorrect: st.isCorrect, correctAnswer: st.correctAnswer }
        : checkAnswer(q, st.answer);
      if (isCorrect) correctCount++;
      return {
        id: q.id, type: q.type || 'single',
        text: q.content || q.question,
        options: q.options || [],
        userAnswer: st.answer !== undefined ? st.answer : null,
        correctAnswer,
        isCorrect,
        pairs: q.pairs, groups: q.groups, answers: q.answers,
        items: q.items, statements: q.statements,
      };
    });

    const score = parseFloat(((correctCount / questions.length) * 10).toFixed(1));

    if (currentUser?.id && subjectId) {
      const wrongOnes = reviewedQuestions.filter(q => !q.isCorrect);
      if (wrongOnes.length > 0) saveMistakes(currentUser.id, subjectId, wrongOnes, examId);
    }

    if (!isUserUnlimited(currentUser)) setPracticeCooldown(currentUser?.id);

    storage.addAuditLog({
      user: currentUser?.username || 'student',
      role: 'Student',
      category: 'Exam',
      action: `Nộp bài luyện tập tức thì: ${title} | Điểm: ${score}/10`,
      severity: 'Info',
    });

    const reviewPayload = {
      title,
      score,
      correctCount,
      totalCount: questions.length,
      examId,
      subjectId,
      subjectName,
      questions: reviewedQuestions,
      practiceMode: 'instant',
    };
    try { sessionStorage.setItem('qm_last_review_data', JSON.stringify(reviewPayload)); } catch (_) {}
    navigate('/client/review', { state: reviewPayload, replace: true });
  }, [finished, questions, qState, currentUser, subjectId, title, subjectName]);

  const toggleFlag = (idx) => {
    setFlagged(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  };

  const formatTime = (s) => {
    if (s === null) return '∞';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // ── Guards ──
  if (!examId || !subjectId) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">Không tìm thấy dữ liệu bài luyện tập</h2>
        <Button onClick={() => navigate('/client/dashboard')} className="mt-4 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
          Về trang chủ
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-400 mr-3" />
        <p className="font-bold text-slate-400">Đang nạp câu hỏi...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">Đề thi chưa có câu hỏi</h2>
        <Button onClick={() => navigate('/client/dashboard')} className="mt-4 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
          Về trang chủ
        </Button>
      </div>
    );
  }

  const cs = qState[currentIdx] || {};
  const isChecked = !!cs.checked;
  const qType = currentQ?.type || 'single';
  const isWarningTime = timeLeft !== null && timeLeft < 300;

  // ── Render Options ──
  const renderQuestion = () => {
    if (qType === 'single' || qType === 'multiselect') {
      const opts = Array.isArray(currentQ.options) ? currentQ.options : [];
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 content-start">
          {opts.map((opt, i) => {
            const optText = typeof opt === 'string' ? opt : opt?.text || opt;
            const optImg = typeof opt === 'object' ? opt?.image : null;
            const isSelected = qType === 'multiselect'
              ? Array.isArray(cs.answer) && cs.answer.includes(i)
              : cs.answer === i;
            const isCorrectOpt = isChecked
              ? (qType === 'multiselect'
                ? Array.isArray(cs.correctAnswer) && cs.correctAnswer.includes(i)
                : cs.correctAnswer === i)
              : false;

            let borderBg = 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700';
            let labelBadge = 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';

            if (isChecked) {
              if (isCorrectOpt) {
                borderBg = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30';
                labelBadge = 'bg-emerald-500 text-white';
              } else if (isSelected && !isCorrectOpt) {
                borderBg = 'border-red-500 bg-red-50 dark:bg-red-950/30';
                labelBadge = 'bg-red-500 text-white';
              }
            } else if (isSelected) {
              borderBg = 'border-primary bg-primary/5 dark:border-blue-500 dark:bg-blue-500/10';
              labelBadge = 'bg-primary text-white dark:bg-blue-500';
            }

            return (
              <div
                key={i}
                onClick={() => {
                  if (isChecked) return;
                  if (qType === 'multiselect') {
                    const prev = Array.isArray(cs.answer) ? cs.answer : [];
                    const next = prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i];
                    setAnswer(next);
                  } else {
                    setAnswer(i);
                  }
                }}
                className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 transition ${borderBg} ${isChecked ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 transition ${labelBadge}`}>
                  {OPT_LABELS[i] || (i + 1)}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-relaxed" dangerouslySetInnerHTML={{ __html: optText || '' }} />
                  {optImg && (
                    <img
                      src={optImg}
                      alt={`Option ${i + 1}`}
                      onClick={(e) => { e.stopPropagation(); setPreviewImage(optImg); }}
                      className="mt-2 max-h-40 rounded-xl border border-slate-200 dark:border-slate-800 object-contain shadow-sm hover:opacity-90 cursor-zoom-in bg-white p-1"
                    />
                  )}
                </div>
                {isChecked && isCorrectOpt && (
                  <span className="text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-md uppercase ml-auto self-center">
                    Đúng
                  </span>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (qType === 'truefalse') {
      return (
        <div className="flex gap-4">
          {[true, false].map(val => {
            const isSelected = cs.answer === val;
            const isCorrectOpt = isChecked ? cs.correctAnswer === val : false;
            let borderBg = 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700';
            if (isChecked) {
              if (isCorrectOpt) borderBg = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 font-bold';
              else if (isSelected) borderBg = 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 font-bold';
            } else if (isSelected) {
              borderBg = 'border-primary bg-primary/5 dark:border-blue-500 dark:bg-blue-500/10 text-primary dark:text-blue-400 font-bold';
            }
            return (
              <div
                key={String(val)}
                onClick={() => { if (!isChecked) setAnswer(val); }}
                className={`flex-1 flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition ${borderBg} ${isChecked ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <span className="text-base font-extrabold">{val ? 'ĐÚNG' : 'SAI'}</span>
                {isChecked && isCorrectOpt && <span className="text-xs font-bold text-emerald-600 mt-1">✓ Đáp án đúng</span>}
              </div>
            );
          })}
        </div>
      );
    }

    if (qType === 'fill') {
      return (
        <div className="space-y-3">
          <input
            type="text"
            disabled={isChecked}
            value={cs.answer || ''}
            onChange={e => setAnswer(e.target.value)}
            placeholder="Nhập câu trả lời của bạn..."
            className="w-full p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 focus:border-primary dark:focus:border-blue-500 focus:outline-none font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 transition-colors"
          />
          {isChecked && !cs.isCorrect && (
            <div className="p-3 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 text-sm font-bold text-emerald-700 dark:text-emerald-300">
              ✓ Đáp án đúng: <span className="font-black">{cs.correctAnswer}</span>
            </div>
          )}
        </div>
      );
    }

    if (qType === 'multitruefalse') {
      const stmts = currentQ.statements || [];
      const userMap = cs.answer || {};
      return (
        <div className="flex flex-col gap-3">
          {stmts.map((stmt, idx) => {
            const userAns = userMap[idx];
            const isCorrectChoice = isChecked ? userAns === stmt.correct : null;
            return (
              <div key={idx} className="flex items-center gap-3 p-3.5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                <span className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-300">{stmt.text}</span>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    disabled={isChecked}
                    onClick={() => setAnswer({ ...userMap, [idx]: true })}
                    className={`px-4 py-2 rounded-xl font-bold text-sm transition border-2 ${
                      userAns === true
                        ? isChecked
                          ? stmt.correct === true
                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                            : 'bg-red-500 text-white border-red-500 shadow-md'
                          : 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                        : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:text-emerald-600'
                    }`}
                  >Đúng</button>
                  <button
                    disabled={isChecked}
                    onClick={() => setAnswer({ ...userMap, [idx]: false })}
                    className={`px-4 py-2 rounded-xl font-bold text-sm transition border-2 ${
                      userAns === false
                        ? isChecked
                          ? stmt.correct === false
                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                            : 'bg-red-500 text-white border-red-500 shadow-md'
                          : 'bg-red-500 text-white border-red-500 shadow-md'
                        : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-red-400 hover:text-red-600'
                    }`}
                  >Sai</button>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (qType === 'drag') {
      const currentPairAnswers = cs.answer || {}; // { [left]: right }
      const validPairs = (currentQ.pairs || []).filter(p => p.left && p.left.toString().trim() !== '');
      const allRights = (currentQ.pairs || []).map(p => p.right).filter(Boolean);
      const usedRights = Object.values(currentPairAnswers);
      const poolItems = allRights.filter(r => !usedRights.includes(r));

      const handleDropToPair = (leftKey, rightVal) => {
        if (!rightVal || isChecked) return;
        const next = { ...currentPairAnswers };
        const existingLeftKey = Object.keys(next).find(k => next[k] === rightVal);
        if (existingLeftKey && existingLeftKey !== leftKey) delete next[existingLeftKey];
        next[leftKey] = rightVal;
        setAnswer(next);
      };

      const handleRemoveFromPair = (leftKey) => {
        if (isChecked) return;
        const next = { ...currentPairAnswers };
        delete next[leftKey];
        setAnswer(next);
      };

      return (
        <div className="space-y-5">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const draggedText = e.dataTransfer.getData('text/plain');
              const sourceLeftKey = Object.keys(currentPairAnswers).find(k => currentPairAnswers[k] === draggedText);
              if (sourceLeftKey) handleRemoveFromPair(sourceLeftKey);
            }}
            className="bg-amber-50/70 dark:bg-amber-950/20 border-2 border-dashed border-amber-300 dark:border-amber-800/50 rounded-2xl p-4 shadow-inner"
          >
            <div className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2.5 text-center">
              🏷️ NGÂN HÀNG TỪ KHÓA (Kéo thả hoặc Nhấp đúp chuột 2 lần để chọn)
            </div>
            <div className="flex flex-wrap gap-2 justify-center items-center">
              {poolItems.length > 0 ? (
                poolItems.map((rVal, idx) => (
                  <div
                    key={idx}
                    draggable={!isChecked}
                    onDoubleClick={() => {
                      const firstEmpty = validPairs.find(p => !currentPairAnswers[p.left]);
                      if (firstEmpty) handleDropToPair(firstEmpty.left, rVal);
                    }}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', rVal)}
                    className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 border-2 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-extrabold px-3.5 py-1.5 rounded-xl text-sm shadow-sm cursor-grab active:scale-95 transition select-none"
                  >
                    {rVal}
                  </div>
                ))
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">✓ Đã phân bổ hết tất cả từ khóa!</span>
              )}
            </div>
          </div>

          <div className="space-y-2.5">
            {validPairs.map((p, idx) => {
              const assignedVal = currentPairAnswers[p.left];
              const isPairCorrect = isChecked ? assignedVal === p.right : null;
              return (
                <div key={idx} className="flex flex-col md:flex-row gap-3 items-stretch">
                  <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl font-bold text-slate-800 dark:text-slate-200 flex items-center shadow-sm text-sm">
                    {p.left}
                  </div>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDropToPair(p.left, e.dataTransfer.getData('text/plain'));
                    }}
                    className={`flex-1 border-2 border-dashed rounded-2xl p-2 flex items-center justify-start min-h-[50px] transition ${
                      assignedVal
                        ? isChecked
                          ? isPairCorrect
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                            : 'border-red-500 bg-red-50 dark:bg-red-950/30'
                          : 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/30'
                        : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950'
                    }`}
                  >
                    {assignedVal ? (
                      <div
                        draggable={!isChecked}
                        onDoubleClick={() => handleRemoveFromPair(p.left)}
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', assignedVal)}
                        className={`font-black px-3.5 py-1.5 rounded-xl text-sm shadow-sm cursor-grab select-none transition active:scale-95 inline-block ${
                          isChecked
                            ? isPairCorrect
                              ? 'bg-emerald-500 text-white'
                              : 'bg-red-500 text-white'
                            : 'bg-amber-200 dark:bg-amber-900/60 border-2 border-amber-400 text-amber-900 dark:text-amber-200'
                        }`}
                      >
                        {assignedVal} {!isPairCorrect && isChecked && <span className="ml-1 text-xs underline font-normal">(Đúng: {p.right})</span>}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs italic font-medium m-auto">Thả đáp án vào đây</span>
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
      const currentGroupAnswers = cs.answer || {}; // { [item]: groupName }
      const allItems = (currentQ.groups || []).reduce((acc, g) => [...acc, ...(g.items || [])], []);
      const poolItems = allItems.filter(item => !currentGroupAnswers[item]);

      const handleAssignToGroup = (item, groupName) => {
        if (!item || !groupName || isChecked) return;
        setAnswer({ ...currentGroupAnswers, [item]: groupName });
      };

      const handleRemoveFromGroup = (item) => {
        if (isChecked) return;
        const next = { ...currentGroupAnswers };
        delete next[item];
        setAnswer(next);
      };

      const cols = (currentQ.groups || []).length === 2 ? 'md:grid-cols-2' : ((currentQ.groups || []).length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4');

      return (
        <div className="space-y-5">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const item = e.dataTransfer.getData('text/plain');
              if (item) handleRemoveFromGroup(item);
            }}
            className="bg-indigo-50/70 dark:bg-blue-950/20 border-2 border-dashed border-indigo-300 dark:border-blue-800/50 rounded-2xl p-4 shadow-inner"
          >
            <div className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-blue-400 mb-2.5 text-center">
              🏷️ NGÂN HÀNG TỪ KHÓA (Kéo thả từ hoặc Nhấp đúp chuột 2 lần để chọn)
            </div>
            <div className="flex flex-wrap gap-2 justify-center items-center">
              {poolItems.length > 0 ? (
                poolItems.map((item, idx) => (
                  <div
                    key={idx}
                    draggable={!isChecked}
                    onDoubleClick={() => {
                      const firstG = (currentQ.groups || [])[0];
                      if (firstG) handleAssignToGroup(item, firstG.name);
                    }}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', item)}
                    className="bg-indigo-100 hover:bg-indigo-200 dark:bg-blue-900/40 border-2 border-indigo-400 dark:border-blue-700 text-indigo-900 dark:text-blue-200 font-extrabold px-3.5 py-1.5 rounded-xl text-sm shadow-sm cursor-grab active:scale-95 transition select-none"
                  >
                    {item}
                  </div>
                ))
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">✓ Đã xếp hết từ khóa vào nhóm!</span>
              )}
            </div>
          </div>

          <div className={`grid grid-cols-1 ${cols} gap-4`}>
            {(currentQ.groups || []).map((g, gIdx) => {
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
                  <div className="flex-1 border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl p-3 flex flex-wrap content-start items-start gap-2 min-h-[120px]">
                    {groupItems.length > 0 ? (
                      groupItems.map((item, idx) => {
                        const isItemCorrect = isChecked ? (g.items || []).includes(item) : null;
                        return (
                          <div
                            key={idx}
                            draggable={!isChecked}
                            onDoubleClick={() => handleRemoveFromGroup(item)}
                            onDragStart={(e) => e.dataTransfer.setData('text/plain', item)}
                            className={`font-extrabold px-3 py-1.5 rounded-xl text-sm shadow-sm cursor-grab select-none transition active:scale-95 flex-initial ${
                              isChecked
                                ? isItemCorrect
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-red-500 text-white'
                                : 'bg-indigo-100 hover:bg-indigo-200 dark:bg-blue-900/50 border-2 border-indigo-400 text-indigo-900 dark:text-blue-200'
                            }`}
                          >
                            {item}
                          </div>
                        );
                      })
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
      const clozeAnswers = cs.answer || [];
      const allAnswers = currentQ.answers || [];
      const poolItems = allAnswers.filter(ans => !clozeAnswers.includes(ans));
      const parts = (currentQ.content || currentQ.question || '').split('___');

      const handleFillBlank = (idx, value) => {
        if (isChecked) return;
        const next = [...clozeAnswers];
        next[idx] = value;
        setAnswer(next);
      };

      return (
        <div className="space-y-5">
          <div className="bg-indigo-50/70 dark:bg-blue-950/20 border-2 border-dashed border-indigo-300 dark:border-blue-800/50 rounded-2xl p-4 shadow-inner">
            <div className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-blue-400 mb-2.5 text-center">
              🏷️ NGÂN HÀNG TỪ KHÓA (Kéo thả hoặc Nhấp đúp chuột 2 lần để chọn)
            </div>
            <div className="flex flex-wrap gap-2 justify-center items-center">
              {poolItems.length > 0 ? (
                poolItems.map((ans, idx) => (
                  <div
                    key={idx}
                    draggable={!isChecked}
                    onDoubleClick={() => {
                      const firstEmpty = parts.findIndex((_, i) => i < parts.length - 1 && !clozeAnswers[i]);
                      if (firstEmpty !== -1) handleFillBlank(firstEmpty, ans);
                    }}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', ans)}
                    className="bg-indigo-100 hover:bg-indigo-200 dark:bg-blue-900/40 border-2 border-indigo-400 dark:border-blue-700 text-indigo-900 dark:text-blue-200 font-extrabold px-3.5 py-1.5 rounded-xl text-sm shadow-sm cursor-grab active:scale-95 transition select-none"
                  >
                    {ans}
                  </div>
                ))
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">✓ Đã điền xong tất cả chỗ trống!</span>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 p-6 rounded-2xl text-slate-800 dark:text-slate-200 leading-loose text-base">
            {parts.map((part, idx) => {
              if (idx === parts.length - 1) {
                return <span key={idx} dangerouslySetInnerHTML={{ __html: part }} />;
              }
              const filledVal = clozeAnswers[idx] || '';
              const correctVal = (currentQ.answers || [])[idx];
              const isPartCorrect = isChecked ? filledVal === correctVal : null;
              return (
                <span key={idx} className="inline-block mx-1">
                  <span dangerouslySetInnerHTML={{ __html: part }} />
                  <span
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleFillBlank(idx, e.dataTransfer.getData('text/plain'));
                    }}
                    className={`inline-flex items-center gap-1 border-2 border-dashed rounded-lg px-2.5 py-1 align-middle transition ${
                      filledVal
                        ? isChecked
                          ? isPartCorrect
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 font-bold'
                            : 'border-red-500 bg-red-50 dark:bg-red-950 text-red-700 font-bold'
                          : 'border-indigo-500 bg-indigo-50 dark:bg-blue-950 text-indigo-700 dark:text-blue-300 font-bold'
                        : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-400'
                    }`}
                  >
                    {filledVal ? (
                      <span
                        draggable={!isChecked}
                        onDoubleClick={() => handleFillBlank(idx, '')}
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', filledVal)}
                        className="cursor-grab select-none"
                      >
                        {filledVal} {!isPartCorrect && isChecked && <span className="text-xs underline ml-1">({correctVal})</span>}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs italic px-2">...</span>
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
      const currentAnswers = cs.answer || [];
      const pool = Array.from({ length: (currentQ.items || []).length }, (_, i) => i)
        .filter(idx => !currentAnswers.includes(idx))
        .sort((a, b) => currentQ.items[a].localeCompare(currentQ.items[b]));

      const handleAddWord = (idx) => {
        if (isChecked) return;
        setAnswer([...currentAnswers, idx]);
      };

      const handleRemoveWord = (pos) => {
        if (isChecked) return;
        setAnswer(currentAnswers.filter((_, i) => i !== pos));
      };

      return (
        <div className="space-y-5">
          <div className="bg-slate-50 dark:bg-slate-900/60 border-4 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-6 min-h-[100px] flex flex-col justify-center">
            <div className="text-center text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Khu vực ghép từ (Bấm vào từ để bỏ ra)
            </div>
            <div className="flex flex-wrap gap-2 justify-center items-center">
              {currentAnswers.length > 0 ? (
                currentAnswers.map((idx, pos) => (
                  <button
                    key={pos}
                    type="button"
                    disabled={isChecked}
                    onClick={() => handleRemoveWord(pos)}
                    className="bg-yellow-100 dark:bg-yellow-950/30 hover:bg-yellow-200 border-2 border-yellow-400 text-yellow-800 dark:text-yellow-300 font-bold px-4 py-2 rounded-2xl text-sm shadow-sm transition"
                  >
                    {currentQ.items[idx]}
                  </button>
                ))
              ) : (
                <span className="text-slate-400 italic text-sm">Chưa có từ nào được chọn — Bấm vào các từ bên dưới để ghép</span>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 pl-1">
              Ngân hàng từ khóa
            </div>
            <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-wrap justify-center gap-2 shadow-sm">
              {pool.length > 0 ? (
                pool.map((idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isChecked}
                    onClick={() => handleAddWord(idx)}
                    className="bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold px-4 py-2 rounded-2xl text-sm shadow-sm transition"
                  >
                    {currentQ.items[idx]}
                  </button>
                ))
              ) : (
                <span className="text-emerald-500 font-bold text-sm">✓ Đã chọn hết từ khóa!</span>
              )}
            </div>
          </div>
        </div>
      );
    }
  };

  const totalAnswered = questions.reduce((count, _, i) => {
    const s = qState[i];
    return (s?.answer !== undefined && s.answer !== '' && (Array.isArray(s.answer) ? s.answer.length > 0 : true)) ? count + 1 : count;
  }, 0);
  const totalUnanswered = questions.length - totalAnswered;
  const totalFlagged = flagged.length;

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col overflow-hidden transition-colors duration-200">
      {/* ─── Header ─── */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between sticky top-0 z-20 shadow-sm transition-colors">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            MÔN HỌC: {subjectName}
          </span>
          <span className="font-extrabold text-slate-800 dark:text-white text-base">
            {title}
          </span>
        </div>
        <div className={`flex items-center gap-2 text-2xl font-black ${isWarningTime ? 'text-red-500 animate-pulse' : 'text-primary dark:text-blue-400'}`}>
          <Clock className="h-6 w-6" />
          {formatTime(timeLeft)}
        </div>
        <Button
          variant="danger"
          className="font-bold px-6 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-sm border-transparent"
          onClick={() => setShowSubmitModal(true)}
        >
          Nộp bài
        </Button>
      </header>

      {/* ─── Main Content (Sidebar + Question Display) ─── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Navigation list (w-80) */}
        <div className="w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 hidden lg:flex flex-col transition-colors">
          <div className="flex-1 overflow-y-auto p-6">
            <h3 className="font-bold mb-4 text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wider">
              DANH SÁCH CÂU HỎI ({questions.length})
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((_, i) => {
                const s = qState[i] || {};
                const isAnswered = s.answer !== undefined && s.answer !== '' && (Array.isArray(s.answer) ? s.answer.length > 0 : true);
                const isCurrent = currentIdx === i;
                const isFlag = flagged.includes(i);

                let btnClass = "h-10 w-10 rounded-xl font-bold text-xs transition-all border flex items-center justify-center relative ";
                if (isFlag) {
                  btnClass += "bg-red-500 text-white border-red-600 shadow-md shadow-red-500/20 font-black ";
                } else if (isCurrent) {
                  btnClass += "border-blue-600 dark:border-blue-500 ring-2 ring-blue-500/30 scale-105 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-extrabold ";
                } else if (s.checked && s.isCorrect) {
                  btnClass += "bg-emerald-500 text-white border-emerald-500 shadow-sm ";
                } else if (s.checked && !s.isCorrect) {
                  btnClass += "bg-red-500 text-white border-red-500 shadow-sm ";
                } else if (isAnswered) {
                  btnClass += "bg-emerald-500 dark:bg-emerald-600 text-white border-emerald-500 dark:border-emerald-600 shadow-sm ";
                } else {
                  btnClass += "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/50 ";
                }

                return (
                  <button
                    key={i}
                    className={btnClass}
                    onClick={() => setCurrentIdx(i)}
                  >
                    {i + 1}
                    {isFlag && <span className="absolute -top-1 -right-1 text-[10px]">🚩</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Question display */}
        <div className="flex-1 overflow-hidden flex flex-col p-4 bg-slate-50 dark:bg-slate-950/60 transition-colors">
          <Card className="w-full flex-1 flex flex-col border-0 shadow-sm rounded-3xl overflow-hidden bg-white dark:bg-slate-900">
            <CardContent className="flex-1 flex flex-col overflow-hidden pt-6">
              {/* Question top metadata */}
              <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                <span className="bg-primary/10 dark:bg-blue-900/20 text-primary dark:text-blue-400 px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider">
                  CÂU {currentIdx + 1} / {questions.length}
                </span>
                <button
                  type="button"
                  onClick={() => toggleFlag(currentIdx)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    flagged.includes(currentIdx)
                      ? 'bg-red-500 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500'
                  }`}
                >
                  <Flag className="h-3.5 w-3.5" />
                  {flagged.includes(currentIdx) ? 'Đã cắm cờ 🚩' : 'Cần xem lại 🚩'}
                </button>
              </div>

              {/* Question text */}
              <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 mb-3 leading-relaxed flex-shrink-0">
                <span dangerouslySetInnerHTML={{ __html: formatQuestionText(currentQ?.content || currentQ?.question || '') }} />
              </h2>

              {currentQ?.image && (
                <div className="mb-4 flex-shrink-0 flex justify-center">
                  <img
                    src={currentQ.image}
                    alt="Question Graphic"
                    onClick={() => setPreviewImage(currentQ.image)}
                    className="max-w-full max-h-80 md:max-h-96 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-md object-contain cursor-zoom-in hover:shadow-lg transition-transform bg-white dark:bg-slate-900 p-1.5"
                    title="Bấm vào để phóng to hình ảnh"
                  />
                </div>
              )}

              {/* Options list */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                {renderQuestion()}

                {/* Instant check / Feedback */}
                <div className="mt-4 space-y-3">
                  {isChecked ? (
                    <>
                      <div className={`p-4 rounded-2xl border-2 flex items-center gap-3 ${
                        cs.isCorrect
                          ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20'
                          : 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20'
                      }`}>
                        {cs.isCorrect
                          ? <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                          : <XCircle className="h-6 w-6 text-red-500 shrink-0" />}
                        <span className={`font-extrabold text-sm ${cs.isCorrect ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                          {cs.isCorrect ? 'Chính xác! 🎉' : 'Chưa đúng. Hãy xem đáp án chi tiết bên dưới.'}
                        </span>
                      </div>

                      {/* Hiển thị đáp án đúng chi tiết cho các dạng câu phức tạp khi làm sai */}
                      {!cs.isCorrect && qType === 'groupdrag' && (
                        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-800 space-y-2">
                          <div className="font-extrabold text-xs text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                            ✓ Đáp án phân nhóm chính xác:
                          </div>
                          {(currentQ.groups || []).map((g, idx) => (
                            <div key={idx} className="text-sm bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900">
                              <span className="font-extrabold text-indigo-700 dark:text-blue-400">{g.name}: </span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{(g.items || []).join(' • ')}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {!cs.isCorrect && qType === 'drag' && (
                        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-800 space-y-2">
                          <div className="font-extrabold text-xs text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                            ✓ Cặp ghép chính xác:
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {(currentQ.pairs || []).map((p, idx) => (
                              <div key={idx} className="text-sm bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900 flex items-center justify-between">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{p.left}</span>
                                <span className="font-black text-emerald-600 dark:text-emerald-400">➔ {p.right}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {!cs.isCorrect && qType === 'order' && (
                        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-800 space-y-2">
                          <div className="font-extrabold text-xs text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                            ✓ Thứ tự sắp xếp chính xác:
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(currentQ.items || []).map((item, idx) => (
                              <span key={idx} className="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 font-extrabold text-sm border border-emerald-300">
                                {idx + 1}. {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <Button
                      onClick={handleCheck}
                      disabled={cs.answer === undefined || cs.answer === null || (Array.isArray(cs.answer) && cs.answer.length === 0)}
                      className="w-full md:w-auto font-black rounded-xl h-11 px-8 text-sm bg-emerald-600 hover:bg-emerald-700 text-white border-transparent disabled:opacity-40 shadow-sm"
                    >
                      Kiểm tra đáp án
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── Bottom Bar: Legend (left) + Navigation (right) ─── */}
      <nav className="shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_24px_rgba(0,0,0,0.07)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.3)] flex">
        {/* LEFT: Stats legend — same width as sidebar */}
        <div className="w-80 shrink-0 hidden lg:flex items-center px-6 py-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800">
              <span className="w-2.5 h-2.5 rounded-sm border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shrink-0"></span>
              <span className="text-xs font-black text-slate-700 dark:text-slate-200">{totalUnanswered}</span>
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">chưa làm</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shrink-0"></span>
              <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">{totalAnswered}</span>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-500">đã làm</span>
            </div>
            {totalFlagged > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/40">
                <span className="text-xs leading-none">🚩</span>
                <span className="text-xs font-black text-red-600 dark:text-red-400">{totalFlagged}</span>
                <span className="text-xs font-medium text-red-500 dark:text-red-500">cần xem</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-50 dark:bg-blue-950 border-2 border-blue-500 shrink-0"></span>
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">đang xem</span>
            </div>
          </div>
        </div>

        {/* RIGHT: Navigation */}
        <div className="flex-1 flex items-center gap-4 px-6 py-4">
          <Button
            variant="outline"
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx(prev => prev - 1)}
            className="rounded-xl font-bold h-12 px-6 border-slate-200 dark:border-slate-700 bg-transparent shrink-0 flex items-center gap-1.5 text-base text-slate-700 dark:text-slate-300"
          >
            ← Câu trước
          </Button>

          <div className="flex-1 flex flex-col items-center gap-2">
            <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
              Câu {currentIdx + 1} / {questions.length}
            </span>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary dark:bg-blue-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          <Button
            disabled={currentIdx === questions.length - 1}
            onClick={() => setCurrentIdx(prev => prev + 1)}
            className="rounded-xl font-bold h-12 px-6 shrink-0 flex items-center gap-1.5 text-base bg-blue-600 hover:bg-blue-700 text-white border-transparent"
          >
            Câu tiếp theo →
          </Button>
        </div>
      </nav>

      {/* ─── Submit Confirmation Modal ─── */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="max-w-md w-full border-none shadow-2xl rounded-3xl overflow-hidden bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 animate-in zoom-in-95 duration-200">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-primary dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-2">
                <Clock className="h-8 w-8 text-primary dark:text-blue-400 animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Nộp bài luyện tập?</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">
                Bạn đã làm <strong className="text-slate-800 dark:text-slate-200">{totalAnswered}/{questions.length}</strong> câu. Bạn có chắc chắn muốn nộp bài ngay bây giờ không?
              </p>

              <div className="flex gap-3 justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowSubmitModal(false)}
                  className="w-full font-bold h-11 rounded-xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-transparent"
                >
                  Tiếp tục làm bài
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setShowSubmitModal(false);
                    handleFinish();
                  }}
                  className="w-full font-bold h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white border-transparent"
                >
                  Xác nhận nộp bài
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* ─── Lightbox Zoom Image Modal ─── */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 cursor-zoom-out"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <img
              src={previewImage}
              alt="Phóng to"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border-2 border-white/20 bg-white"
            />
            <span className="mt-3 text-white/80 text-xs font-semibold bg-black/40 px-4 py-1.5 rounded-full border border-white/10">
              Nhấp bất kỳ đâu để đóng
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
